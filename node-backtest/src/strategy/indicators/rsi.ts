// 相对强弱指标（RSI）

import { Indicator } from './base.js';

export class RSI extends Indicator {
  private avgGain = 0;              // 平均涨幅
  private avgLoss = 0;              // 平均跌幅
  private prevValue: number | null = null;  // 前一个值

  constructor(public period = 14) {
    super();
  }

  // 更新 RSI 值
  update(value: number): number {
    this.values.push(value);

    if (this.prevValue !== null) {
      const change = value - this.prevValue;
      const gain = change > 0 ? change : 0;    // 只记录正变化
      const loss = change < 0 ? -change : 0;   // 只记录负变化（取绝对值）

      // 初始化阶段：使用累计平均
      if (this.values.length <= this.period + 1) {
        this.avgGain = (this.avgGain * (this.values.length - 2) + gain) / (this.values.length - 1);
        this.avgLoss = (this.avgLoss * (this.values.length - 2) + loss) / (this.values.length - 1);
      } else {
        // 稳定阶段：使用 Wilder 平滑（EMA 风格）
        this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
        this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
      }
    }

    this.prevValue = value;
    return this.value ?? 50;  // 无有效值时返回 50（中性）
  }

  // 计算 RSI 值：RSI = 100 - 100 / (1 + RS)
  override get value(): number | null {
    if (this.avgLoss === 0) return 100;  // 无跌幅，RSI 为满分
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // RSI 就绪条件：数据量 > period
  override get isReady(): boolean {
    return this.values.length > this.period;
  }

  // 重置 RSI 状态
  override reset(): void {
    super.reset();
    this.avgGain = 0;
    this.avgLoss = 0;
    this.prevValue = null;
  }
}
