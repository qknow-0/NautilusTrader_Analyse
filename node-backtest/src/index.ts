// Core types
export { Price, Quantity, UnixNanos } from './core/types.js';
export * from './core/enums.js';
export { Venue, Symbol, InstrumentId, ClientOrderId, StrategyId, TraderId } from './core/identifiers.js';

// Data models
export type { Bar, TradeTick, MarketData } from './model/data.js';
export { createBar, createTradeTick, createBarType, isBar, isTradeTick } from './model/data.js';
export type { Order } from './model/order.js';
export { createOrder, applyFill, isOrderActive } from './model/order.js';
export type { Position } from './model/position.js';
export { createPosition, openPosition, addToPosition, closePosition, updateUnrealizedPnl, isPositionOpen } from './model/position.js';

// Engine
export { SimulatedExchange } from './engine/exchange.js';
export type { VenueConfig } from './engine/exchange.js';
export { MatchingEngine } from './engine/matching.js';
export { CashAccount } from './engine/account.js';

// Backtest
export { BacktestEngine } from './backtest/engine.js';
export type { BacktestEngineConfig } from './backtest/engine.js';
export { DataFeed } from './backtest/data-feed.js';
export { ResultAggregator, formatBacktestResult } from './backtest/result.js';
export type { BacktestResult } from './backtest/result.js';

// Strategy
export { Strategy } from './strategy/base.js';
export { EMACrossStrategy } from './strategy/ema-cross.js';

// Analysis
export { computeStats } from './analysis/stats.js';
export type { PortfolioStats } from './analysis/stats.js';

// Message bus
export { MessageBus } from './msgbus/bus.js';
