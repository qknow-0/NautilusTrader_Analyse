import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { BarAggregation, AggregationSource, PriceType, AggressorSide } from '../core/enums.js';

export interface Bar {
  barType: string;
  instrumentId: InstrumentId;
  open: Price;
  high: Price;
  low: Price;
  close: Price;
  volume: Quantity;
  tsEvent: UnixNanos;
  tsInit: UnixNanos;
}

export function createBarType(
  instrumentId: InstrumentId,
  step: number,
  aggregation: BarAggregation,
  priceType: PriceType = PriceType.Last,
  source: AggregationSource = AggregationSource.External,
): string {
  return `${instrumentId}-${step}-${aggregation}-${priceType}-${source}`;
}

export function createBar(
  instrumentId: InstrumentId,
  step: number,
  aggregation: BarAggregation,
  open: Price | string,
  high: Price | string,
  low: Price | string,
  close: Price | string,
  volume: Quantity | string,
  tsEvent: UnixNanos,
  tsInit: UnixNanos,
): Bar {
  return {
    barType: createBarType(instrumentId, step, aggregation),
    instrumentId,
    open: open instanceof Price ? open : Price.from(open),
    high: high instanceof Price ? high : Price.from(high),
    low: low instanceof Price ? low : Price.from(low),
    close: close instanceof Price ? close : Price.from(close),
    volume: volume instanceof Quantity ? volume : Quantity.from(volume),
    tsEvent,
    tsInit,
  };
}

export interface TradeTick {
  instrumentId: InstrumentId;
  price: Price;
  size: Quantity;
  aggressorSide: AggressorSide;
  tradeId: string;
  tsEvent: UnixNanos;
  tsInit: UnixNanos;
}

export function createTradeTick(
  instrumentId: InstrumentId,
  price: Price | string,
  size: Quantity | string,
  aggressorSide: AggressorSide,
  tradeId: string,
  tsEvent: UnixNanos,
  tsInit: UnixNanos,
): TradeTick {
  return {
    instrumentId,
    price: price instanceof Price ? price : Price.from(price),
    size: size instanceof Quantity ? size : Quantity.from(size),
    aggressorSide,
    tradeId,
    tsEvent,
    tsInit,
  };
}

// Union type for all data types
export type MarketData = Bar | TradeTick;

export function dataTsInit(data: MarketData): UnixNanos {
  return data.tsInit;
}

export function dataInstrumentId(data: MarketData): InstrumentId {
  return data.instrumentId;
}

export function isBar(data: MarketData): data is Bar {
  return 'barType' in data;
}

export function isTradeTick(data: MarketData): data is TradeTick {
  return 'tradeId' in data;
}
