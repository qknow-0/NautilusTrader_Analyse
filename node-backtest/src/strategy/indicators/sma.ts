// 简单移动平均线（SMA）

import { Indicator } from './base.js';

export class SMA extends Indicator {
  private sum = 0;  // 当前窗口内的值之和

  constructor(public period: number) {
    super();
  }

  // 更新 SMA 值
  update(value: number): number {
    this.values.push(value);
    this.sum += value;

    // 超出窗口时移除最早的值
    if (this.values.length > this.period) {
      this.sum -= this.values.shift()!;
    }

    return this.sum / this.values.length;  // 返回平均值
  }

  // SMA 就绪条件：数据量 ≥ period
  override get isReady(): boolean {
    return this.values.length >= this.period;
  }
}
