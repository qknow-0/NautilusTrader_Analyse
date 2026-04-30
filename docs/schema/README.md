# NautilusTrader PostgreSQL 数据库 Schema 文档

## 概述

NautilusTrader 使用 PostgreSQL 作为持久化后端，存储交易数据、市场数据以及 DeFi/区块链数据。Schema 按执行顺序分为四个文件：

| 文件 | 用途 |
|------|------|
| `types.sql` | 自定义枚举类型和数值域类型 |
| `tables.sql` | 所有表定义 |
| `functions.sql` | 存储过程和工具函数 |
| `partitions.sql` | 分区表的动态管理函数 |

初始化顺序：`types.sql` → `tables.sql` → `functions.sql` → `partitions.sql`

---

## 1. 自定义类型（types.sql）

### 枚举类型

| 类型 | 值 | 用途 |
|------|---|------|
| `ACCOUNT_TYPE` | `Cash`, `Margin`, `Betting` | 账户类型 |
| `AGGREGATION_SOURCE` | `EXTERNAL`, `INTERNAL` | 数据聚合来源 |
| `AGGRESSOR_SIDE` | `NO_AGGRESSOR`, `BUYER`, `SELLER` | 成交主动方向 |
| `ASSET_CLASS` | `FX`, `EQUITY`, `COMMODITY`, `DEBT`, `INDEX`, `CRYPTOCURRENCY`, `ALTERNATIVE` | 资产类别 |
| `INSTRUMENT_CLASS` | `Spot`, `Swap`, `Future`, `FutureSpread`, `Forward`, `Cfg`, `Bond`, `Option`, `OptionSpread`, `Warrant`, `SportsBetting` | 合约类型 |
| `BAR_AGGREGATION` | `TICK`, `TICK_IMBALANCE`, `TICK_RUNS`, `VOLUME`, `VOLUME_IMBALANCE`, `VOLUME_RUNS`, `VALUE`, `VALUE_IMBALANCE`, `VALUE_RUNS`, `MILLISECOND`, `SECOND`, `MINUTE`, `HOUR`, `DAY`, `WEEK`, `MONTH` | K线聚合方式 |
| `BOOK_ACTION` | `Add`, `Update`, `Delete`, `Clear` | 订单簿动作 |
| `ORDER_STATUS` | `Initialized`, `Denied`, `Emulated`, `Released`, `Submitted`, `Accepted`, `Rejected`, `Canceled`, `Expired`, `Triggered`, `PendingUpdate`, `PendingCancel`, `PartiallyFilled`, `Filled` | 订单状态 |
| `CURRENCY_TYPE` | `CRYPTO`, `FIAT`, `COMMODITY_BACKED` | 货币类型 |
| `TRAILING_OFFSET_TYPE` | `NO_TRAILING_OFFSET`, `PRICE`, `BASIS_POINTS`, `TICKS`, `PRICE_TIER` | 追踪偏移类型 |
| `PRICE_TYPE` | `BID`, `ASK`, `MID`, `LAST` | 价格类型 |

### 数值域类型（用于区块链大整数）

| 域 | 范围 | 对应 Solidity 类型 |
|---|------|-------------------|
| `I256` | -2²⁵⁵ ~ 2²⁵⁵-1 | `int256` |
| `U256` | 0 ~ 2²⁵⁶-1 | `uint256` |
| `U128` | 0 ~ 2¹²⁸-1 | `uint128` |
| `U160` | 0 ~ 2¹⁶⁰-1 | `uint160`（地址类型） |
| `I128` | -2¹²⁷ ~ 2¹²⁷-1 | `int128` |

所有数值域使用 `NUMERIC` 存储并带范围约束检查。

---

## 2. 表结构（tables.sql）

### 2.1 通用与配置表

#### `general`
通用键值存储表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 键 |
| `value` | bytea | 值（二进制） |

#### `trader`
交易者标识表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 交易者 ID |
| `instance_id` | UUID | 实例 ID |

#### `account`
账户表（仅作标识，详细数据在 `account_event`）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 账户 ID |

#### `client`
客户端标识表（交易所/数据提供商客户端）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 客户端 ID |

