/**
 * Domain data models — TypeScript equivalents of NautilusTrader's Rust types.
 */

// ── Identifiers ──────────────────────────────────────────────────────

export interface InstrumentId {
  venue: string;
  symbol: string;
  toString(): string;
}

export function instrumentId(venue: string, symbol: string): InstrumentId {
  const obj: InstrumentId = {
    venue,
    symbol,
    toString() {
      return `${symbol}.${venue}`;
    },
  };
  return obj;
}

// ── Market Data ──────────────────────────────────────────────────────

export interface QuoteTick {
  instrumentId: InstrumentId;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  tsEvent: bigint;
  tsInit: bigint;
}

export interface TradeTick {
  instrumentId: InstrumentId;
  price: number;
  quantity: number;
  aggressorSide: "BUYER" | "SELLER";
  venueTradeId: string;
  tsEvent: bigint;
  tsInit: bigint;
}

export interface Bar {
  instrumentId: InstrumentId;
  barType: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tsEvent: bigint;
  tsInit: bigint;
}

export interface OrderBookDeltas {
  instrumentId: InstrumentId;
  deltas: OrderBookDelta[];
}

export interface OrderBookDelta {
  action: "Add" | "Update" | "Delete" | "Clear";
  side: "Bid" | "Ask";
  price: number;
  size: number;
}

// ── Events ───────────────────────────────────────────────────────────

export type OrderEventKind =
  | "Initialized"
  | "Submitted"
  | "Accepted"
  | "Rejected"
  | "Canceled"
  | "Expired"
  | "Triggered"
  | "PendingUpdate"
  | "PendingCancel"
  | "PartiallyFilled"
  | "Filled"
  | "Denied";

export interface OrderEventAny {
  kind: OrderEventKind;
  traderId: string;
  strategyId: string;
  instrumentId: InstrumentId;
  clientOrderId: string;
  venueOrderId?: string;
  orderType: string;
  orderSide: "BUY" | "SELL";
  quantity: number;
  price?: number;
  lastQty?: number;
  lastPx?: number;
  commission?: number;
  tsEvent: bigint;
  tsInit: bigint;
}

export interface AccountState {
  accountId: string;
  accountType: "Cash" | "Margin" | "Betting";
  balances: Balance[];
  margins: Margin[];
  isReported: boolean;
  tsEvent: bigint;
  tsInit: bigint;
}

export interface Balance {
  currency: string;
  total: number;
  free: number;
  locked: number;
}

export interface Margin {
  currency: string;
  initial: number;
  maintenance: number;
}

export interface PositionEvent {
  traderId: string;
  strategyId: string;
  instrumentId: InstrumentId;
  accountId: string;
  openingOrderId: string;
  entry: "LONG" | "SHORT";
  quantity: number;
  peakQty: number;
  quoteCurrency: string;
  avgPxOpen: number;
  realizedPnl: number;
  unrealizedPnl: number;
  commissions: number[];
  tsEvent: bigint;
  tsInit: bigint;
}

// ── Commands ─────────────────────────────────────────────────────────

export type TradingCommand =
  | { type: "SubmitOrder"; payload: unknown }
  | { type: "CancelOrder"; clientOrderId: string }
  | { type: "CancelAllOrders"; instrumentId?: InstrumentId }
  | { type: "ModifyOrder"; clientOrderId: string; price?: number; quantity?: number };

export type DataCommand =
  | { type: "Subscribe"; dataType: string; instrumentId: InstrumentId }
  | { type: "Unsubscribe"; dataType: string; instrumentId: InstrumentId }
  | { type: "Request"; dataType: string; instrumentId: InstrumentId; params?: Record<string, unknown> };

export type DataResponse =
  | { type: "Bars"; data: Bar[]; correlationId: string }
  | { type: "Quotes"; data: QuoteTick[]; correlationId: string }
  | { type: "Trades"; data: TradeTick[]; correlationId: string }
  | { type: "Instruments"; data: unknown[]; correlationId: string };

// ── Type guards for anyHandler ───────────────────────────────────────

export const isQuoteTick = (m: unknown): m is QuoteTick =>
  typeof m === "object" && m !== null && "bidPrice" in m && "askPrice" in m;

export const isTradeTick = (m: unknown): m is TradeTick =>
  typeof m === "object" && m !== null && "price" in m && "aggressorSide" in m;

export const isBar = (m: unknown): m is Bar =>
  typeof m === "object" && m !== null && "open" in m && "close" in m;

export const isOrderEvent = (m: unknown): m is OrderEventAny =>
  typeof m === "object" && m !== null && "kind" in m;

export const isAccountState = (m: unknown): m is AccountState =>
  typeof m === "object" && m !== null && "accountType" in m;

export const isPositionEvent = (m: unknown): m is PositionEvent =>
  typeof m === "object" && m !== null && "openingOrderId" in m;

export const isOrderBookDeltas = (m: unknown): m is OrderBookDeltas =>
  typeof m === "object" && m !== null && "deltas" in m;

export const isTradingCommand = (m: unknown): m is TradingCommand =>
  typeof m === "object" && m !== null && "type" in m;

export const isDataCommand = (m: unknown): m is DataCommand =>
  typeof m === "object" && m !== null && "type" in m;

export const isDataResponse = (m: unknown): m is DataResponse =>
  typeof m === "object" && m !== null && "type" in m && "correlationId" in m;

export const isData = (m: unknown): m is QuoteTick | TradeTick | Bar | OrderBookDeltas =>
  typeof m === "object" &&
  m !== null &&
  ("bidPrice" in m || "price" in m || "open" in m || "deltas" in m);
