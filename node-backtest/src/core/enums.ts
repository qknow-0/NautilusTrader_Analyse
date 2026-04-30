// 订单方向：买入或卖出
export enum OrderSide {
  /** 买入 */
  Buy = 'BUY',
  /** 卖出 */
  Sell = 'SELL',
}

// 订单有效期类型（Time In Force）
export enum TimeInForce {
  /** 成交前一直有效，直到主动取消 */
  Gtc = 'GTC',
  /** 在指定日期前有效 */
  Gtd = 'GTD',
  /** 立即成交，未成交部分取消 */
  Ioc = 'IOC',
  /** 全部成交或全部取消 */
  Fok = 'FOK',
}

// 订单状态
export enum OrderStatus {
  /** 已初始化 */
  Initialized = 'INITIALIZED',
  /** 已被交易所接受 */
  Accepted = 'ACCEPTED',
  /** 已全部成交 */
  Filled = 'FILLED',
  /** 部分成交 */
  PartiallyFilled = 'PARTIALLY_FILLED',
  /** 已取消 */
  Cancelled = 'CANCELLED',
  /** 已被拒绝 */
  Rejected = 'REJECTED',
  /** 已过期 */
  Expired = 'EXPIRED',
}

// 订单类型
export enum OrderType {
  /** 市价单：以当前最优价格立即成交 */
  Market = 'MARKET',
  /** 限价单：以指定价格或更优价格成交 */
  Limit = 'LIMIT',
}

// 持仓方向
export enum PositionSide {
  /** 多头持仓 */
  Long = 'LONG',
  /** 无持仓 */
  Flat = 'FLAT',
}

// K线聚合周期
export enum BarAggregation {
  /** 毫秒级 */
  Millisecond = 'MILLISECOND',
  /** 秒级 */
  Second = 'SECOND',
  /** 分钟级 */
  Minute = 'MINUTE',
  /** 小时级 */
  Hour = 'HOUR',
  /** 日级 */
  Day = 'DAY',
  /** 周级 */
  Week = 'WEEK',
  /** 月级 */
  Month = 'MONTH',
}

// 聚合数据来源
export enum AggregationSource {
  /** 内部聚合（由系统自行聚合） */
  Internal = 'INTERNAL',
  /** 外部聚合（数据源已聚合好） */
  External = 'EXTERNAL',
}

// 价格类型
export enum PriceType {
  /** 买一价 */
  Bid = 'BID',
  /** 卖一价 */
  Ask = 'ASK',
  /** 中间价（买一和卖一的均值） */
  Mid = 'MID',
  /** 最新成交价 */
  Last = 'LAST',
}

// 成交主动方向
export enum AggressorSide {
  /** 买方主动成交（吃掉卖单） */
  Buyer = 'BUYER',
  /** 卖方主动成交（吃掉买单） */
  Seller = 'SELLER',
  /** 无主动方（如撮合系统内部成交） */
  NoAggressor = 'NO_AGGRESSOR',
}

// 组件状态机状态
export enum ComponentState {
  /** 尚未初始化 */
  PreInitialized = 'PRE_INITIALIZED',
  /** 已就绪，可以启动 */
  Ready = 'READY',
  /** 正在启动 */
  Starting = 'STARTING',
  /** 运行中 */
  Running = 'RUNNING',
  /** 正在停止 */
  Stopping = 'STOPPING',
  /** 已停止 */
  Stopped = 'STOPPED',
  /** 正在恢复 */
  Resuming = 'RESUMING',
  /** 正在重置 */
  Resetting = 'RESETTING',
  /** 正在销毁 */
  Disposing = 'DISPOSING',
  /** 正在降级 */
  Degrading = 'DEGRADING',
  /** 已降级 */
  Degraded = 'DEGRADED',
  /** 正在故障 */
  Faulting = 'FAULTING',
  /** 已故障 */
  Faulted = 'FAULTED',
  /** 已销毁 */
  Disposed = 'DISPOSED',
}

// 组件状态机触发事件
export enum ComponentTrigger {
  /** 触发初始化 */
  Initialize = 'INITIALIZE',
  /** 触发启动 */
  Start = 'START',
  /** 启动完成 */
  StartCompleted = 'START_COMPLETED',
  /** 触发停止 */
  Stop = 'STOP',
  /** 停止完成 */
  StopCompleted = 'STOP_COMPLETED',
  /** 触发恢复 */
  Resume = 'RESUME',
  /** 恢复完成 */
  ResumeCompleted = 'RESUME_COMPLETED',
  /** 触发重置 */
  Reset = 'RESET',
  /** 重置完成 */
  ResetCompleted = 'RESET_COMPLETED',
  /** 触发销毁 */
  Dispose = 'DISPOSE',
  /** 销毁完成 */
  DisposeCompleted = 'DISPOSE_COMPLETED',
  /** 触发降级 */
  Degrade = 'DEGRADE',
  /** 降级完成 */
  DegradeCompleted = 'DEGRADE_COMPLETED',
  /** 触发故障 */
  Fault = 'FAULT',
  /** 故障完成 */
  FaultCompleted = 'FAULT_COMPLETED',
}

// 订单管理系统类型
export enum OmsType {
  /** 净额结算：同一标的合并计算净持仓 */
  Netting = 'NETTING',
  /** 对冲模式：每笔订单独立管理持仓 */
  Hedging = 'HEDGING',
}

// 流动性方向（做市/吃单）
export enum LiquiditySide {
  /** 挂单方（Maker）：提供流动性 */
  Maker = 'MAKER',
  /** 吃单方（Taker）：消耗流动性 */
  Taker = 'TAKER',
}

// 订单簿类型
export enum BookType {
  /** 最优报价（Level 1，最佳买卖价） */
  L1Mbp = 'L1_MBP',
  /** 多档报价（Level 2，多档价格聚合） */
  L2Mbp = 'L2_MBP',
  /** 逐笔委托（Level 3，逐笔订单级别） */
  L3Mbo = 'L3_MBO',
}