#### `strategy`
策略配置表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 策略 ID |
| `order_id_tag` | TEXT | 订单 ID 标签 |
| `oms_type` | TEXT | 订单管理系统类型 |
| `manage_contingent_orders` | BOOLEAN | 是否管理条件单 |
| `manage_gtd_expiry` | BOOLEAN | 是否管理 GTD 过期 |

#### `currency`
货币定义表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 货币 ID（如 `USD`, `BTC`） |
| `precision` | INTEGER | 小数精度 |
| `iso4217` | INTEGER | ISO 4217 代码 |
| `name` | TEXT | 名称 |
| `currency_type` | CURRENCY_TYPE | 货币类型枚举 |

### 2.2 合约与市场数据表

#### `instrument`
金融合约定义表，包含完整的合约规格。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 合约 ID |
| `kind` | TEXT | 合约类型 |
| `raw_symbol` | TEXT | 原始交易代码 |
| `asset_class` | ASSET_CLASS | 资产类别 |
| `underlying` | TEXT | 标的资产 |
| `base_currency` | TEXT → currency | 基础货币 |
| `quote_currency` | TEXT → currency | 报价货币 |
| `settlement_currency` | TEXT → currency | 结算货币 |
| `isin` | TEXT | ISIN 编码 |
| `exchange` | TEXT | 交易所 |
| `option_kind` | TEXT | 期权类型 |
| `strike_price` | TEXT | 行权价 |
| `activation_ns` / `expiration_ns` | TEXT | 激活/过期时间（纳秒） |
| `price_precision` / `size_precision` | INTEGER | 价格/数量精度 |
| `price_increment` / `size_increment` | TEXT | 价格/数量最小变动 |
| `is_inverse` | BOOLEAN | 是否反向合约 |
| `multiplier` / `lot_size` | TEXT | 乘数/手数 |
| `max_quantity` ~ `min_notional` | TEXT | 数量/金额上下限 |
| `max_price` / `min_price` | TEXT | 价格上下限 |
| `margin_init` / `margin_maint` | TEXT | 初始/维持保证金 |
| `maker_fee` / `taker_fee` | TEXT | 手续费率 |
| `ts_event` / `ts_init` | TEXT | 事件/初始化时间戳 |

#### `trade`
成交记录表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `instrument_id` | TEXT → instrument | 合约 ID |
| `price` / `quantity` | TEXT | 成交价格/数量 |
| `aggressor_side` | AGGRESSOR_SIDE | 主动方向 |
| `venue_trade_id` | TEXT | 交易所成交 ID |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

#### `quote`
报价记录表（买卖盘口）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `instrument_id` | TEXT → instrument | 合约 ID |
| `bid_price` / `ask_price` | TEXT | 买卖价 |
| `bid_size` / `ask_size` | TEXT | 买卖量 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

#### `bar`
K线数据表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `instrument_id` | TEXT → instrument | 合约 ID |
| `step` | INTEGER | 聚合步长 |
| `bar_aggregation` | BAR_AGGREGATION | 聚合方式 |
| `price_type` | PRICE_TYPE | 价格类型 |
| `aggregation_source` | AGGREGATION_SOURCE | 聚合来源 |
| `open` / `high` / `low` / `close` | TEXT | OHLC |
| `volume` | TEXT | 成交量 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

#### `signal`
策略信号表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `name` | TEXT | 信号名称 |
| `value` | TEXT | 信号值 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

#### `custom`
自定义数据表（支持任意 JSON 数据结构）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `data_type` | TEXT | 数据类型标识 |
| `metadata` | JSONB | 元数据 |
| `identifier` | TEXT | 数据标识 |
| `value` | JSONB | 数据值 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

### 2.3 订单与持仓表

