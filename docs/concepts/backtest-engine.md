# NautilusTrader 回测引擎：OKX 现货 BTC-USDT 数据流详解

## 1. 整体架构

回测引擎采用**确定性事件驱动**架构，核心由三层组件构成：

```
┌─────────────────────────────────────────────────────────┐
│                    BacktestEngine                        │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │ DataEngine │→ │  Trader    │→ │  ExecEngine      │   │
│  │ (数据回放)  │  │ (策略/Actor)│  │  + RiskEngine    │   │
│  └────────────┘  └────────────┘  └──────────────────┘   │
│        ↓                ↓                ↓              │
│  ┌──────────────────────────────────────────────────┐   │
│  │          SimulatedExchange (模拟交易所)            │   │
│  │  ┌─────────────────┐  ┌──────────────────────┐   │   │
│  │  │ OrderMatchEngine │  │ Simulation Modules   │   │   │
│  │  │ (撮合引擎/每标的) │  │ (费用/延迟/填充模型)   │   │   │
│  │  └─────────────────┘  └──────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │   Cache    │  │ MessageBus │  │    TestClock     │   │
│  │ (内存缓存)  │  │ (事件总线)  │  │  (确定性时钟)     │   │
│  └────────────┘  └────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 2. OKX BTC-USDT 完整数据链路

### 阶段 A：实盘采集 — OKX WebSocket → Nautilus Data 类型

#### A1. 连接与订阅

```rust
// crates/adapters/okx/src/data.rs
// OKXDataClient::connect() 启动时：

// 1. HTTP 拉取所有现货交易对信息
let instruments = self.request_instruments(None, sec_len).await?;

// 2. 建立两个 WebSocket 连接
//    - ws_public:  wss://ws.okx.com:8443/ws/v5/public       (行情)
//    - ws_business: wss://ws.okx.com:8443/ws/v5/business    (K线)

// 3. 订阅 BTC-USDT 的频道
ws.subscribe_trades(instrument_id);       // trades 频道 → TradeTick
ws.subscribe_quotes(instrument_id);       // tickers 频道 → QuoteTick
ws.subscribe_books_channel(instrument_id); // books 频道 → OrderBookDepth10
```

OKX Spot 交易对可用的 WebSocket 频道：

| 频道 | WS 连接 | 产出类型 | 说明 |
|------|---------|----------|------|
| `tickers` | 公共 WS | `QuoteTick` | BBO（最优买卖价） |
| `trades` | 公共 WS | `TradeTick` | 逐笔成交 |
| `books` / `books-l2-tbt` | 公共 WS | `OrderBookDepth10` | L2 深度 |
| `bbo-tbt` | 公共 WS | `QuoteTick` | 逐笔报价 (VIP4+) |
| `candle1m` / `candle5m`... | 业务 WS | `Bar` | K线 |

#### A2. WebSocket 消息接收

```rust
// crates/adapters/okx/src/websocket/handler.rs
// OKXWsFeedHandler::next() 接收原始文本帧

let text = self.raw_rx.recv().await?;
// 原始消息示例：
// {
//   "arg": {"channel": "trades", "instId": "BTC-USDT"},
//   "data": [{
//     "instId": "BTC-USDT",
//     "tradeId": "123456789",
//     "px": "50000",
//     "sz": "0.1",
//     "side": "buy",
//     "ts": "1640995200000"
//   }]
// }

let frame = parse_raw_message(&text)?;
// → OKXWsFrame::Data { channel, inst_id, data }
```

#### A3. 数据解析 (OKX 格式 → Nautilus 类型)

```rust
// crates/adapters/okx/src/data.rs
// OKXDataClient::handle_ws_message()

match ws_message {
    OKXWsMessage::ChannelData { channel: OKXWsChannel::Trades, inst_id, data } => {
        // 解析成交消息
        parse_trade_msg_vec(&inst_id, data, self.instrument_mapping)
        // 产出 Vec<TradeTick>
    }
    OKXWsMessage::ChannelData { channel: OKXWsChannel::Tickers, inst_id, data } => {
        parse_ticker_msg_vec(&inst_id, data, self.instrument_mapping)
        // 产出 Vec<QuoteTick>
    }
    OKXWsMessage::ChannelData { channel: OKXWsChannel::Books, inst_id, data } => {
        parse_book10_msg_vec(&inst_id, data, self.instrument_mapping)
        // 产出 Vec<OrderBookDepth10>
    }
}
```

**TradeTick 生成示例** — `parse_trade_msg()` (`crates/adapters/okx/src/websocket/parse.rs:892`)：

```rust
// OKX 原始 JSON:
// {"instId":"BTC-USDT","tradeId":"123456789","px":"50000","sz":"0.1","side":"buy","ts":"1640995200000"}

