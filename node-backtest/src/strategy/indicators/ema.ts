// 指数移动平均线（EMA）

import { Indicator } from './base.js';

export class EMA extends Indicator {
  private current: number | null = null;  // 当前 EMA 值
  private multiplier: number;             // EMA 平滑系数 = 2 / (period + 1)

  constructor(public period: number) {
    super();
    this.multiplier = 2 / (period + 1);  // 计算平滑系数
  }

  // 更新 EMA 值
  update(value: number): number {
    this.values.push(value);

    if (this.current === null) {
      // 初始化阶段：数据不足 period 时用简单平均
      if (this.values.length < this.period) {
        this.current = this.values.reduce((a, b) => a + b, 0) / this.values.length;
      } else {
        // 数据足够后使用最新值作为初始 EMA
        this.current = value;
      }
    } else {
      // EMA = (当前值 - 前 EMA) × 平滑系数 + 前 EMA
      this.current = (value - this.current) * this.multiplier + this.current;
    }

    return this.current;
  }

  // EMA 就绪条件：数据量 ≥ period
  override get isReady(): boolean {
    return this.values.length >= this.period;
  }
}
