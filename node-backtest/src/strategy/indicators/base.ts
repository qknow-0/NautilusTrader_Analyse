// 技术指标基类

export abstract class Indicator {
  protected values: number[] = [];  // 历史值数组

  // 抽象方法：子类实现具体的更新逻辑
  abstract update(value: number): number;

  // 获取最新值，无数据时返回 null
  get value(): number | null {
    if (this.values.length === 0) return null;
    return this.values[this.values.length - 1];
  }

  // 指标是否已就绪（有至少一个值）
  get isReady(): boolean {
    return this.values.length > 0;
  }

  // 获取只读历史值数组
  get history(): ReadonlyArray<number> {
    return this.values;
  }

  // 重置指标状态
  reset(): void {
    this.values = [];
  }
}
