import Decimal from 'decimal.js';

// 纳秒级精度的 UNIX 时间戳
export class UnixNanos {
  /** 纳秒级时间戳值 */
  constructor(public readonly value: bigint) {}

  // 从毫秒数创建
  static fromMillis(ms: number): UnixNanos {
    return new UnixNanos(BigInt(Math.floor(ms * 1_000_000)));
  }

  // 从秒数创建
  static fromSeconds(s: number): UnixNanos {
    return new UnixNanos(BigInt(Math.floor(s * 1_000_000_000)));
  }

  // 从 Date 对象创建
  static fromDate(date: Date): UnixNanos {
    return UnixNanos.fromMillis(date.getTime());
  }

  // 转为 Date 对象
  toDate(): Date {
    // 纳秒 → 微秒 → Date
    return new Date(Number(this.value) / 1_000_000);
  }

  // 转为毫秒数
  toMillis(): number {
    return Number(this.value) / 1_000_000;
  }

  // 大于
  gt(other: UnixNanos): boolean {
    return this.value > other.value;
  }

  // 大于等于
  ge(other: UnixNanos): boolean {
    return this.value >= other.value;
  }

  // 小于
  lt(other: UnixNanos): boolean {
    return this.value < other.value;
  }

  // 小于等于
  le(other: UnixNanos): boolean {
    return this.value <= other.value;
  }

  // 等于
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

// 基于 Decimal 的高精度价格类型
export class Price {
  /** Decimal 精度的价格值 */
  constructor(public readonly value: Decimal) {}

  // 从字符串、数字或 Decimal 创建
  static from(value: string | number | Decimal): Price {
    return new Price(new Decimal(value));
  }

  // 从原始整数和精度创建（适用于序列化反序列化）
  static fromRaw(raw: bigint, precision: number): Price {
    // 用 10^precision 除得到实际价格
    const divisor = new Decimal(10).pow(precision);
    return new Price(new Decimal(raw.toString()).div(divisor));
  }

  // 转为原始整数表示（乘以 10^precision 后取整）
  toRaw(precision: number): bigint {
    return BigInt(
      this.value.mul(new Decimal(10).pow(precision)).floor().toString(),
    );
  }

  // 加法
  add(other: Price): Price {
    return new Price(this.value.add(other.value));
  }

  // 减法
  sub(other: Price): Price {
    return new Price(this.value.sub(other.value));
  }

  // 乘法：支持乘以另一个 Price 或纯数字
  mul(n: number | Price): Price {
    if (n instanceof Price) {
      return new Price(this.value.mul(n.value));
    }
    return new Price(this.value.mul(n));
  }

  // 除法：支持除以另一个 Price 或纯数字
  div(n: number | Price): Price {
    if (n instanceof Price) {
      return new Price(this.value.div(n.value));
    }
    return new Price(this.value.div(n));
  }

  // 大于
  gt(other: Price): boolean {
    return this.value.gt(other.value);
  }

  // 大于等于
  ge(other: Price): boolean {
    return this.value.gte(other.value);
  }

  // 小于
  lt(other: Price): boolean {
    return this.value.lt(other.value);
  }

  // 小于等于
  le(other: Price): boolean {
    return this.value.lte(other.value);
  }

  // 等于
  eq(other: Price): boolean {
    return this.value.eq(other.value);
  }

  // 是否为零
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

// 基于 Decimal 的高精度数量类型
export class Quantity {
  /** Decimal 精度的数量值 */
  constructor(public readonly value: Decimal) {}

  // 从字符串、数字或 Decimal 创建
  static from(value: string | number | Decimal): Quantity {
    return new Quantity(new Decimal(value));
  }

  // 从原始整数和精度创建（适用于序列化反序列化）
  static fromRaw(raw: bigint, precision: number): Quantity {
    // 用 10^precision 除得到实际数量
    const divisor = new Decimal(10).pow(precision);
    return new Quantity(new Decimal(raw.toString()).div(divisor));
  }

  // 转为原始整数表示（乘以 10^precision 后取整）
  toRaw(precision: number): bigint {
    return BigInt(
      this.value.mul(new Decimal(10).pow(precision)).floor().toString(),
    );
  }

  // 加法
  add(other: Quantity): Quantity {
    return new Quantity(this.value.add(other.value));
  }

  // 减法
  sub(other: Quantity): Quantity {
    return new Quantity(this.value.sub(other.value));
  }

  // 乘法：支持乘以另一个 Quantity 或纯数字
  mul(n: number | Quantity): Quantity {
    if (n instanceof Quantity) {
      return new Quantity(this.value.mul(n.value));
    }
    return new Quantity(this.value.mul(n));
  }

  // 除法：支持除以另一个 Quantity 或纯数字
  div(n: number | Quantity): Quantity {
    if (n instanceof Quantity) {
      return new Quantity(this.value.div(n.value));
    }
    return new Quantity(this.value.div(n));
  }

  // 大于
  gt(other: Quantity): boolean {
    return this.value.gt(other.value);
  }

  // 大于等于
  ge(other: Quantity): boolean {
    return this.value.gte(other.value);
  }

  // 小于
  lt(other: Quantity): boolean {
    return this.value.lt(other.value);
  }

  // 小于等于
  le(other: Quantity): boolean {
    return this.value.lte(other.value);
  }

  // 等于
  eq(other: Quantity): boolean {
    return this.value.eq(other.value);
  }

  // 是否为零
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
