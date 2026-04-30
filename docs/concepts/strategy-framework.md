# 策略框架 (Strategy Framework)

NautilusTrader 的策略框架基于 Rust trait 系统构建，通过组合 `DataActor`（数据订阅+事件处理）和 `Strategy`（订单+头寸管理）两层能力，形成统一的策略编程模型。回测和实盘使用完全相同的策略代码。

## 架构总览

```
Component (状态机)
  └── DataActor (数据订阅 + 事件处理)
        └── Strategy (订单 + 头寸管理)
              └── 你的策略 (自定义逻辑)
```

- **`Component`** — 有状态生命周期管理（PreInitialized → Ready → Running → Stopped）
- **`DataActor`** — 数据订阅、市场数据回调、定时器
- **`Strategy`** — 订单生命周期管理、头寸管理、风险检查、市场退出

## 核心组件

### StrategyCore

`StrategyCore` 是策略的内部引擎，持有以下组件：

| 字段 | 说明 |
|------|------|
| `actor: DataActorCore` | 数据订阅 + 事件路由核心 |
| `config: StrategyConfig` | 策略配置 |
| `order_factory` | 创建各种类型的订单 |
| `order_manager` | 订单路由（Risk Engine → Execution Engine → Adapter） |
| `portfolio` | 账户、头寸、PnL 跟踪 |
| `gtd_timers` | GTD 定时器管理 |

### StrategyConfig 配置项

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `strategy_id` | `Option<StrategyId>` | `None` | 策略唯一 ID |
| `order_id_tag` | `Option<String>` | `None` | 订单 ID 前缀标签 |
| `use_uuid_client_order_ids` | `bool` | `false` | 是否使用 UUID 作为订单 ID |
| `oms_type` | `Option<OmsType>` | `None` | 订单管理系统类型 |
| `external_order_claims` | `Option<Vec<InstrumentId>>` | `None` | 外部订单关联的合约 ID |
| `manage_contingent_orders` | `bool` | `false` | 是否自动管理 OCO/OTO/OUO 关联订单 |
| `manage_gtd_expiry` | `bool` | `false` | 是否自动管理 GTD 过期 |
| `manage_stop` | `bool` | `false` | 停止时是否自动市场退出 |
| `market_exit_interval_ms` | `u64` | `100` | 市场退出轮询间隔 |
| `market_exit_max_attempts` | `u64` | `100` | 最大重试次数 |
| `market_exit_time_in_force` | `TimeInForce` | `Gtc` | 退出订单时效类型 |
| `market_exit_reduce_only` | `bool` | `true` | 退出订单是否仅允许减仓 |
| `log_events` | `bool` | `true` | 是否记录事件日志 |
| `log_commands` | `bool` | `true` | 是否记录命令日志 |

## 生命周期

### 状态机

```
PreInitialized → Ready → Starting → Running → Stopping → Stopped
                                    ↓            ↓
                                 Faulting    Degrading
                                    ↓            ↓
                                 Faulted      Degraded
                                                    ↓
                                    Resetting ←── Stopped
                                        ↓
                                      Ready
```

### 生命周期钩子

```rust
fn register(trader_id, clock, cache, portfolio)  // 注册时调用（框架内部）
fn initialize()                                   // 初始化，进入 Ready 状态
fn start() → on_start()                          // 启动策略，订阅数据
fn stop() → on_stop()                            // 停止策略，取消订阅
fn resume() → on_resume()                        // 从 Stopped 恢复
fn reset() → on_reset()                          // 重置状态
fn dispose() → on_dispose()                      // 释放资源
fn degrade() → on_degrade()                      // 降级（部分功能不可用）
fn fault() → on_fault()                          // 故障处理
```

## 定义策略

### 基本模板

```rust
use nautilus_common::actor::DataActor;
use nautilus_model::data::QuoteTick;
use nautilus_trading::{nautilus_strategy, strategy::{Strategy, StrategyCore}};

pub struct MyStrategy {
    core: StrategyCore,
    // 自定义字段...
}

nautilus_strategy!(MyStrategy);

impl DataActor for MyStrategy {
    fn on_start(&mut self) -> anyhow::Result<()> {
        // 订阅数据
        self.subscribe_quotes(self.instrument_id, None, None);
        Ok(())
    }

    fn on_stop(&mut self) -> anyhow::Result<()> {
        // 取消订阅
        self.unsubscribe_quotes(self.instrument_id, None, None);
        Ok(())
    }

    fn on_quote(&mut self, quote: &QuoteTick) -> anyhow::Result<()> {
        // 处理报价数据
        Ok(())
    }
}
```

