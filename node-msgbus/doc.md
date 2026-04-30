# Node.js MessageBus 消息总线

NautilusTrader MessageBus 的 Node.js/TypeScript 实现，保持与 Rust 版本相同的架构设计。

---

## 项目结构

```
node-msgbus/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # 统一导出
    ├── types.ts           # 基础类型 (Topic, Pattern, Endpoint)
    ├── matching.ts        # 通配符匹配算法 (* / ?)
    ├── handler.ts         # Handler<T> / AnyHandler / IntoHandler<T>
    ├── topic-router.ts    # TopicRouter<T> — 类型化 Pub/Sub 路由器
    ├── endpoint-map.ts    # EndpointMap<T> / IntoEndpointMap<T> — 点对点端点
    ├── switchboard.ts     # MessagingSwitchboard — 主题名称工厂
    ├── models.ts          # 领域数据模型
    ├── msgbus.ts          # MessageBus — 核心消息总线
    ├── example.ts         # 7 个使用场景的完整示例
    └── msgbus.test.ts     # 58 个测试
```

---

## 核心定位

MessageBus 是 **单进程内的高性能事件路由器**，不是消息队列。

```
┌──────────────────────────────────────────────┐
│            Node.js 进程 (单线程)              │
│                                              │
│  Adapter ──→ MessageBus ──→ Strategy         │
│  Strategy ──→ MessageBus ──→ Persistence     │
│  Engine  ──→ MessageBus ──→ Cache            │
│                                              │
│  零网络开销 · 内存分发 · 微秒级延迟            │
└──────────────────────────────────────────────┘
```

---

## 两种路由机制

| | Typed (类型路由) | Any-based (动态路由) |
|---|---|---|
| **类型检查** | 编译期 TypeScript 类型安全 | 运行期 `unknown` 分发 |
| **性能** | 零 downcast 开销 | 每个 handler 需要类型守卫 |
| **适用** | 高频市场数据 (quotes, trades, bars) | 自定义类型、动态类型 |
| **API** | `subscribeQuotes` / `publishQuote` | `subscribeAny` / `publishAny` |

---

## 快速开始

```bash
cd node-msgbus
npm install
npm run example    # 运行示例
npm run test       # 运行测试 (58 个)
npm run build      # 编译到 dist/
```

---

## 基础使用

### 1. 创建消息总线

```typescript
import { MessageBus, instrumentId } from "@nautilus/msgbus";

const bus = new MessageBus("TRADER-001");
const sb = bus.switchboard;
const btcUsdt = instrumentId("OKX", "BTC-USDT");
```

### 2. 订阅和发布行情数据 (Typed Pub/Sub)

```typescript
// 订阅 quotes — 支持通配符
bus.subscribeQuotes(
  `data.quotes.${btcUsdt.venue}.*`,
  (quote) => {
    console.log(`[Quote] ${quote.instrumentId} bid=${quote.bidPrice} ask=${quote.askPrice}`);
  },
  10, // priority: 数字越大优先级越高
);

// 发布 quote
const topic = sb.quotesTopic(btcUsdt);
bus.publishQuote(topic, {
  instrumentId: btcUsdt,
  bidPrice: 69520,
  askPrice: 69525,
  bidSize: 2.5,
  askSize: 1.8,
  tsEvent: 1712390400000000000n,
  tsInit: 1712390400001000000n,
});
```

### 3. 点对点端点

```typescript
// 注册端点
bus.registerTradingCommandEndpoint(
  "RiskEngine.queue_execute",
  (cmd) => {
    console.log(`[RiskEngine] ${cmd.type}`);
  },
);

// 发送消息到端点
bus.sendTradingCommand("RiskEngine.queue_execute", {
  type: "CancelOrder",
  clientOrderId: "O-001",
});
```

### 4. 请求/响应

```typescript
const correlationId = crypto.randomUUID();

// 注册响应处理器
bus.registerResponseHandler(correlationId, (resp) => {
  if (resp.type === "Bars") {
    console.log(`received ${resp.data.length} bars`);
  }
});

// 发送响应
bus.sendResponse(correlationId, {
  type: "Bars",
  correlationId,
  data: [/* ...bars... */],
});
```

### 5. 动态路由 (Any-based)

```typescript
// 使用通配符订阅任意类型
bus.subscribeAny("events.*", (msg) => {
  if (typeof msg === "object" && msg !== null && "kind" in msg) {
    console.log(`event: ${(msg as any).kind}`);
  }
});

bus.publishAny("events.order.strategy-001", { kind: "Filled" });
```

---

## 主题命名体系

### 数据类主题

