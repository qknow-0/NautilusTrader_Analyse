import { describe, it, expect } from 'vitest';
import { MatchingEngine } from '../src/engine/matching.js';
import { createOrder } from '../src/model/order.js';
import { createBar, createTradeTick } from '../src/model/data.js';
import { Price, Quantity, UnixNanos } from '../src/core/types.js';
import { InstrumentId, StrategyId } from '../src/core/identifiers.js';
import { OrderSide, OrderType, BarAggregation, AggressorSide } from '../src/core/enums.js';

const INSTRUMENT = InstrumentId.from('BTC-USDT.BINANCE');
const STRATEGY = StrategyId.from('TEST');

describe('MatchingEngine', () => {
  it('should fill market order at open price', () => {
    const engine = new MatchingEngine();
    const fills: any[] = [];

    const order = createOrder(STRATEGY, INSTRUMENT, OrderSide.Buy, OrderType.Market, '1');
    engine.addOrder(order);

    const bar = createBar(
      INSTRUMENT, 1, BarAggregation.Minute,
      '50000', '50100', '49900', '50050', '100',
      UnixNanos.fromMillis(1000), UnixNanos.fromMillis(1000),
    );

    engine.processBar(bar, (o, price, qty) => {
      fills.push({ price, qty });
    });

    expect(fills.length).toBe(1);
    expect(fills[0].price.toString()).toBe('50000'); // Open price
    expect(fills[0].qty.toString()).toBe('1');
    expect(order.status).toBe('FILLED');
  });

  it('should fill limit order when price is reached', () => {
    const engine = new MatchingEngine();
    const fills: any[] = [];

    const order = createOrder(STRATEGY, INSTRUMENT, OrderSide.Buy, OrderType.Limit, '1', '50000');
    engine.addOrder(order);

    // Bar where low goes below limit price
    const bar = createBar(
      INSTRUMENT, 1, BarAggregation.Minute,
      '50100', '50200', '49900', '50050', '100',
      UnixNanos.fromMillis(1000), UnixNanos.fromMillis(1000),
    );

    engine.processBar(bar, (o, price, qty) => {
      fills.push({ price, qty });
    });

    expect(fills.length).toBe(1);
    expect(order.status).toBe('FILLED');
  });

  it('should NOT fill limit order when price is not reached', () => {
    const engine = new MatchingEngine();
    const fills: any[] = [];

    const order = createOrder(STRATEGY, INSTRUMENT, OrderSide.Buy, OrderType.Limit, '1', '49800');
    engine.addOrder(order);

    // Bar where low stays above limit price
    const bar = createBar(
      INSTRUMENT, 1, BarAggregation.Minute,
      '50000', '50100', '49900', '50050', '100',
      UnixNanos.fromMillis(1000), UnixNanos.fromMillis(1000),
    );

    engine.processBar(bar, () => {
      fills.push(1);
    });

    expect(fills.length).toBe(0);
    // Order is not filled; status stays as INITIALIZED (matching engine doesn't change it to ACCEPTED)
    expect(order.status).not.toBe('FILLED');
  });

  it('should fill on trade tick', () => {
    const engine = new MatchingEngine();
    const fills: any[] = [];

    const order = createOrder(STRATEGY, INSTRUMENT, OrderSide.Buy, OrderType.Limit, '1', '50000');
    engine.addOrder(order);

    const tick = createTradeTick(
      INSTRUMENT, '49990', '0.5',
      AggressorSide.Buyer, 'T-001',
      UnixNanos.fromMillis(1000), UnixNanos.fromMillis(1000),
    );

    engine.processTradeTick(tick, (o, price, qty) => {
      fills.push({ price, qty });
    });

    expect(fills.length).toBe(1);
    expect(fills[0].price.toString()).toBe('50000'); // Limit price
    expect(fills[0].qty.toString()).toBe('0.5'); // Limited by tick size
  });
});