### nautilus_strategy! 宏

该宏自动生成 `Deref`、`DerefMut` 和 `Strategy` trait 实现，有三种形式：

```rust
// 形式 1：最简单，只需定义策略结构
nautilus_strategy!(MyStrategy);

// 形式 2：添加自定义事件处理器
nautilus_strategy!(MyStrategy, {
    fn on_order_rejected(&mut self, event: OrderRejected) {
        // 自定义处理
    }
});

// 形式 3：自定义字段名 + 事件处理器
pub struct MyStrategy {
    strat_core: StrategyCore,
}

nautilus_strategy!(MyStrategy, strat_core, {
    fn external_order_claims(&self) -> Option<Vec<InstrumentId>> {
        None
    }
});
```

## 数据订阅

策略通过 `DataActor` 继承的方法订阅各类市场数据：

| 方法 | 数据源 | 回调方法 |
|------|--------|----------|
| `subscribe_quotes(instrument_id, ...)` | 报价流 | `on_quote(&QuoteTick)` |
| `subscribe_trades(instrument_id, ...)` | 成交流 | `on_trade(&TradeTick)` |
| `subscribe_bars(bar_type, ...)` | K 线 | `on_bar(&Bar)` |
| `subscribe_book_deltas(instrument_id, ...)` | 订单簿增量 | `on_book_deltas(&OrderBookDeltas)` |
| `subscribe_instrument(instrument_id, ...)` | 合约信息 | `on_instrument(&InstrumentAny)` |
| `subscribe_instruments(venue, ...)` | 交易所所有合约 | `on_instrument(&InstrumentAny)` |
| `subscribe_mark_prices(instrument_id, ...)` | 标记价格 | `on_mark_price(&MarkPriceUpdate)` |
| `subscribe_index_prices(instrument_id, ...)` | 指数价格 | `on_index_price(&IndexPriceUpdate)` |
| `subscribe_funding_rates(instrument_id, ...)` | 资金费率 | `on_funding_rate(&FundingRateUpdate)` |
| `subscribe_option_greeks(instrument_id, ...)` | 期权希腊值 | `on_option_greeks(&OptionGreeks)` |
| `subscribe_instrument_status(instrument_id, ...)` | 合约状态 | `on_instrument_status(&InstrumentStatus)` |
| `subscribe_instrument_close(instrument_id, ...)` | 合约关闭 | `on_instrument_close(&InstrumentClose)` |
| `subscribe_signal(name)` | 自定义信号 | `on_signal(&Signal)` |
| `subscribe_data(data_type, ...)` | 自定义数据 | `on_data(&Data)` |

所有 subscribe 方法均有对应的 `unsubscribe_*` 方法。

## 订单管理

### OrderFactory 创建订单

通过 `self.core.order_factory()` 创建订单：

```rust
// 市价单
let order = self.core.order_factory().market(
    instrument_id,
    OrderSide::Buy,
    quantity,
    None,  // time_in_force
    None,  // reduce_only
    None,  // quote_quantity
    None,  // display_qty
    None,  // expire_time
    None,  // emulation_trigger
    None,  // tags
);

// 限价单
let order = self.core.order_factory().limit(
    instrument_id,
    OrderSide::Sell,
    quantity,
    price,
    None,  // time_in_force
    None,  // expire_time_ns
    Some(true),  // post_only
    None,  // display_qty
    None,  // expire_time
    None,  // emulation_trigger
    None,  // tags
    None,  // client_order_id
);

// 止损单、止损限价单、触及市价单等
// stop_market(...) / stop_limit(...) / market_if_touched(...) / limit_if_touched(...)
// market_to_limit(...)
```

### 订单操作

```rust
// 提交订单
self.submit_order(order, position_id, client_id)?;

// 提交订单列表（OCO/OTO/OUO 关联订单）
self.submit_order_list(orders, position_id, client_id)?;

// 修改订单
self.modify_order(order, new_quantity, new_price, new_trigger_price, client_id)?;

// 取消订单
self.cancel_order(order, client_id)?;

// 批量取消（同一合约的多个订单）
self.cancel_orders(orders, client_id, params)?;

// 取消某合约的所有订单
self.cancel_all_orders(instrument_id, order_side, client_id)?;

// 平掉单个头寸（提交反向市价单）
self.close_position(&position, client_id, tags, time_in_force, reduce_only, quote_quantity)?;

// 平掉某合约的所有头寸
self.close_all_positions(instrument_id, position_side, client_id, tags, time_in_force, reduce_only, quote_quantity)?;

// 查询账户
self.query_account(account_id, client_id, params)?;

// 查询订单状态
self.query_order(&order, client_id, params)?;
```