```
data.quotes.{VENUE}.{SYMBOL}          → data.quotes.OKX.BTC-USDT
data.trades.{VENUE}.{SYMBOL}          → data.trades.BINANCE.ETHUSDT
data.bars.{BAR_TYPE}                  → data.bars.1-HOUR-LAST-EXTERNAL
data.book.deltas.{VENUE}.{SYMBOL}     → data.book.deltas.OKX.BTC-USDT
data.book.depth10.{VENUE}.{SYMBOL}    → data.book.depth10.OKX.BTC-USDT
data.book.snapshots.{VENUE}.{SYMBOL}.{INTERVAL} → data.book.snapshots.OKX.BTC-USDT.1000
data.mark_prices.{VENUE}.{SYMBOL}     → data.mark_prices.OKX.BTC-USDT
data.index_prices.{VENUE}.{SYMBOL}    → data.index_prices.OKX.BTC-USDT
data.funding_rates.{VENUE}.{SYMBOL}   → data.funding_rates.OKX.BTC-USDT
data.instrument.{VENUE}.{SYMBOL}      → data.instrument.OKX.BTC-USDT
```

### 事件类主题

```
events.fills.{INSTRUMENT_ID}          → events.fills.BTC-USDT.OKX
events.cancels.{INSTRUMENT_ID}        → events.cancels.BTC-USDT.OKX
events.order.{STRATEGY_ID}            → events.order.STRAT-001
events.position.{STRATEGY_ID}         → events.position.STRAT-001
order.snapshots.{CLIENT_ORDER_ID}     → order.snapshots.O-001
```

### 引擎端点

```
DataEngine.execute                     DataEngine.process
DataEngine.queue_execute               DataEngine.response
ExecEngine.execute                     ExecEngine.process
ExecEngine.queue_execute               ExecEngine.reconcile_execution_report
RiskEngine.execute                     RiskEngine.process
RiskEngine.queue_execute
OrderEmulator.execute
Portfolio.update_account
commands.system.shutdown
```

### 通配符匹配

| 主题 | 模式 | 匹配 |
|------|------|------|
| `data.quotes.OKX.BTC-USDT` | `data.quotes.*` | ✓ |
| `data.quotes.OKX.BTC-USDT` | `data.quotes.OKX.*` | ✓ |
| `data.quotes.OKX.BTC-USDT` | `data.trades.*` | ✗ |
| `data.quotes.OKX.BTC-USDT` | `data.*.OKX.*` | ✓ |
| `data.quotes.OKX.BTC-USDT` | `data.*.OKX.?TC-USDT` | ✓ |

---

## API 完整参考

### 构造函数

```typescript
const bus = new MessageBus(traderId?: string, instanceId?: string);
// 默认 traderId="TRADER-001", instanceId=crypto.randomUUID()
```

### 行情数据 (Quotes)

```typescript
bus.subscribeQuotes(pattern: string, handler: (q: QuoteTick) => void, priority?: number): void
bus.unsubscribeQuotes(pattern: string, handlerId: string): boolean
bus.publishQuote(topic: string, quote: QuoteTick): void
```

### 成交数据 (Trades)

```typescript
bus.subscribeTrades(pattern: string, handler: (t: TradeTick) => void, priority?: number): void
bus.unsubscribeTrades(pattern: string, handlerId: string): boolean
bus.publishTrade(topic: string, trade: TradeTick): void
```

### K线数据 (Bars)

```typescript
bus.subscribeBars(pattern: string, handler: (b: Bar) => void, priority?: number): void
bus.unsubscribeBars(pattern: string, handlerId: string): boolean
bus.publishBar(topic: string, bar: Bar): void
```

### 订单簿增量 (Book Deltas)

```typescript
bus.subscribeBookDeltas(pattern: string, handler: (d: OrderBookDeltas) => void, priority?: number): void
bus.unsubscribeBookDeltas(pattern: string, handlerId: string): boolean
bus.publishBookDeltas(topic: string, deltas: OrderBookDeltas): void
```

### 订单簿快照 (Book Snapshots)

```typescript
bus.subscribeBookSnapshots(pattern: string, handler: (b: OrderBook) => void, priority?: number): void
bus.publishBookSnapshot(topic: string, book: OrderBook): void
```

### 订单事件 (Order Events)

```typescript
bus.subscribeOrderEvents(pattern: string, handler: (e: OrderEventAny) => void, priority?: number): void
bus.unsubscribeOrderEvents(pattern: string, handlerId: string): boolean
bus.publishOrderEvent(topic: string, event: OrderEventAny): void
```

### 持仓事件 (Position Events)

```typescript
bus.subscribePositionEvents(pattern: string, handler: (e: PositionEvent) => void, priority?: number): void
bus.publishPositionEvent(topic: string, event: PositionEvent): void
```

### 账户状态 (Account State)

```typescript
bus.subscribeAccountState(pattern: string, handler: (s: AccountState) => void, priority?: number): void
bus.publishAccountState(topic: string, state: AccountState): void
```

### 动态路由 (Any)

```typescript
bus.subscribeAny(pattern: string, handler: (msg: unknown) => void, priority?: number): void
bus.unsubscribeAny(pattern: string, handlerId: string): void
bus.publishAny(topic: string, message: unknown): void
bus.hasSubscribers(topic: string): boolean
bus.subscriptionsCount(topic: string): number
bus.patterns(): string[]
```

### 端点 (Endpoints)