#### `order`
订单状态表，记录订单的完整生命周期。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 订单 ID |
| `trader_id` | TEXT → trader | 交易者 |
| `strategy_id` | TEXT | 策略 ID |
| `instrument_id` | TEXT → instrument | 合约 ID |
| `client_order_id` | TEXT | 客户端订单 ID |
| `venue_order_id` | TEXT | 交易所订单 ID |
| `position_id` | TEXT | 关联持仓 ID |
| `account_id` | TEXT | 账户 ID |
| `last_trade_id` | TEXT | 最近成交 ID |
| `order_type` | TEXT | 订单类型 |
| `order_side` | TEXT | 买卖方向 |
| `quantity` | TEXT | 委托数量 |
| `price` / `trigger_price` | TEXT | 价格/触发价 |
| `trigger_type` | TEXT | 触发类型 |
| `limit_offset` / `trailing_offset` | TEXT | 限价偏移/追踪偏移 |
| `trailing_offset_type` | TEXT | 追踪偏移类型 |
| `time_in_force` | TEXT | 有效期限类型 |
| `expire_time` | TEXT | 过期时间 |
| `filled_qty` | TEXT | 已成交数量（默认 0） |
| `liquidity_side` | TEXT | 流动性方向 |
| `avg_px` / `slippage` | DOUBLE | 均价/滑点 |
| `commissions` | TEXT[] | 手续费数组 |
| `status` | TEXT | 当前状态 |
| `is_post_only` / `is_reduce_only` | BOOLEAN | 仅挂单/仅减仓 |
| `is_quote_quantity` | BOOLEAN | 是否以报价数量 |
| `display_qty` | TEXT | 冰山单显示数量 |
| `emulation_trigger` / `trigger_instrument_id` | TEXT | 模拟触发器 |
| `contingency_type` / `order_list_id` | TEXT | 条件单类型/列表 ID |
| `linked_order_ids` | TEXT[] | 关联订单 ID 数组 |
| `parent_order_id` | TEXT | 父订单 ID |
| `exec_algorithm_id` / `exec_algorithm_params` | TEXT / JSONB | 执行算法 |
| `tags` | TEXT[] | 标签数组 |
| `init_id` | TEXT | 初始化事件 ID |
| `ts_init` / `ts_last` | TEXT | 初始化/最后更新时间戳 |

#### `order_event`
订单事件表，记录订单状态变更的完整审计日志。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 事件 ID |
| `kind` | TEXT | 事件类型 |
| `trader_id` / `strategy_id` | TEXT | 交易者/策略 |
| `instrument_id` | TEXT → instrument | 合约 |
| `client_order_id` | TEXT | 客户端订单 ID |
| `client_id` | TEXT → client | 客户端 |
| `reason` | TEXT | 事件原因 |
| `trade_id` | TEXT | 关联成交 ID |
| `currency` | TEXT → currency | 货币 |
| `order_type` / `order_side` | TEXT | 订单类型/方向 |
| `quantity` | TEXT | 数量 |
| `time_in_force` | TEXT | 有效期 |
| `liquidity_side` | TEXT | 流动性方向 |
| `post_only` / `reduce_only` / `quote_quantity` | BOOLEAN | 订单属性 |
| `reconciliation` | BOOLEAN | 是否对账事件 |
| `price` / `last_px` / `last_qty` | TEXT | 价格/最新价/最新量 |
| `trigger_price` / `trigger_type` | TEXT | 触发相关 |
| `limit_offset` / `trailing_offset` / `trailing_offset_type` | TEXT | 偏移相关 |
| `expire_time` / `display_qty` | TEXT | 过期/显示量 |
| `emulation_trigger` / `trigger_instrument_id` | TEXT | 模拟触发 |
| `contingency_type` / `order_list_id` | TEXT | 条件单 |
| `linked_order_ids` | TEXT[] | 关联订单 |
| `parent_order_id` | TEXT | 父订单 |
| `exec_algorithm_id` / `exec_algorithm_params` | TEXT / JSONB | 执行算法 |
| `exec_spawn_id` | TEXT | 执行衍生 ID |
| `venue_order_id` / `account_id` / `position_id` | TEXT | 交易所/账户/持仓 |
| `commission` | TEXT | 手续费 |
| `tags` | TEXT[] | 标签 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