// 解析为：
TradeTick {
    instrument_id: InstrumentId::from("BTC-USDT.OKX"),
    price:         Price::from("50000"),
    size:          Quantity::from("0.1"),
    side:          Side::Buy,
    trade_id:      TradeId::from("123456789"),
    ts_event:      UnixNanos(1640995200000000000),  // OKX 事件时间
    ts_init:       UnixNanos(当前系统纳秒时间),       // Nautilus 记录时间
}
```

#### A4. 数据发送

```rust
// 解析后的数据通过通道发送
Self::send_data(data_sender, Data::Trade(trade_tick));
// → DataEvent::Data(Data::Trade(trade_tick))
```

### 阶段 B：持久化 — Data → Parquet 文件

```rust
// crates/persistence/src/backend/catalog.rs
// ParquetDataCatalog::write_data_enum()

// 1. 按数据类型分离
let mut quotes = Vec::new();
let mut trades = Vec::new();
let mut bars = Vec::new();
for data in data_batch {
    match data {
        Data::Quote(q) => quotes.push(q),
        Data::Trade(t) => trades.push(t),
        Data::Bar(b) => bars.push(b),
        // ...
    }
}

// 2. 写入 Parquet 文件
write_to_parquet::<TradeTick>(&trades, base_path)?;
```

**Parquet 文件目录结构**：

```
{catalog_path}/
├── data/
│   ├── quote_tick/
│   │   └── BTC-USDT.OKX/
│   │       ├── 1700000000000000000_1700003600000000000.parquet
│   │       ├── 1700003600000000000_1700007200000000000.parquet
│   │       └── ...
│   ├── trade_tick/
│   │   └── BTC-USDT.OKX/
│   │       ├── 1700000000000000000_1700003600000000000.parquet
│   │       └── ...
│   └── bar/
│       └── BTC-USDT.OKX-1-MINUTE-LAST-EXTERNAL/
│           ├── 1700000000000000000_1700003600000000000.parquet
│           └── ...
└── instrument/
    └── BTC-USDT.OKX.parquet
```

写入约束：
- 数据必须按 `ts_init` **升序**排列
- 时间区间**不能重叠**
- 使用 Arrow Record Batch + Parquet 格式，SNAPPY 压缩
- 文件名以纳秒时间戳命名 `{start_ts}_{end_ts}.parquet`

### 阶段 C：回测加载 — Parquet → 内存 Data

```rust
// crates/backtest/src/node.rs
// BacktestNode::run_oneshot()

// 1. 加载数据
let data = load_data(config, start, end)?;
//    ↓
// dispatch_query() 根据 NautilusDataType 分发：
//   NautilusDataType::TradeTick → catalog.query::<TradeTick>(instrument_id, start, end)
//   NautilusDataType::QuoteTick → catalog.query::<QuoteTick>(instrument_id, start, end)
//   NautilusDataType::Bar       → catalog.query::<Bar>(bar_type, start, end)
//    ↓
// catalog.query_typed_data() — 通过 DataFusion SQL 引擎查询 Parquet
// → Vec<Data> (TradeTick / QuoteTick / Bar 变体)

// 2. 添加到引擎
engine.add_data(data, client_id, validate=false, sort=false)?;
//    ↓
// 数据存入 BacktestDataIterator（多路时间排序合并迭代器）
```

### 阶段 D：回测执行 — Data 回放 → 策略回调

#### D1. 主循环

```rust
// crates/backtest/src/engine.rs — BacktestEngine::run_impl()

// 初始化：设置所有组件时钟到 start_ns
Self::set_all_clocks_time(&clocks, start_ns);
self.kernel.start();          // 启动 DataEngine, ExecEngine, RiskEngine
self.kernel.start_trader();   // 启动策略/Actor

loop {
    // 1. 获取下一条数据（按 ts_init 时间序）
    data = self.data_iterator.next();

    // 2. 推进时钟
    if ts_init > self.last_ns {
        self.advance_time_impl(ts_init, &clocks);
    }

    // 3. 路由到模拟交易所（撮合）
    self.route_data_to_exchange(&data);

    // 4. 通过数据引擎分发到策略
    self.kernel.data_engine.borrow_mut().process_data(data.clone());

    // 5. 排空命令队列（策略发出的订单等）
    self.drain_command_queues();

    self.iteration += 1;
}
```

#### D2. 数据引擎分发到策略

```rust
// crates/data/src/engine/mod.rs — DataEngine::process_data()

