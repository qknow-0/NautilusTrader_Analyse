// Order side
export enum OrderSide {
  Buy = 'BUY',
  Sell = 'SELL',
}

// Time in force
export enum TimeInForce {
  Gtc = 'GTC', // Good till cancel
  Gtd = 'GTD', // Good till date
  Ioc = 'IOC', // Immediate or cancel
  Fok = 'FOK', // Fill or kill
}

// Order status
export enum OrderStatus {
  Initialized = 'INITIALIZED',
  Accepted = 'ACCEPTED',
  Filled = 'FILLED',
  PartiallyFilled = 'PARTIALLY_FILLED',
  Cancelled = 'CANCELLED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}

// Order type
export enum OrderType {
  Market = 'MARKET',
  Limit = 'LIMIT',
}

// Position side
export enum PositionSide {
  Long = 'LONG',
  Flat = 'FLAT',
}

// Bar aggregation
export enum BarAggregation {
  Millisecond = 'MILLISECOND',
  Second = 'SECOND',
  Minute = 'MINUTE',
  Hour = 'HOUR',
  Day = 'DAY',
  Week = 'WEEK',
  Month = 'MONTH',
}

// Aggregation source
export enum AggregationSource {
  Internal = 'INTERNAL',
  External = 'EXTERNAL',
}

// Price type
export enum PriceType {
  Bid = 'BID',
  Ask = 'ASK',
  Mid = 'MID',
  Last = 'LAST',
}

// Trade aggressor side
export enum AggressorSide {
  Buyer = 'BUYER',
  Seller = 'SELLER',
  NoAggressor = 'NO_AGGRESSOR',
}