#### `position`
持仓表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 持仓 ID |
| `trader_id` | TEXT → trader | 交易者 |
| `strategy_id` | TEXT | 策略 ID |
| `instrument_id` | TEXT → instrument | 合约 ID |
| `account_id` | TEXT | 账户 ID |
| `opening_order_id` / `closing_order_id` | TEXT | 开仓/平仓订单 ID |
| `entry` | TEXT | 入场方向 |
| `side` | TEXT | 持仓方向 |
| `signed_qty` | DOUBLE | 带符号数量 |
| `quantity` / `peak_qty` | TEXT | 当前/峰值数量 |
| `quote_currency` / `base_currency` | TEXT | 报价/基础货币 |
| `settlement_currency` | TEXT | 结算货币 |
| `avg_px_open` / `avg_px_close` | DOUBLE | 开仓/平仓均价 |
| `realized_return` / `realized_pnl` | DOUBLE / TEXT | 已实现收益率/盈亏 |
| `unrealized_pnl` | TEXT | 未实现盈亏 |
| `commissions` | TEXT[] | 累计手续费 |
| `duration_ns` | TEXT | 持仓时长（纳秒） |
| `ts_opened` / `ts_closed` | TEXT | 开仓/平仓时间 |

#### `account_event`
账户事件表（余额、保证金快照）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 事件 ID |
| `kind` | TEXT | 事件类型 |
| `account_id` | TEXT → account | 账户 |
| `base_currency` | TEXT → currency | 基础货币 |
| `balances` | JSONB | 余额快照 |
| `margins` | JSONB | 保证金快照 |
| `is_reported` | BOOLEAN | 是否已上报 |
| `ts_event` / `ts_init` | TEXT | 时间戳 |

### 2.4 区块链与 DeFi 表

#### `chain`
区块链注册表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` | INTEGER PK | 链 ID |
| `name` | TEXT | 链名称 |

#### `block`
区块表（按链 ID 分区）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` | INTEGER → chain PK | 链 ID |
| `number` | BIGINT PK | 区块号 |
| `hash` / `parent_hash` | TEXT | 区块哈希 |
| `miner` | TEXT | 矿工地址 |
| `gas_limit` / `gas_used` | BIGINT | Gas 限制/使用 |
| `timestamp` | TEXT | 时间戳 |
| `base_fee_per_gas` | TEXT | 基础 gas 费用 |
| `blob_gas_used` / `excess_blob_gas` | TEXT | Blob Gas |
| `l1_gas_price` / `l1_gas_used` / `l1_fee_scalar` | TEXT/BIGINT | L2 的 L1 费用 |

采用 `PARTITION BY LIST (chain_id)`，默认分区为 `block_default`。

#### `token`
代币表（按链 ID 分区）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` | INTEGER → chain PK | 链 ID |
| `address` | TEXT PK | 合约地址 |
| `symbol` / `name` | TEXT | 代币符号/名称 |
| `decimals` | INTEGER | 小数位数 |
| `error` | TEXT | 读取错误信息 |

#### `dex`
去中心化交易所注册表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` | INTEGER → chain PK | 链 ID |
| `name` | TEXT PK | DEX 名称 |
| `factory_address` | TEXT | 工厂合约地址 |
| `creation_block` | BIGINT | 创建区块号 |
| `last_full_sync_pools_block_number` | BIGINT | 最近完整同步区块 |

