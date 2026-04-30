// Simple string-based identifiers with type safety

export class Venue {
  constructor(public readonly value: string) {}

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

export class Symbol {
  constructor(public readonly value: string) {}

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

// InstrumentId: "SYMBOL.VENUE" format (e.g. "BTC-USDT.BINANCE")
export class InstrumentId {
  public readonly symbol: Symbol;
  public readonly venue: Venue;
  private _str: string;

  constructor(symbol: Symbol, venue: Venue) {
    this.symbol = symbol;
    this.venue = venue;
    this._str = `${symbol.value}.${venue.value}`;
  }

  static from(value: string): InstrumentId {
    const parts = value.split('.');
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

  eq(other: InstrumentId): boolean {
    return this._str === other._str;
  }
}

export class ClientOrderId {
  private counter = 0;

  constructor(public readonly value: string) {}

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

export class StrategyId {
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

export class TraderId {
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
