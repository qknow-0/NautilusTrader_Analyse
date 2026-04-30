// EMA 交叉策略 — 使用新的 Strategy 基类

import { Strategy } from './strategy.js';
import { EMA } from './indicators/ema.js';
import { Bar } from '../model/data.js';
import { Order } from '../model/order.js';
import { InstrumentId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide } from '../core/enums.js';

/**
 * EMA 交叉策略
 *
 * 当短期 EMA 从下方穿越长期 EMA 时（金叉），开仓买入；
 * 当短期 EMA 从上方穿越长期 EMA 时（死叉），平仓卖出。
 */
export class EMACrossStrategy extends Strategy {
  /** 交易品种标识 */
  private instrumentId: InstrumentId;
  /** 下单数量 */
  private quantity: Quantity;
  /** 短期 EMA 指标 */
  private fastEMA: EMA;
  /** 长期 EMA 指标 */
  private slowEMA: EMA;
  /** 上一根 K 线时，快线是否在慢线之上 */
  private prevFastAbove: boolean | null = null;
  /** 当前是否持有仓位 */
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
    this.fastEMA = new EMA(fastPeriod);
    this.slowEMA = new EMA(slowPeriod);
  }

  /** 策略启动，打印参数信息 */
  protected override onStart(): void {
    super.onStart();
    this.log(`EMA Cross ${this.fastEMA.period}/${this.slowEMA.period} on ${this.instrumentId}`);
  }

  /** 策略停止，打印当前仓位状态 */
  protected override onStop(): void {
    super.onStop();
    this.log(`Position at stop: ${this.isPositionOpen ? 'OPEN' : 'FLAT'}`);
  }

  /**
   * 处理每根 K 线
   *
   * 用收盘价更新两条 EMA，检测交叉信号并执行交易。
   */
  onBar(bar: Bar): void {
    // 通知父类处理 K 线数据
    super.onBar(bar);

    const close = Number(bar.close.value);
    const fastVal = this.fastEMA.update(close);
    const slowVal = this.slowEMA.update(close);

    // EMA 尚未预热完成，跳过交易信号判断
    if (!this.fastEMA.isReady || !this.slowEMA.isReady) return;

    // 当前快线是否在慢线之上
    const fastAbove = fastVal > slowVal;

    if (this.prevFastAbove !== null) {
      // 金叉：快线从下方穿越慢线 -> 买入开仓
      if (fastAbove && !this.prevFastAbove && !this.isPositionOpen) {
        this.buyMarket(this.instrumentId, this.quantity);
        this.isPositionOpen = true;
        this.log(`GOLDEN CROSS: BUY @ ${bar.close}`);
      // 死叉：快线从上方穿越慢线 -> 卖出平仓
      } else if (!fastAbove && this.prevFastAbove && this.isPositionOpen) {
        this.sellMarket(this.instrumentId, this.quantity);
        this.isPositionOpen = false;
        this.log(`DEATH CROSS: SELL @ ${bar.close}`);
      }
    }

    // 记录当前状态，作为下次交叉判断的基准
    this.prevFastAbove = fastAbove;
  }

  /** 订单成交回调，记录成交详情 */
  onOrderFilled(order: Order): void {
    this.log(`Filled: ${order.side} qty=${order.filledQty}`);
  }
}