```typescript
// 类型化端点
bus.registerQuoteEndpoint(endpoint: string, handler: (q: QuoteTick) => void): void
bus.registerTradeEndpoint(endpoint: string, handler: (t: TradeTick) => void): void
bus.registerBarEndpoint(endpoint: string, handler: (b: Bar) => void): void
bus.registerAccountStateEndpoint(endpoint: string, handler: (s: AccountState) => void): void
bus.registerTradingCommandEndpoint(endpoint: string, handler: (c: TradingCommand) => void): void
bus.registerDataCommandEndpoint(endpoint: string, handler: (c: DataCommand) => void): void
bus.registerDataResponseEndpoint(endpoint: string, handler: (r: DataResponse) => void): void
bus.registerOrderEventEndpoint(endpoint: string, handler: (e: OrderEventAny) => void): void

bus.sendQuote(endpoint: string, quote: QuoteTick): void
bus.sendTrade(endpoint: string, trade: TradeTick): void
bus.sendBar(endpoint: string, bar: Bar): void
bus.sendAccountState(endpoint: string, state: AccountState): void
bus.sendTradingCommand(endpoint: string, command: TradingCommand): void
bus.sendDataCommand(endpoint: string, command: DataCommand): void
bus.sendDataResponse(endpoint: string, response: DataResponse): void
bus.sendOrderEvent(endpoint: string, event: OrderEventAny): void

// 动态端点
bus.registerAny(endpoint: string, handler: (msg: unknown) => void): void
bus.deregisterAny(endpoint: string): void
bus.sendAny(endpoint: string, message: unknown): void
bus.isRegistered(endpoint: string): boolean
bus.endpoints(): string[]
```

### 请求/响应

```typescript
bus.registerResponseHandler(correlationId: string, handler: (msg: unknown) => void): boolean
bus.sendResponse(correlationId: string, response: DataResponse): void
```

### 生命周期

```typescript
bus.dispose(): void  // 清除所有订阅、端点和缓存
```

---

## TopicRouter 独立使用

```typescript
import { TopicRouter } from "@nautilus/msgbus";

const router = new TopicRouter<string>();

router.subscribe("data.*", (msg) => console.log(msg), 0);
router.subscribe("data.quotes.*", (msg) => console.log("high", msg), 10);

router.publish("data.quotes.BTC", "hello");

console.log(router.hasSubscribers("data.quotes.BTC"));  // true
console.log(router.subscriberCount("data.quotes.BTC")); // 2
console.log(router.exactSubscriberCount("data.quotes.BTC")); // 0 (都是通配符)

router.clear();
```

---

## Switchboard 主题生成

```typescript
import { MessagingSwitchboard, instrumentId } from "@nautilus/msgbus";

const sb = new MessagingSwitchboard();
const btc = instrumentId("OKX", "BTC-USDT");

sb.quotesTopic(btc);          // "data.quotes.OKX.BTC-USDT"
sb.tradesTopic(btc);          // "data.trades.OKX.BTC-USDT"
sb.barsTopic("1-HOUR-LAST-EXTERNAL");  // "data.bars.1-HOUR-LAST-EXTERNAL"
sb.bookDeltasTopic(btc);      // "data.book.deltas.OKX.BTC-USDT"
sb.orderFillsTopic(btc);      // "events.fills.BTC-USDT.OKX"
sb.eventOrdersTopic("STRAT-001");  // "events.order.STRAT-001"
sb.instrumentsPattern({ venue: "BINANCE", symbol: "", toString() { return "BINANCE" } });  // "data.instrument.BINANCE.*"

// 静态端点
MessagingSwitchboard.riskEngineQueueExecute();  // "RiskEngine.queue_execute"
MessagingSwitchboard.execEngineExecute();       // "ExecEngine.execute"
MessagingSwitchboard.shutdownSystemTopic();     // "commands.system.shutdown"
```

---

## 类型守卫

```typescript
import {
  isQuoteTick, isTradeTick, isBar,
  isOrderEvent, isAccountState, isPositionEvent,
  isOrderBookDeltas, isTradingCommand, isDataCommand,
  isDataResponse, isData,
} from "@nautilus/msgbus";

bus.subscribeAny("events.*", (msg) => {
  if (isQuoteTick(msg)) {
    console.log(`quote: ${msg.bidPrice}`);
  } else if (isTradeTick(msg)) {
    console.log(`trade: ${msg.price}`);
  } else if (isOrderEvent(msg)) {
    console.log(`order event: ${msg.kind}`);
  }
});
```

---

## 性能指标

10 万次发布，5 个订阅者，共 50 万条消息分发：

```
Time: ~15ms (6,800,000+ msg/s)
```

测试环境：Node.js v25 on macOS / Apple Silicon。

---

## 与 Rust 版本的差异

| | Rust 版本 | TypeScript 版本 |
|---|---|---|
| **并发模型** | thread_local!，每线程独立实例 | 单线程事件循环 |
| **借用检查** | RefCell 运行时借用 | JavaScript 引用语义 |
| **内存分配** | SmallVec 内联缓冲，零分配 | V8 引擎自动优化 |
| **类型安全** | 编译期泛型 + trait | TypeScript 类型系统 |
| **重入安全** | take/restore 缓冲机制 | JS 单线程天然安全 |

核心 API 和数据结构完全对应，业务代码可以直接替换为 TypeScript 版本使用。
