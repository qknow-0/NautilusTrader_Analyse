import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../src/backtest/engine.js';
import { InstrumentId, Price, Quantity, UnixNanos } from '../src/index.js';
import { createBar } from '../src/model/data.js';
import { BarAggregation } from '../src/core/enums.js';
import Decimal from 'decimal.js';
import { Strategy } from '../src/strategy/base.js';
import { Bar } from '../src/model/data.js';

// Simple test strategy that buys on first bar
class BuyAndHoldStrategy extends Strategy {
  private bought = false;

  constructor(id: string) {
    super(id);
  }

  onBar(bar: Bar): void {
    if (!this.bought) {
      this.buyMarket(bar.instrumentId, Quantity.from('1'));
      this.bought = true;
    }
  }
}

describe('BacktestEngine', () => {
  it('should run a simple backtest', () => {
    const instrumentId = InstrumentId.from('BTC-USDT.BINANCE');

    const engine = new BacktestEngine({ traderId: 'TEST-001' });

    engine.addVenue({
      name: 'BINANCE',
      startingBalances: new Map([
        ['USDT', new Decimal(100000)],
      ]),
    });

    engine.addInstrument(instrumentId);

    // Create 10 bars of test data
    const bars = [];
    for (let i = 0; i < 10; i++) {
      const ts = UnixNanos.fromMillis(1000000 + i * 60000);
      bars.push(
        createBar(
          instrumentId, 1, BarAggregation.Minute,
          (50000 + i * 100).toString(),
          (50100 + i * 100).toString(),
          (49900 + i * 100).toString(),
          (50050 + i * 100).toString(),
          '100',
          ts, ts,
        ),
      );
    }

    engine.addData(bars);
    engine.addStrategy(new BuyAndHoldStrategy('BUY-HOLD'));

    const result = engine.run();

    expect(result.totalOrders).toBeGreaterThanOrEqual(1);
    expect(result.filledOrders).toBeGreaterThanOrEqual(1);
    expect(result.totalDataPoints).toBe(10);
    expect(result.runFinished).not.toBeNull();
  });
});