### 订单路由逻辑

```
submit_order()
    ├── 有 emulation_trigger → OrderEmulator（本地模拟订单）
    ├── 有 exec_algorithm_id  → ExecutionAlgorithm（执行算法，如 TWAP）
    └── 正常订单 → RiskEngine（风控检查）→ ExecutionEngine → 交易所适配器
```

## 事件处理

### 订单事件（可重写）

| 钩子方法 | 触发时机 |
|----------|----------|
| `on_order_initialized` | 订单创建时 |
| `on_order_denied` | 订单被系统拒绝（未到达交易所） |
| `on_order_emulated` | 订单被模拟器接管 |
| `on_order_released` | 模拟订单被释放为真实订单 |
| `on_order_submitted` | 订单提交到交易所 |
| `on_order_rejected` | 订单被交易所拒绝 |
| `on_order_accepted` | 订单被交易所接受 |
| `on_order_expired` | 订单过期 |
| `on_order_triggered` | 止损/条件单被触发 |
| `on_order_pending_update` | 订单修改等待中 |
| `on_order_pending_cancel` | 订单取消等待中 |
| `on_order_modify_rejected` | 订单修改被拒绝 |
| `on_order_cancel_rejected` | 订单取消被拒绝 |
| `on_order_updated` | 订单已修改 |

> `on_order_filled` 和 `on_order_canceled` 继承自 `DataActor` trait

### 头寸事件

| 钩子方法 | 触发时机 |
|----------|----------|
| `on_position_opened` | 头寸打开时 |
| `on_position_changed` | 头寸数量变化时 |
| `on_position_closed` | 头寸关闭时 |

## 市场退出 (Market Exit)

当 `manage_stop` 配置为 `true` 时，调用 `stop()` 会先执行市场退出流程：

1. 取消所有未成交订单
2. 以市价单平掉所有头寸（reduce-only）
3. 轮询检查，直到所有订单和头寸关闭
4. 调用 `on_market_exit()` 钩子（开始时）
5. 调用 `post_market_exit()` 钩子（完成时）
6. 最终停止策略

```rust
// 策略配置启用 manage_stop
let config = StrategyConfig {
    manage_stop: true,
    market_exit_interval_ms: 100,     // 每 100ms 检查一次
    market_exit_max_attempts: 100,    // 最多重试 100 次（共 10 秒）
    market_exit_reduce_only: true,    // 平仓单设为 reduce-only
    market_exit_time_in_force: TimeInForce::Gtc,
    ..Default::default()
};
```

也可手动触发市场退出（即使 `manage_stop=false`）：

```rust
self.market_exit()?;  // 开始退出流程，但策略保持 Running
```

## 示例策略

### 1. EMA 交叉策略（简单趋势跟踪）

源码: `crates/trading/src/examples/strategies/ema_cross/strategy.rs`

```rust
pub struct EmaCross {
    core: StrategyCore,
    instrument_id: InstrumentId,
    trade_size: Quantity,
    ema_fast: ExponentialMovingAverage,
    ema_slow: ExponentialMovingAverage,
    prev_fast_above: Option<bool>,
}

nautilus_strategy!(EmaCross);

impl DataActor for EmaCross {
    fn on_start(&mut self) -> anyhow::Result<()> {
        self.subscribe_quotes(self.instrument_id, None, None);
        Ok(())
    }

    fn on_quote(&mut self, quote: &QuoteTick) -> anyhow::Result<()> {
        self.ema_fast.handle_quote(quote);
        self.ema_slow.handle_quote(quote);

        if !self.ema_fast.initialized() || !self.ema_slow.initialized() {
            return Ok(());
        }

        let fast_above = self.ema_fast.value() > self.ema_slow.value();

        if let Some(prev) = self.prev_fast_above {
            if fast_above && !prev {
                // 快线上穿慢线 → 买入
                self.enter(OrderSide::Buy)?;
            } else if !fast_above && prev {
                // 快线下穿慢线 → 卖出
                self.enter(OrderSide::Sell)?;
            }
        }

        self.prev_fast_above = Some(fast_above);
        Ok(())
    }
}
```

