// 唐奇安通道突破策略 — 创新高买入、创新低卖出

import { Strategy } from './strategy.js';
import { Bar } from '../model/data.js';
import { Order } from '../model/order.js';
import { InstrumentId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';

// 突破策略配置接口
export interface BreakoutConfig {
  instrumentId: InstrumentId;         // 交易对 ID
  quantity: Quantity | string;        // 交易数量
  lookbackPeriod: number;             // 回看周期（用于计算最高价和最低价）
  trailingStopPct?: number;           // 移动止损比例
}

export class BreakoutStrategy extends Strategy {
  private brkConfig: BreakoutConfig;            // 突破配置
  private instrumentId: InstrumentId;           // 交易对 ID
  private quantity: Quantity;                   // 交易数量
  private highs: number[] = [];                 // 最高价窗口
  private lows: number[] = [];                  // 最低价窗口
  private trailingStop: number | null = null;   // 移动止损价格
  private isPositionOpen = false;               // 是否有未平仓持仓

  constructor(id: string, config: BreakoutConfig) {
    super(id);
    this.brkConfig = config;
    this.instrumentId = config.instrumentId;
    this.quantity = config.quantity instanceof Quantity
      ? config.quantity
      : Quantity.from(config.quantity);
  }

  protected override onStart(): void {
    super.onStart();
    this.log(`Breakout strategy: lookback=${this.brkConfig.lookbackPeriod}`);
  }

  // K 线回调 — 核心交易逻辑
  onBar(bar: Bar): void {
    super.onBar(bar);

    const high = Number(bar.high.value);
    const low = Number(bar.low.value);
    const close = Number(bar.close.value);

    // 记录最高价和最低价
    this.highs.push(high);
    this.lows.push(low);

    // 保持回看窗口大小
    if (this.highs.length > this.brkConfig.lookbackPeriod) {
      this.highs.shift();
      this.lows.shift();
    }

    // 数据不足，跳过
    if (this.highs.length < this.brkConfig.lookbackPeriod) return;

    // 计算唐奇安通道上下轨
    const highestHigh = Math.max(...this.highs);
    const lowestLow = Math.min(...this.lows);

    // 计算移动止损价
    const trailingStop = this.brkConfig.trailingStopPct
      ? close * (1 - this.brkConfig.trailingStopPct)
      : null;

    // 更新移动止损价（只升不降）
    if (trailingStop !== null) {
      this.trailingStop = this.trailingStop
        ? Math.max(this.trailingStop, trailingStop)
        : trailingStop;
    }

    // 突破最高价 → 买入
    if (close > highestHigh && !this.isPositionOpen) {
      this.buyMarket(this.instrumentId, this.quantity);
      this.isPositionOpen = true;
      this.log(`BREAKOUT: BUY @ ${close} (high=${highestHigh})`);
    }
    // 跌破最低价 → 卖出
    else if (close < lowestLow && this.isPositionOpen) {
      this.sellMarket(this.instrumentId, this.quantity);
      this.isPositionOpen = false;
      this.log(`BREAKDOWN: SELL @ ${close} (low=${lowestLow})`);
    }
    // 触发移动止损
    else if (
      this.isPositionOpen &&
      this.trailingStop !== null &&
      close < this.trailingStop
    ) {
      this.sellMarket(this.instrumentId, this.quantity);
      this.isPositionOpen = false;
      this.log(`TRAILING STOP @ ${close}`);
    }
  }

  // 订单成交回调
  onOrderFilled(order: Order): void {
    this.log(`Filled: ${order.side} qty=${order.filledQty}`);
  }

  protected override onReset(): void {
    super.onReset();
    this.highs = [];
    this.lows = [];
    this.trailingStop = null;
    this.isPositionOpen = false;
  }
}