#### `pool`
流动性池表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` | INTEGER → chain PK | 链 ID |
| `dex_name` | TEXT PK | DEX 名称 |
| `address` | TEXT | 池合约地址 |
| `pool_identifier` | TEXT PK | 池唯一标识 |
| `creation_block` | BIGINT | 创建区块 |
| `token0_chain` / `token0_address` | INTEGER / TEXT → token | 代币 0 |
| `token1_chain` / `token1_address` | INTEGER / TEXT → token | 代币 1 |
| `fee` | INTEGER | 费率（basis points） |
| `tick_spacing` / `initial_tick` | INTEGER | Tick 间距/初始值 |
| `initial_sqrt_price_x96` | TEXT | 初始价格（Q96 格式） |
| `hook_address` | TEXT | Hook 合约地址 |
| `last_full_sync_block_number` | BIGINT | 最近完整同步区块 |

复合主键：`(chain_id, dex_name, pool_identifier)`

#### `pool_swap_event`
池成交事件表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `chain_id` → chain | INTEGER | 链 ID |
| `pool_identifier` / `dex_name` | TEXT | 池标识 |
| `block` | BIGINT | 区块号 |
| `transaction_hash` / `transaction_index` / `log_index` | TEXT/INT | 交易定位 |
| `sender` / `recipient` | TEXT | 发送方/接收方 |
| `sqrt_price_x96` | U160 | 价格平方根 |
| `liquidity` | U128 | 池内流动性 |
| `tick` | INTEGER | 当前 tick |
| `amount0` / `amount1` | I256 | 代币变化量 |
| `order_side` | TEXT | 买卖方向 |
| `base_quantity` / `quote_quantity` | NUMERIC | 成交数量 |
| `spot_price` / `execution_price` | NUMERIC | 现货价/成交价 |

唯一约束：`(chain_id, transaction_hash, log_index)`
复合索引：`idx_pool_swap_event_lookup(chain_id, pool_identifier, block, transaction_index, log_index)`

#### `pool_liquidity_event`
池流动性变更事件（Mint/Burn）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增 ID |
| `chain_id` / `pool_identifier` / `dex_name` | TEXT/INT | 定位信息 |
| `block` / `transaction_hash` / `transaction_index` / `log_index` | INT/TEXT | 交易定位 |
| `event_type` | TEXT | 事件类型（Mint/Burn） |
| `sender` / `owner` | TEXT | 发送方/所有者 |
| `position_liquidity` | U128 | 头寸流动性 |
| `amount0` / `amount1` | U160 | 代币数量 |
| `tick_lower` / `tick_upper` | INTEGER | 价格区间 |

#### `pool_collect_event`
手续费收取事件。

| 字段 | 类型 | 说明 |
|------|------|------|
| `owner` | TEXT | 所有者 |
| `amount0` / `amount1` | U256 | 收取金额 |
| `tick_lower` / `tick_upper` | INTEGER | 价格区间 |

#### `pool_flash_event`
闪电贷事件。

| 字段 | 类型 | 说明 |
|------|------|------|
| `sender` / `recipient` | TEXT | 发起方/接收方 |
| `amount0` / `amount1` | U256 | 借款金额 |
| `paid0` / `paid1` | U256 | 偿还金额（含手续费） |

#### `pool_snapshot`
池状态快照表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` / `pool_identifier` / `dex_name` | INT/TEXT | 池定位 |
| `block` / `transaction_index` / `log_index` | INT | 快照定位 |
| `transaction_hash` | TEXT | 交易哈希 |
| `current_tick` | INTEGER | 当前 tick |
| `price_sqrt_ratio_x96` | U160 | 当前价格 |
| `liquidity` | U128 | 当前流动性 |
| `protocol_fees_token0` / `protocol_fees_token1` | U256 | 协议费用 |
| `fee_protocol` | SMALLINT | 协议费率 |
| `fee_growth_global_0` / `fee_growth_global_1` | U256 | 全局费率增长 |
| `total_amount0/1_deposited` / `total_amount0/1_collected` | U256 | 累计存入/收取 |
| `total_swaps` / `total_mints` / `total_burns` / `total_flashes` | INTEGER | 各类事件计数 |
| `total_fee_collects` | INTEGER | 手续费收取计数 |
| `liquidity_utilization_rate` | DOUBLE | 流动性利用率 |
| `is_valid` | BOOLEAN | 快照是否有效 |

复合主键：`(chain_id, pool_identifier, block, transaction_index, log_index)`

