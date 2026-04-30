// 平均真实波幅（ATR）

import { Indicator } from './base.js';

// OHLC 数据接口
interface OHLC {
  high: number;   // 最高价
  low: number;    // 最低价
  close: number;  // 收盘价
}

export class ATR {
  private values: number[] = [];            // ATR 历史值
  private prevClose: number | null = null;  // 前收盘价
  private atrValue: number | null = null;   // 当前 ATR 值

  constructor(public period = 14) {}

  // 更新 ATR 值
  update(ohlc: OHLC): number {
    const trueRange = this.calcTrueRange(ohlc);  // 计算真实波幅
    this.prevClose = ohlc.close;

    if (this.atrValue === null) {
      // 初始化阶段：累加真实波幅
      this.values.push(trueRange);
      if (this.values.length === this.period) {
        // 数据足够后取简单平均作为初始 ATR
        this.atrValue = this.values.reduce((a, b) => a + b, 0) / this.period;
      }
    } else {
      // 稳定阶段：使用 Wilder 平滑
      this.atrValue = ((this.atrValue * (this.period - 1)) + trueRange) / this.period;
      this.values.push(this.atrValue);
    }

    return this.atrValue ?? trueRange;  // 无 ATR 时返回当前真实波幅
  }

  // 获取当前 ATR 值
  get value(): number | null {
    return this.atrValue;
  }

  // ATR 就绪条件：数据量 ≥ period
  get isReady(): boolean {
    return this.values.length >= this.period;
  }

  // 获取 ATR 历史值
  get history(): ReadonlyArray<number> {
    return this.values;
  }

  // 重置 ATR 状态
  reset(): void {
    this.values = [];
    this.prevClose = null;
    this.atrValue = null;
  }

  // 计算真实波幅（True Range）
  // TR = max(最高价-最低价, |最高价-前收盘|, |最低价-前收盘|)
  private calcTrueRange(ohlc: OHLC): number {
    if (this.prevClose === null) {
      return ohlc.high - ohlc.low;  // 无前收盘价时只用当日振幅
    }
    return Math.max(
      ohlc.high - ohlc.low,
      Math.abs(ohlc.high - this.prevClose),
      Math.abs(ohlc.low - this.prevClose),
    );
  }
}
