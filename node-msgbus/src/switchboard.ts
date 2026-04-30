/**
 * MessagingSwitchboard — centralized topic name factory.
 *
 * Mirrors the Rust `MessagingSwitchboard` in `crates/common/src/msgbus/switchboard.rs`.
 * Provides type-safe topic generation with caching.
 */

import { Topic, Pattern } from "./types.js";

export interface InstrumentId {
  venue: string;
  symbol: string;
}

export interface BarType {
  toString(): string;
}

export interface StrategyId {
  toString(): string;
}

export interface ClientOrderId {
  toString(): string;
}

export interface PositionId {
  toString(): string;
}

export interface Venue {
  toString(): string;
}

export interface OptionSeriesId {
  toString(): string;
}

/**
 * The switchboard generates and caches topic names using a consistent
 * hierarchical naming convention.
 */
export class MessagingSwitchboard {
  // ── Static endpoints ──────────────────────────────────────────────

  static dataEngineQueueExecute(): string {
    return "DataEngine.queue_execute";
  }

  static dataEngineExecute(): string {
    return "DataEngine.execute";
  }

  static dataEngineProcess(): string {
    return "DataEngine.process";
  }

  static dataEngineProcessData(): string {
    return "DataEngine.process_data";
  }

  static dataEngineResponse(): string {
    return "DataEngine.response";
  }

  static execEngineExecute(): string {
    return "ExecEngine.execute";
  }

  static execEngineQueueExecute(): string {
    return "ExecEngine.queue_execute";
  }

  static execEngineProcess(): string {
    return "ExecEngine.process";
  }

  static execEngineReconcileExecutionReport(): string {
    return "ExecEngine.reconcile_execution_report";
  }

  static riskEngineExecute(): string {
    return "RiskEngine.execute";
  }

  static riskEngineQueueExecute(): string {
    return "RiskEngine.queue_execute";
  }

  static riskEngineProcess(): string {
    return "RiskEngine.process";
  }

  static orderEmulatorExecute(): string {
    return "OrderEmulator.execute";
  }

  static portfolioUpdateAccount(): string {
    return "Portfolio.update_account";
  }

  static shutdownSystemTopic(): Topic {
    return "commands.system.shutdown";
  }

  // ── Dynamic topic generators (with caching) ───────────────────────

  private caches = new Map<string, Topic | Pattern>();

  instrumentsPattern(venue: Venue): Pattern {
    return this.cache(`pattern.instr.${venue}`, `data.instrument.${venue}.*`);
  }

  instrumentTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.instr.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.instrument.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  bookDeltasTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.deltas.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.book.deltas.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  bookDepth10Topic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.depth10.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.book.depth10.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  bookSnapshotsTopic(instrumentId: InstrumentId, intervalMs: number): Topic {
    return this.cache(
      `topic.snapshots.${instrumentId.venue}.${instrumentId.symbol}.${intervalMs}`,
      `data.book.snapshots.${instrumentId.venue}.${instrumentId.symbol}.${intervalMs}`,
    );
  }

  quotesTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.quotes.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.quotes.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  tradesTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.trades.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.trades.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  barsTopic(barType: BarType): Topic {
    return this.cache(`topic.bars.${barType}`, `data.bars.${barType}`);
  }

  markPriceTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.mark.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.mark_prices.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  indexPriceTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.index.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.index_prices.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  fundingRateTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.funding.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.funding_rates.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  instrumentStatusTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.status.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.status.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  instrumentCloseTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.close.${instrumentId.venue}.${instrumentId.symbol}`,
      `data.close.${instrumentId.venue}.${instrumentId.symbol}`,
    );
  }

  orderFillsTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.fills.${instrumentId}`,
      `events.fills.${instrumentId}`,
    );
  }

  orderCancelsTopic(instrumentId: InstrumentId): Topic {
    return this.cache(
      `topic.cancels.${instrumentId}`,
      `events.cancels.${instrumentId}`,
    );
  }

  orderSnapshotsTopic(clientOrderId: ClientOrderId): Topic {
    return this.cache(`topic.order.${clientOrderId}`, `order.snapshots.${clientOrderId}`);
  }

  positionsSnapshotsTopic(positionId: PositionId): Topic {
    return this.cache(`topic.pos.${positionId}`, `positions.snapshots.${positionId}`);
  }

  eventOrdersTopic(strategyId: StrategyId): Topic {
    return this.cache(`topic.order.evt.${strategyId}`, `events.order.${strategyId}`);
  }

  eventPositionsTopic(strategyId: StrategyId): Topic {
    return this.cache(`topic.pos.evt.${strategyId}`, `events.position.${strategyId}`);
  }

  signalTopic(name: string): Topic {
    return this.cache(`topic.signal.${name}`, `data.Signal${this.titleCase(name)}`);
  }

  signalPattern(name: string): Pattern {
    return this.cache(`pattern.signal.${name}`, `data.Signal${this.titleCase(name)}*`);
  }

  private cache<T extends Topic | Pattern>(key: string, value: T): T {
    let cached = this.caches.get(key) as T | undefined;
    if (cached === undefined) {
      cached = value;
      this.caches.set(key, cached);
    }
    return cached;
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

/**
 * Convenience function wrappers that use a shared switchboard instance.
 */
const sharedSwitchboard = new MessagingSwitchboard();

export function getQuotesTopic(instrumentId: InstrumentId): Topic {
  return sharedSwitchboard.quotesTopic(instrumentId);
}

export function getTradesTopic(instrumentId: InstrumentId): Topic {
  return sharedSwitchboard.tradesTopic(instrumentId);
}

export function getBarsTopic(barType: BarType): Topic {
  return sharedSwitchboard.barsTopic(barType);
}

export function getBookDeltasTopic(instrumentId: InstrumentId): Topic {
  return sharedSwitchboard.bookDeltasTopic(instrumentId);
}

export function getInstrumentsPattern(venue: Venue): Pattern {
  return sharedSwitchboard.instrumentsPattern(venue);
}