match data {
    Data::Quote(quote) => {
        self.handle_quote(quote);
        // → cache.add_quote(quote)
        // → msgbus::publish_quote("data.quotes.BTC-USDT.OKX", quote)
    }
    Data::Trade(trade) => {
        self.handle_trade(trade);
        // → cache.add_trade(trade)
        // → msgbus::publish_trade("data.trades.BTC-USDT.OKX", trade)
    }
    Data::Bar(bar) => {
        self.handle_bar(bar);
        // → cache.add_bar(bar)
        // → msgbus::publish_bar("data.bars.BTC-USDT.OKX-1-MINUTE-LAST-EXTERNAL", bar)
    }
}
```

#### D3. 模拟交易所撮合

```rust
// crates/backtest/src/engine.rs — BacktestEngine::route_data_to_exchange()

match data {
    Data::Quote(quote)  => exchange.process_quote_tick(quote),   // 更新订单簿 BBO
    Data::Trade(trade)  => exchange.process_trade_tick(trade),   // 仅记录，不影响撮合
    Data::Bar(bar)      => exchange.process_bar(bar),            // OHLC 驱动撮合
    Data::Delta(delta)  => exchange.process_order_book_delta(delta),
    Data::Deltas(deltas)=> exchange.process_order_book_deltas(deltas),
}
```

### 阶段 E：完整时序图

```
OKX 交易所 (wss://ws.okx.com:8443/ws/v5/public)
  │
  │ WebSocket 推送: {"arg":{"channel":"trades","instId":"BTC-USDT"},
  │                  "data":[{"px":"50000","sz":"0.1","side":"buy",...}]}
  ▼
OKXWsFeedHandler::next()              [handler.rs:171]
  parse_raw_message()                  [handler.rs:450]
  → OKXWsFrame::Data
  ▼
OKXDataClient::handle_ws_message()    [data.rs:289]
  match OKXWsMessage::ChannelData{channel:Trades}
  ▼
parse_trade_msg_vec() → parse_trade_msg()   [parse.rs:892]
  OKXTradeMsg → TradeTick {
    instrument_id: BTC-USDT.OKX,
    price: 50000, size: 0.1, side: Buy,
    ts_event: 1640995200000000000,
    ts_init:  1640995200001234567
  }
  ▼
data_sender.send(Data::Trade(trade_tick))
  │
  │ 持久化 (采集模式)
  ▼
ParquetDataCatalog::write_to_parquet::<TradeTick>()   [catalog.rs:501]
  文件: {base}/data/trade_tick/BTC-USDT.OKX/{start_ts}_{end_ts}.parquet
  │
  │ ───── 切换到回测模式 ─────
  │
  ▼
BacktestNode::load_data()         [node.rs:283]
  dispatch_query() → catalog.query::<TradeTick>()
  → Vec<Data>
  ▼
BacktestEngine::add_data()        [engine.rs:364]
  data_iterator.add_data(stream, sorted_data)
  ▼
BacktestEngine::run_impl()        [engine.rs:578]
  loop:
    data = data_iterator.next()
    advance_time_impl(ts_init)      ← 推进 TestClock
    route_data_to_exchange(data)    ← SimulatedExchange 撮合
    data_engine.process_data(data)
      handle_trade(trade)
        cache.add_trade(trade)
        msgbus::publish_trade("data.trades.BTC-USDT.OKX", &trade)
  ▼
Strategy::on_trade_tick(&trade)     ← 策略回调触发
  │
  │ 策略逻辑：判断是否下单
  ▼
self.buy(order_type, instrument_id, quantity)
  → TradingCommand::SubmitOrder
  → drain_command_queues()
  → SimulatedExchange 撮合 → 生成 OrderFilled
  → msgbus::publish_order_event
  ▼
Strategy::on_order_filled(&fill)    ← 成交回调触发
```

## 3. 配置与表结构

### 回测配置示例

```rust
// 1. 引擎配置
let engine_config = BacktestEngineConfig::builder()
    .trader_id(TraderId::from("TRADER-001"))
    .build();

// 2. 交易所配置
let venue_config = BacktestVenueConfig::builder()
    .name("OKX")
    .oms_type(OmsType::Netting)           // 净仓模式
    .account_type(AccountType::Cash)      // 现货用 Cash 账户
    .book_type(BookType::L1_MBP)          // L1 最优买卖价
    .starting_balances(vec!["100000 USDT".to_string()])
    .base_currency(None)                  // 多币种账户
    .bar_execution(true)
    .trade_execution(true)
    .build();

// 3. 数据配置
let data_configs = vec![
    BacktestDataConfig::builder()
        .data_type(NautilusDataType::QuoteTick)
        .catalog_path("/data/catalog")
        .instrument_id(InstrumentId::from("BTC-USDT.OKX"))
        .start_time(UnixNanos::from(...))
        .end_time(UnixNanos::from(...))
        .build(),
    BacktestDataConfig::builder()
        .data_type(NautilusDataType::TradeTick)
        .catalog_path("/data/catalog")
        .instrument_id(InstrumentId::from("BTC-USDT.OKX"))
        .build(),
];

// 4. 运行配置
let run_config = BacktestRunConfig::builder()
    .id("btc-usdt-backtest")
    .venues(vec![venue_config])
    .data(data_configs)
    .engine(engine_config)
    .build();

let mut node = BacktestNode::new(vec![run_config])?;
node.build()?;
node.add_strategies("btc-usdt-backtest", vec![strategy])?;
let results = node.run()?;
```

### 数据库表结构

回测涉及的 PostgreSQL 表（定义于 `schema/sql/tables.sql`）：

#### 核心交易表

| 表名 | 主键 | 用途 |
|------|------|------|
| `instrument` | `id TEXT` | 合约定义（BTC-USDT.OKX，价格精度、数量限制、保证金等） |
| `order` | `id TEXT` | 订单状态（类型、方向、数量、价格、状态、成交量等） |
| `order_event` | `id TEXT` | 订单事件流水（Initialized → Accepted → Filled 等 14 种状态） |
| `position` | `id TEXT` | 持仓（方向、均价、盈亏、持续时间） |
| `account_event` | `id TEXT` | 账户余额/保证金变动快照 |

#### 行情数据表

| 表名 | 主键 | 用途 |
|------|------|------|
| `quote` | `id BIGSERIAL` | 报价记录（bid_price, ask_price, bid_size, ask_size） |
| `trade` | `id BIGSERIAL` | 成交记录（price, quantity, aggressor_side） |
| `bar` | `id BIGSERIAL` | K线（open, high, low, close, volume, 聚合类型） |
| `signal` | `id BIGSERIAL` | 信号记录 |
| `custom` | `id BIGSERIAL` | 自定义数据（JSONB） |

#### 辅助表

| 表名 | 用途 |
|------|------|
| `trader` | 交易者实例 |
| `strategy` | 策略配置（order_id_tag, oms_type, 管理选项） |
| `currency` | 货币定义（BTC, USDT 等） |
| `account` | 账户 |
| `client` | 客户端/交易所（OKX） |
| `general` | 通用键值存储 |

## 4. 核心组件总结

### 4.1 BacktestEngine

- **文件**: `crates/backtest/src/engine.rs`
- **职责**: 管理整个回测生命周期
- **关键字段**:
  - `data_iterator: BacktestDataIterator` — 多路时间排序合并迭代器
  - `venues: AHashMap<Venue, SimulatedExchange>` — 模拟交易所集合
  - `kernel: NautilusKernel` — 内核（含 DataEngine, ExecEngine, RiskEngine, Trader, Cache, MessageBus）
  - `accumulator: TimeEventAccumulator` — 定时器事件管理

### 4.2 SimulatedExchange

- **文件**: `crates/backtest/src/exchange.rs`
- **职责**: 模拟交易所，包含撮合引擎、账户管理、订单簿维护
- **关键配置**:
  - `book_type`: L1_MBP / L2_MBP / L3_MBO
  - `fill_model`: 成交填充模型
  - `fee_model`: 费用模型
  - `latency_model`: 延迟模型

### 4.3 BacktestNode

- **文件**: `crates/backtest/src/node.rs`
- **职责**: 高层编排器，连接 Parquet 数据目录与 BacktestEngine
- **支持模式**: 一次性运行（oneshot）和流式运行（streaming，分块加载）

### 4.4 ParquetDataCatalog

- **文件**: `crates/persistence/src/backend/catalog.rs`
- **职责**: 基于 Parquet + DataFusion 的历史数据存储和查询
- **数据写入**: `write_data_enum()` → 按类型分离 → `write_to_parquet()`
- **数据查询**: `query::<T>()` → DataFusion SQL → Arrow Record Batch → `DecodeDataFromRecordBatch`
