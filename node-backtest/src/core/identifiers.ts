// 交易所标识符（如 "BINANCE"、"OKX"）
export class Venue {
  /** 交易所名称字符串 */
  constructor(public readonly value: string) {}

  // 从字符串创建，自动转大写
  static from(value: string): Venue {
    return new Venue(value.toUpperCase());
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

// 交易标的标识符（如 "BTC-USDT"、"ETH-USD"）
export class Symbol {
  /** 标的名称字符串 */
  constructor(public readonly value: string) {}

  // 从字符串创建，自动转大写
  static from(value: string): Symbol {
    return new Symbol(value.toUpperCase());
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

// 合约/产品标识符，格式为 "SYMBOL.VENUE"（如 "BTC-USDT.BINANCE"）
export class InstrumentId {
  /** 标的 */
  public readonly symbol: Symbol;
  /** 交易所 */
  public readonly venue: Venue;
  /** 缓存的字符串表示 */
  private _str: string;

  constructor(symbol: Symbol, venue: Venue) {
    this.symbol = symbol;
    this.venue = venue;
    this._str = `${symbol.value}.${venue.value}`;
  }

  // 从 "SYMBOL.VENUE" 格式字符串解析
  static from(value: string): InstrumentId {
    const parts = value.split('.');
    // 格式必须恰好包含一个点分隔符
    if (parts.length !== 2) {
      throw new Error(`Invalid instrument ID format: ${value}. Expected "SYMBOL.VENUE"`);
    }
    return new InstrumentId(Symbol.from(parts[0]), Venue.from(parts[1]));
  }

  toString(): string {
    return this._str;
  }

  toJSON(): string {
    return this._str;
  }

  // 与另一个 InstrumentId 比较是否相等
  eq(other: InstrumentId): boolean {
    return this._str === other._str;
  }
}

// 客户端订单 ID，由策略自动生成
export class ClientOrderId {
  constructor(public readonly value: string) {}

  // 自动生成带时间戳的订单 ID，格式: O-{strategyId}-{timestamp}
  static generate(strategyId: string): ClientOrderId {
    const ts = Date.now();
    return new ClientOrderId(`O-${strategyId}-${ts}`);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

// 策略标识符
export class StrategyId {
  /** 策略名称字符串 */
  constructor(public readonly value: string) {}

  static from(value: string): StrategyId {
    return new StrategyId(value);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

// 交易者标识符
export class TraderId {
  /** 交易者 ID 字符串 */
  constructor(public readonly value: string) {}

  static from(value: string): TraderId {
    return new TraderId(value);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
