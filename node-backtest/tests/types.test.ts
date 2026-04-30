import { describe, it, expect } from 'vitest';
import { Price, Quantity, UnixNanos } from '../src/core/types.js';
import { InstrumentId, Venue, Symbol } from '../src/core/identifiers.js';

describe('UnixNanos', () => {
  it('should convert from and to Date', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const ts = UnixNanos.fromDate(date);
    expect(ts.toDate().getTime()).toBe(date.getTime());
  });

  it('should compare timestamps correctly', () => {
    const a = UnixNanos.fromSeconds(1000);
    const b = UnixNanos.fromSeconds(2000);
    expect(a.lt(b)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(a.eq(a)).toBe(true);
  });
});

describe('Price', () => {
  it('should create from string', () => {
    const p = Price.from('100.50');
    expect(p.toString()).toBe('100.5');
  });

  it('should perform arithmetic correctly', () => {
    const a = Price.from('100');
    const b = Price.from('50');
    expect(a.add(b).toString()).toBe('150');
    expect(a.sub(b).toString()).toBe('50');
  });

  it('should compare prices correctly', () => {
    const a = Price.from('100.50');
    const b = Price.from('100.49');
    expect(a.gt(b)).toBe(true);
    expect(a.ge(b)).toBe(true);
    expect(b.lt(a)).toBe(true);
    expect(b.le(a)).toBe(true);
  });
});

describe('Quantity', () => {
  it('should create from string', () => {
    const q = Quantity.from('0.001');
    expect(q.toString()).toBe('0.001');
  });

  it('should perform arithmetic correctly', () => {
    const a = Quantity.from('1.5');
    const b = Quantity.from('0.5');
    expect(a.add(b).toString()).toBe('2');
    expect(a.sub(b).toString()).toBe('1');
    expect(a.mul(2).toString()).toBe('3');
  });
});

describe('InstrumentId', () => {
  it('should parse from string', () => {
    const id = InstrumentId.from('BTC-USDT.BINANCE');
    expect(id.symbol.value).toBe('BTC-USDT');
    expect(id.venue.value).toBe('BINANCE');
  });

  it('should format correctly', () => {
    const id = InstrumentId.from('ETH-USDT.OKX');
    expect(id.toString()).toBe('ETH-USDT.OKX');
  });
});
