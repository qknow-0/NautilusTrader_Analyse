// 基础类型：价格、数量、纳秒时间戳
export { Price, Quantity, UnixNanos } from './core/types.js';
// 所有枚举定义（订单类型、状态、方向等）
export * from './core/enums.js';
// 标识符：交易所、交易对、订单ID、策略ID等
export { Venue, Symbol, InstrumentId, ClientOrderId, StrategyId, TraderId } from './core/identifiers.js';

// 组件状态机
export { transitionState, isValidTransition } from './core/component.js';
// 时钟（提供时间访问和定时器）
export { Clock } from './core/clock.js';

// 数据类型：K线、成交记录、市场数据联合类型
export type { Bar, TradeTick, MarketData } from './model/data.js';
// K线和成交数据的工厂函数及类型判断
export { createBar, createTradeTick, createBarType, isBar, isTradeTick } from './model/data.js';
// 订单类型定义
export type { Order } from './model/order.js';
// 订单创建、成交应用、活跃状态判断
export { createOrder, applyFill, isOrderActive } from './model/order.js';
// 持仓类型定义
export type { Position } from './model/position.js';
// 持仓生命周期：开仓、加仓、平仓、盈亏更新
export { createPosition, openPosition, addToPosition, closePosition, updateUnrealizedPnl, isPositionOpen } from './model/position.js';

// 模拟交易所
export { SimulatedExchange } from './engine/exchange.js';
// 交易所配置
export type { VenueConfig, FillEvent } from './engine/exchange.js';
// 撮合引擎
export { MatchingEngine } from './engine/matching.js';
// 现金账户
export { CashAccount, AccountBalance } from './engine/account.js';

// 回测引擎主类
export { BacktestEngine } from './backtest/engine.js';
// 回测引擎配置
export type { BacktestEngineConfig } from './backtest/engine.js';
// 数据源迭代器
export { DataFeed } from './backtest/data-feed.js';
// 结果聚合器和格式化输出
export { ResultAggregator, formatBacktestResult } from './backtest/result.js';
// 回测结果类型
export type { BacktestResult } from './backtest/result.js';

// 组件生命周期基类
export { Component } from './strategy/strategy.js';
// 数据订阅与事件分发基类
export { DataActor } from './strategy/strategy.js';
// 策略框架主类（含订单、持仓、风控管理）
export { Strategy } from './strategy/strategy.js';
// 策略缓存
export { StrategyCache } from './strategy/cache.js';
// 订单工厂
export { OrderFactory } from './strategy/order-factory.js';
// 持仓与盈亏跟踪
export { Portfolio } from './strategy/portfolio.js';
// 风控引擎
export { RiskEngine } from './strategy/risk.js';
export type { StrategyConfig } from './strategy/config.js';
export type { RiskLimits } from './strategy/risk.js';
export { resolveConfig, defaultStrategyConfig } from './strategy/config.js';

// 指标基类
export { Indicator } from './strategy/indicators/base.js';
// 指数移动平均线
export { EMA } from './strategy/indicators/ema.js';
// 简单移动平均线
export { SMA } from './strategy/indicators/sma.js';
// 相对强弱指标
export { RSI } from './strategy/indicators/rsi.js';
// 平均真实波幅
export { ATR } from './strategy/indicators/atr.js';

// EMA 交叉策略示例
export { EMACrossStrategy } from './strategy/ema-cross.js';
// 网格做市策略
export { GridMarketMaker } from './strategy/grid-mm.js';
export type { GridMMConfig } from './strategy/grid-mm.js';
// RSI 均值回归策略
export { RSIReversionStrategy } from './strategy/rsi-reversion.js';
export type { RSIReversionConfig } from './strategy/rsi-reversion.js';
// 唐奇安通道突破策略
export { BreakoutStrategy } from './strategy/breakout.js';
export type { BreakoutConfig } from './strategy/breakout.js';

// 绩效统计计算
export { computeStats } from './analysis/stats.js';
// 绩效统计结果类型
export type { PortfolioStats } from './analysis/stats.js';

// 消息总线（Pub/Sub）
export { MessageBus } from './msgbus/bus.js';
