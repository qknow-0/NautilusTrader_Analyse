import Decimal from 'decimal.js';

// Nanosecond-precision timestamp
export class UnixNanos {
  constructor(public readonly value: bigint) {}

  static fromMillis(ms: number): UnixNanos {
    return new UnixNanos(BigInt(Math.floor(ms * 1_000_000)));
  }

  static fromSeconds(s: number): UnixNanos {
    return new UnixNanos(BigInt(Math.floor(s * 1_000_000_000)));
  }

  static fromDate(date: Date): UnixNanos {
    return UnixNanos.fromMillis(date.getTime());
  }

  toDate(): Date {
    return new Date(Number(this.value) / 1_000_000);
  }

  toMillis(): number {
    return Number(this.value) / 1_000_000;
  }

  gt(other: UnixNanos): boolean {
    return this.value > other.value;
  }

  ge(other: UnixNanos): boolean {
    return this.value >= other.value;
  }

  lt(other: UnixNanos): boolean {
    return this.value < other.value;
  }

  le(other: UnixNanos): boolean {
    return this.value <= other.value;
  }

  eq(other: UnixNanos): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }

  toJSON(): string {
    return this.toString();
  }
}

// Decimal-based price type for precision
export class Price {
  constructor(public readonly value: Decimal) {}

  static from(value: string | number | Decimal): Price {
    return new Price(new Decimal(value));
  }

  static fromRaw(raw: bigint, precision: number): Price {
    const divisor = new Decimal(10).pow(precision);
    return new Price(new Decimal(raw.toString()).div(divisor));
  }

  toRaw(precision: number): bigint {
    return BigInt(
      this.value.mul(new Decimal(10).pow(precision)).floor().toString(),
    );
  }

  add(other: Price): Price {
    return new Price(this.value.add(other.value));
  }

  sub(other: Price): Price {
    return new Price(this.value.sub(other.value));
  }

  mul(n: number | Price): Price {
    if (n instanceof Price) {
      return new Price(this.value.mul(n.value));
    }
    return new Price(this.value.mul(n));
  }

  div(n: number | Price): Price {
    if (n instanceof Price) {
      return new Price(this.value.div(n.value));
    }
    return new Price(this.value.div(n));
  }

  gt(other: Price): boolean {
    return this.value.gt(other.value);
  }

  ge(other: Price): boolean {
    return this.value.gte(other.value);
  }

  lt(other: Price): boolean {
    return this.value.lt(other.value);
  }

  le(other: Price): boolean {
    return this.value.lte(other.value);
  }

  eq(other: Price): boolean {
    return this.value.eq(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  toString(): string {
    return this.value.toString();
  }

  toJSON(): string {
    return this.toString();
  }
}

// Decimal-based quantity type for precision
export class Quantity {
  constructor(public readonly value: Decimal) {}

  static from(value: string | number | Decimal): Quantity {
    return new Quantity(new Decimal(value));
  }

  static fromRaw(raw: bigint, precision: number): Quantity {
    const divisor = new Decimal(10).pow(precision);
    return new Quantity(new Decimal(raw.toString()).div(divisor));
  }

  toRaw(precision: number): bigint {
    return BigInt(
      this.value.mul(new Decimal(10).pow(precision)).floor().toString(),
    );
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value.add(other.value));
  }

  sub(other: Quantity): Quantity {
    return new Quantity(this.value.sub(other.value));
  }

  mul(n: number | Quantity): Quantity {
    if (n instanceof Quantity) {
      return new Quantity(this.value.mul(n.value));
    }
    return new Quantity(this.value.mul(n));
  }

  div(n: number | Quantity): Quantity {
    if (n instanceof Quantity) {
      return new Quantity(this.value.div(n.value));
    }
    return new Quantity(this.value.div(n));
  }

  gt(other: Quantity): boolean {
    return this.value.gt(other.value);
  }

  ge(other: Quantity): boolean {
    return this.value.gte(other.value);
  }

  lt(other: Quantity): boolean {
    return this.value.lt(other.value);
  }

  le(other: Quantity): boolean {
    return this.value.lte(other.value);
  }

  eq(other: Quantity): boolean {
    return this.value.eq(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  toString(): string {
    return this.value.toString();
  }

  toJSON(): string {
    return this.toString();
  }
}
