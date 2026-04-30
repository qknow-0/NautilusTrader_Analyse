import { MarketData, dataTsInit } from '../model/data.js';

// 数据源类：管理已排序的市场数据，供回测使用
export class DataFeed {
  // 市场数据数组（按 tsInit 升序排列）
  private data: MarketData[];
  // 当前读取位置游标
  private cursor: number;

  constructor(data: MarketData[]) {
    // 按 tsInit 升序排序
    this.data = [...data].sort((a, b) => {
      const diff = a.tsInit.value - b.tsInit.value;
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    this.cursor = 0;
  }

  // 获取下一条数据，游标前移；若无数据则返回 null
  next(): MarketData | null {
    if (this.cursor >= this.data.length) {
      return null;
    }
    return this.data[this.cursor++];
  }

  // 预览下一条数据，不移动游标
  peek(): MarketData | null {
    if (this.cursor >= this.data.length) {
      return null;
    }
    return this.data[this.cursor];
  }

  // 重置游标到起始位置
  reset(): void {
    this.cursor = 0;
  }

  // 数据总条数
  get length(): number {
    return this.data.length;
  }

  // 剩余未读取的数据条数
  get remaining(): number {
    return this.data.length - this.cursor;
  }

  // 回测进度（0~1）
  get progress(): number {
    return this.cursor / this.data.length;
  }
}