#### `pool_position`
池头寸表（流动性提供者的具体头寸）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` / `pool_identifier` | INT/TEXT | 池定位 |
| `snapshot_block` / `snapshot_transaction_index` / `snapshot_log_index` | INT | 快照定位（→ pool_snapshot） |
| `owner` | TEXT | 头寸所有者 |
| `tick_lower` / `tick_upper` | INTEGER | 价格区间 |
| `liquidity` | U128 | 头寸流动性 |
| `fee_growth_inside_0/1_last` | U256 | 区间内费率增长 |
| `tokens_owed_0/1` | U128 | 待领取代币 |
| `total_amount0/1_deposited` | U256 | 累计存入 |
| `total_amount0/1_collected` | U128 | 累计收取 |
| `is_consistent` | BOOLEAN | 头寸是否一致 |

复合主键：`(chain_id, pool_identifier, snapshot_block, ..., owner, tick_lower, tick_upper)`

#### `pool_tick`
池 Tick 数据表（Uniswap V3 风格的 Tick 级流动性信息）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain_id` / `pool_identifier` | INT/TEXT | 池定位 |
| `snapshot_block` / `snapshot_transaction_index` / `snapshot_log_index` | INT | 快照定位（→ pool_snapshot） |
| `tick_value` | INTEGER | Tick 值 |
| `liquidity_gross` | U128 | 总流动性 |
| `liquidity_net` | I128 | 净流动性 |
| `fee_growth_outside_0/1` | U256 | 区间外侧费率增长 |
| `initialized` | BOOLEAN | 是否已初始化 |
| `last_updated_block` | BIGINT | 最后更新区块 |

复合主键：`(chain_id, pool_identifier, snapshot_block, ..., tick_value)`

---

## 3. 存储过程（functions.sql）

### `get_all_tables()` → TEXT[]
返回当前 schema 下所有表名的数组。

### `truncate_all_tables()` → VOID
清空当前 schema 下所有表的数据（使用 `TRUNCATE ... CASCADE`）。

### `get_last_continuous_block(blockchain_id INTEGER)` → BIGINT
获取区块链的最后一个连续区块号。逻辑：
1. 如果区块表为空，返回 0
2. 如果从最小到最大区块号之间没有缺口（count = max - min + 1），返回 `max_block`
3. 如果存在缺口，找到第一个缺口前的区块号
4. 使用窗口函数 `LEAD()` 高效检测缺口

---

## 4. 分区管理（partitions.sql）

`block` 和 `token` 表使用 `PARTITION BY LIST (chain_id)` 按链分区。

### 创建分区

| 函数 | 参数 | 说明 |
|------|------|------|
| `create_block_partition(chain_id)` | INTEGER | 为指定链创建 block 分区 |
| `create_token_partition(chain_id)` | INTEGER | 为指定链创建 token 分区 |

分区命名规则：`{table}_{chain_name_lowercase}`（如 `block_ethereum`）

### 删除分区

| 函数 | 参数 | 说明 |
|------|------|------|
| `delete_block_partition(chain_id, force)` | INTEGER, BOOLEAN | 删除 block 分区 |
| `delete_token_partition(chain_id, force)` | INTEGER, BOOLEAN | 删除 token 分区 |

- `force=false`（默认）：分区有数据时拒绝删除，返回数据量提示
- `force=true`：强制删除，CASCADE 会同时删除所有关联的区块链数据

---

## 5. 表关系图

```
general (键值存储)          chain ──┬── block (分区)
trader ──┬── order                ├── token (分区)
         ├── order_event           ├── dex ── pool ──┬── pool_swap_event
         └── position                                 ├── pool_liquidity_event
client ──┴── order_event                              ├── pool_collect_event
                                                      ├── pool_flash_event
currency ──┬── instrument ──┬── trade                 └── pool_snapshot
           ├── instrument   ├── quote                      └── pool_position
           ├── instrument   ├── bar                        └── pool_tick
           ├── instrument   └── signal
           ├── order_event
           └── account_event

account ──┬── order (注释引用)
          └── account_event

strategy ─── order
instrument ── order
             ── order_event
             ── position
             ── trade/quote/bar
```

---

## 6. 设计特点

- **时间戳使用 TEXT 存储**：所有 `ts_event`/`ts_init` 以文本存储纳秒级时间戳，保持与 NautilusTrader 内存模型一致
- **TEXT 存储精确数值**：价格、数量等使用 TEXT 而非 NUMERIC，避免精度丢失
- **JSONB 存储复杂数据**：`balances`、`margins`、`exec_algorithm_params` 等使用 JSONB
- **级联删除**：`order_event`、`account_event` 等通过 `ON DELETE CASCADE` 保持引用完整性
- **分区表**：`block` 和 `token` 按链 ID 分区，支持动态增删
