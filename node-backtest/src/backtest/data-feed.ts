import { MarketData, dataTsInit } from '../model/data.js';

// Data feed that manages sorted market data for backtesting
export class DataFeed {
  private data: MarketData[];
  private cursor: number;

  constructor(data: MarketData[]) {
    // Sort by ts_init
    this.data = [...data].sort((a, b) => {
      const diff = a.tsInit.value - b.tsInit.value;
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    this.cursor = 0;
  }

  // Get next data point
  next(): MarketData | null {
    if (this.cursor >= this.data.length) {
      return null;
    }
    return this.data[this.cursor++];
  }

  // Peek at next data point without advancing
  peek(): MarketData | null {
    if (this.cursor >= this.data.length) {
      return null;
    }
    return this.data[this.cursor];
  }

  // Reset to beginning
  reset(): void {
    this.cursor = 0;
  }

  get length(): number {
    return this.data.length;
  }

  get remaining(): number {
    return this.data.length - this.cursor;
  }

  get progress(): number {
    return this.cursor / this.data.length;
  }
}