### 2. Grid Market Maker（网格做市）

源码: `crates/trading/src/examples/strategies/grid_mm/strategy.rs`

特点：
- 在中间价周围挂限价单网格
- 根据持仓方向倾斜报价（inventory skew）
- 价格变动超过阈值才重新报价
- 支持 GTD 过期管理
- 处理订单被拒绝、过期、成交、取消等事件

### 3. Delta Neutral Short Volatility（Delta 中性做空波动率）

源码: `crates/trading/src/examples/strategies/delta_neutral_vol/strategy.rs`

特点：
- 持有期权 strangle 组合
- 通过永续合约进行 Delta 对冲
- 订阅期权希腊值和报价
- 使用 `submit_order_with_params` 传递交易所特定参数

## 快速上手

### 最小策略模板

```rust
use nautilus_common::actor::DataActor;
use nautilus_model::data::QuoteTick;
use nautilus_trading::{nautilus_strategy, strategy::StrategyCore};

pub struct SimpleStrategy {
    core: StrategyCore,
}

nautilus_strategy!(SimpleStrategy);

impl DataActor for SimpleStrategy {
    fn on_start(&mut self) -> anyhow::Result<()> {
        // 订阅需要的数据
        self.subscribe_quotes(self.instrument_id, None, None);
        Ok(())
    }

    fn on_stop(&mut self) -> anyhow::Result<()> {
        // 清理订阅
        self.unsubscribe_quotes(self.instrument_id, None, None);
        Ok(())
    }

    fn on_quote(&mut self, quote: &QuoteTick) -> anyhow::Result<()> {
        // 处理数据，下单逻辑
        let order = self.core.order_factory().market(
            self.instrument_id,
            OrderSide::Buy,
            self.trade_size,
            None, None, None, None, None, None, None,
        );
        self.submit_order(order, None, None)
    }
}
```

### 带配置的策略

```rust
use nautilus_model::identifiers::{InstrumentId, StrategyId};
use nautilus_model::types::Quantity;
use nautilus_trading::strategy::StrategyConfig;

pub struct MyStrategyConfig {
    pub base: StrategyConfig,
    pub instrument_id: InstrumentId,
    pub trade_size: Quantity,
}

impl MyStrategyConfig {
    pub fn new(instrument_id: InstrumentId, trade_size: Quantity) -> Self {
        Self {
            base: StrategyConfig {
                strategy_id: Some(StrategyId::from("MY_STRAT-001")),
                order_id_tag: Some("001".to_string()),
                manage_stop: true,  // 停止时自动平仓
                ..Default::default()
            },
            instrument_id,
            trade_size,
        }
    }
}

pub struct MyStrategy {
    core: StrategyCore,
    config: MyStrategyConfig,
}

impl MyStrategy {
    pub fn new(config: MyStrategyConfig) -> Self {
        Self {
            core: StrategyCore::new(config.base.clone()),
            config,
        }
    }
}

nautilus_strategy!(MyStrategy);

impl DataActor for MyStrategy {
    fn on_start(&mut self) -> anyhow::Result<()> {
        self.subscribe_quotes(self.config.instrument_id, None, None);
        Ok(())
    }

    fn on_stop(&mut self) -> anyhow::Result<()> {
        self.unsubscribe_quotes(self.config.instrument_id, None, None);
        Ok(())
    }
}
```

## 关键技术点

### Deref 设计

`nautilus_strategy!` 宏生成 `Deref<Target = DataActorCore>` 和 `DerefMut`，这意味着所有 `DataActorCore` 的方法都可以通过 `self` 直接调用，如 `self.subscribe_quotes()`、`self.cache()`、`self.clock()` 等。

### 线程安全

策略使用 `Rc<RefCell<>>` 管理共享状态，通过 `ComponentRegistry` 的 borrow tracking 防止并发可变借用。每个策略在同一时刻只被一个生命周期方法持有。

### 缓存查询

通过 `self.cache()` 获取当前状态：

```rust
let cache = self.cache();
let open_orders = cache.orders_open(None, Some(&instrument_id), Some(&strategy_id), None, None);
let open_positions = cache.positions_open(None, Some(&instrument_id), Some(&strategy_id), None, None);
let order = cache.order(&client_order_id);
let instrument = cache.instrument(&instrument_id);
```
