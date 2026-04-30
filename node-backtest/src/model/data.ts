import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { BarAggregation, AggregationSource, PriceType, AggressorSide } from '../core/enums.js';

// K 线数据接口，表示一个时间周期内的 OHLCV 数据
export interface Bar {
  barType: string;        // K 线类型标识字符串
  instrumentId: InstrumentId;  // 交易对/合约 ID
  open: Price;            // 开盘价
  high: Price;            // 最高价
  low: Price;             // 最低价
  close: Price;           // 收盘价
  volume: Quantity;       // 成交量
  tsEvent: UnixNanos;     // 事件时间戳（纳秒）
  tsInit: UnixNanos;      // 初始化时间戳（纳秒）
}

// 创建 K 线类型标识字符串
export function createBarType(
  instrumentId: InstrumentId,
  step: number,             // 聚合步长
  aggregation: BarAggregation,  // 聚合方式
  priceType: PriceType = PriceType.Last,           // 价格类型，默认取最新价
  source: AggregationSource = AggregationSource.External,  // 聚合来源，默认外部
): string {
  return `${instrumentId}-${step}-${aggregation}-${priceType}-${source}`;
}

// 创建一条 K 线数据
export function createBar(
  instrumentId: InstrumentId,
  step: number,             // 聚合步长
  aggregation: BarAggregation,  // 聚合方式
  open: Price | string,     // 开盘价
  high: Price | string,     // 最高价
  low: Price | string,      // 最低价
  close: Price | string,    // 收盘价
  volume: Quantity | string, // 成交量
  tsEvent: UnixNanos,       // 事件时间戳
  tsInit: UnixNanos,        // 初始化时间戳
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

// 逐笔成交数据接口
export interface TradeTick {
  instrumentId: InstrumentId;  // 交易对/合约 ID
  price: Price;             // 成交价格
  size: Quantity;           // 成交数量
  aggressorSide: AggressorSide;  // 主动方（买方/卖方）
  tradeId: string;          // 成交编号
  tsEvent: UnixNanos;       // 事件时间戳（纳秒）
  tsInit: UnixNanos;        // 初始化时间戳（纳秒）
}

// 创建一条逐笔成交数据
export function createTradeTick(
  instrumentId: InstrumentId,
  price: Price | string,      // 成交价格
  size: Quantity | string,    // 成交数量
  aggressorSide: AggressorSide,  // 主动方
  tradeId: string,            // 成交编号
  tsEvent: UnixNanos,         // 事件时间戳
  tsInit: UnixNanos,          // 初始化时间戳
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

// 市场数据的联合类型（K 线或逐笔成交）
export type MarketData = Bar | TradeTick;

// 获取市场数据的初始化时间戳
export function dataTsInit(data: MarketData): UnixNanos {
  return data.tsInit;
}

// 获取市场数据的交易对 ID
export function dataInstrumentId(data: MarketData): InstrumentId {
  return data.instrumentId;
}

// 判断是否为 K 线数据（通过检查 barType 字段）
export function isBar(data: MarketData): data is Bar {
  return 'barType' in data;
}

// 判断是否为逐笔成交数据（通过检查 tradeId 字段）
export function isTradeTick(data: MarketData): data is TradeTick {
  return 'tradeId' in data;
}
