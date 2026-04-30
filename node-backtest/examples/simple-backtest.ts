import Decimal from 'decimal.js';
import {
  BacktestEngine,
  InstrumentId,
  Price,
  Quantity,
  UnixNanos,
  BarAggregation,
  createBar,
  EMACrossStrategy,
  formatBacktestResult,
} from '../src/index.js';

// Generate synthetic 1-minute OHLC data
function generateBars(
  symbol: string,
  venue: string,
  startPrice: number,
  numBars: number,
  volatility: number,
): import('../src/index.js').Bar[] {
  const instrumentId = InstrumentId.from(`${symbol}.${venue}`);
  const bars: import('../src/index.js').Bar[] = [];

  let price = startPrice;
  // Use a deterministic pseudo-random sequence
  let seed = 42;
  function nextRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed / 2147483647) * 2 - 1; // [-1, 1]
  }

  const startTime = new Date('2024-01-01T00:00:00Z');

  for (let i = 0; i < numBars; i++) {
    const change = nextRandom() * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.abs(nextRandom()) * volatility * 0.5;
    const low = Math.min(open, close) - Math.abs(nextRandom()) * volatility * 0.5;
    const volume = 100 + Math.abs(nextRandom()) * 500;

    const ts = new Date(startTime.getTime() + i * 60_000); // 1-minute bars

    bars.push(
      createBar(
        instrumentId,
        1,
        BarAggregation.Minute,
        open.toFixed(2),
        high.toFixed(2),
        low.toFixed(2),
        close.toFixed(2),
        volume.toFixed(2),
        UnixNanos.fromDate(ts),
        UnixNanos.fromDate(ts),
      ),
    );

    price = close;
  }

  return bars;
}

// Setup and run backtest
function main() {
  console.log('NautilusTrader-style Node.js Backtest Engine\n');

  const instrumentId = InstrumentId.from('BTC-USDT.BINANCE');

  // 1. Create engine
  const engine = new BacktestEngine({ traderId: 'TRADER-001' });

  // 2. Add venue
  engine.addVenue({
    name: 'BINANCE',
    startingBalances: new Map([
      ['USDT', new Decimal(100000)], // 100,000 USDT starting balance
    ]),
  });

  // 3. Add instrument
  engine.addInstrument(instrumentId);

  // 4. Generate test data (1000 1-minute bars)
  const bars = generateBars('BTC-USDT', 'BINANCE', 50000, 1000, 100);
  engine.addData(bars);
  console.log(`Loaded ${bars.length} bars`);

  // 5. Add strategy
  const strategy = new EMACrossStrategy(
    'EMA-CROSS',
    instrumentId,
    Quantity.from('0.1'), // Trade 0.1 BTC
    9,   // Fast EMA
    21,  // Slow EMA
  );
  engine.addStrategy(strategy);

  // 6. Run backtest
  console.log('\nRunning backtest...\n');

  const startTime = UnixNanos.fromDate(new Date('2024-01-01T00:10:00Z')); // Skip first 10 min for warmup
  const endTime = UnixNanos.fromDate(new Date('2024-01-01T16:00:00Z'));

  const result = engine.run(startTime, endTime);

  // 7. Print results
  console.log(formatBacktestResult(result));
}

main();
