import { Bar } from '../model/data.js';
import { Order } from '../model/order.js';
import { Price, Quantity } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { Strategy } from './base.js';

// Exponential Moving Average calculator
class EMA {
  private values: number[] = [];
  private current: number | null = null;
  private multiplier: number;

  constructor(public period: number) {
    this.multiplier = 2 / (period + 1);
  }

  update(value: number): number {
    this.values.push(value);

    if (this.current === null) {
      if (this.values.length < this.period) {
        // Use simple average until we have enough data
        this.current = this.values.reduce((a, b) => a + b, 0) / this.values.length;
      } else {
        this.current = value;
      }
    } else {
      this.current = (value - this.current) * this.multiplier + this.current;
    }

    return this.current;
  }

  get value(): number | null {
    return this.current;
  }

  get isReady(): boolean {
    return this.values.length >= this.period;
  }
}

export class EMACrossStrategy extends Strategy {
  private instrumentId: InstrumentId;
  private quantity: Quantity;
  private fastPeriod: number;
  private slowPeriod: number;
  private fastEMA: EMA;
  private slowEMA: EMA;
  private prevFast: number | null = null;
  private prevSlow: number | null = null;
  private isPositionOpen = false;

  constructor(
    id: string,
    instrumentId: InstrumentId,
    quantity: Quantity | string,
    fastPeriod = 9,
    slowPeriod = 21,
  ) {
    super(id);
    this.instrumentId = instrumentId;
    this.quantity = quantity instanceof Quantity ? quantity : Quantity.from(quantity);
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.fastEMA = new EMA(fastPeriod);
    this.slowEMA = new EMA(slowPeriod);
  }

  onStart(): void {
    this.log(`Starting EMA Cross (${this.fastPeriod}/${this.slowPeriod})`);
  }

  onBar(bar: Bar): void {
    const close = Number(bar.close.value);

    const fastVal = this.fastEMA.update(close);
    const slowVal = this.slowEMA.update(close);

    if (!this.fastEMA.isReady || !this.slowEMA.isReady) {
      return;
    }

    if (this.prevFast === null || this.prevSlow === null) {
      this.prevFast = fastVal;
      this.prevSlow = slowVal;
      return;
    }

    // Golden cross: fast crosses above slow
    const goldenCross = this.prevFast <= this.prevSlow && fastVal > slowVal;
    // Death cross: fast crosses below slow
    const deathCross = this.prevFast >= this.prevSlow && fastVal < slowVal;

    if (goldenCross && !this.isPositionOpen) {
      this.buyMarket(this.instrumentId, this.quantity);
      this.isPositionOpen = true;
      this.log(`GOLDEN CROSS: BUY @ ${bar.close}`);
    } else if (deathCross && this.isPositionOpen) {
      this.sellMarket(this.instrumentId, this.quantity);
      this.isPositionOpen = false;
      this.log(`DEATH CROSS: SELL @ ${bar.close}`);
    }

    this.prevFast = fastVal;
    this.prevSlow = slowVal;
  }

  onOrderFilled(order: Order): void {
    this.log(`Order filled: ${order.side} ${order.filledQty} @ ${order.avgPrice}`);
  }

  onStop(): void {
    this.log(`Stopping EMA Cross. Position: ${this.isPositionOpen ? 'OPEN' : 'FLAT'}`);
  }
}
