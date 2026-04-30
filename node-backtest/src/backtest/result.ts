import { Order } from '../model/order.js';
import { Position } from '../model/position.js';
import { UnixNanos } from '../core/types.js';
import { MarketData } from '../model/data.js';

export interface BacktestResult {
  // Run metadata
  runStarted: Date | null;
  runFinished: Date | null;
  backtestStart: UnixNanos | null;
  backtestEnd: UnixNanos | null;
  durationMs: number;

  // Statistics
  totalDataPoints: number;
  totalOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  totalTrades: number;

  // Position stats
  positionsOpened: number;
  positionsClosed: number;

  // Account state
  finalBalances: Map<string, string>;

  // Performance
  totalRealizedPnl: Map<string, number>;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
}

export class ResultAggregator {
  private orders: Order[] = [];
  private positions: Position[] = [];
  private dataPoints = 0;
  private runStarted: Date | null = null;
  private runFinished: Date | null = null;
  private backtestStart: UnixNanos | null = null;
  private backtestEnd: UnixNanos | null = null;

  start(): void {
    this.runStarted = new Date();
  }

  stop(): void {
    this.runFinished = new Date();
  }

  setBacktestRange(start: UnixNanos, end: UnixNanos): void {
    this.backtestStart = start;
    this.backtestEnd = end;
  }

  recordDataPoint(): void {
    this.dataPoints++;
  }

  recordOrder(order: Order): void {
    this.orders.push(order);
  }

  recordPosition(position: Position): void {
    this.positions.push(position);
  }

  build(
    finalBalances: Map<string, string>,
    realizedPnl: Map<string, number>,
    maxDrawdown: number,
    sharpeRatio: number,
    winRate: number,
    profitFactor: number,
  ): BacktestResult {
    const filledOrders = this.orders.filter(
      (o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED',
    ).length;
    const cancelledOrders = this.orders.filter(
      (o) => o.status === 'CANCELLED',
    ).length;
    const positionsOpened = this.positions.filter(
      (p) => p.tsOpened !== null,
    ).length;
    const positionsClosed = this.positions.filter(
      (p) => p.tsClosed !== null,
    ).length;

    const durationMs =
      this.runStarted && this.runFinished
        ? this.runFinished.getTime() - this.runStarted.getTime()
        : 0;

    return {
      runStarted: this.runStarted,
      runFinished: this.runFinished,
      backtestStart: this.backtestStart,
      backtestEnd: this.backtestEnd,
      durationMs,
      totalDataPoints: this.dataPoints,
      totalOrders: this.orders.length,
      filledOrders,
      cancelledOrders,
      totalTrades: filledOrders,
      positionsOpened,
      positionsClosed,
      finalBalances,
      totalRealizedPnl: realizedPnl,
      maxDrawdown,
      sharpeRatio,
      winRate,
      profitFactor,
    };
  }
}

export function formatBacktestResult(result: BacktestResult): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push(' BACKTEST RESULT');
  lines.push('='.repeat(60));

  if (result.runStarted && result.runFinished) {
    lines.push(`Run time:     ${result.durationMs}ms`);
  }
  if (result.backtestStart && result.backtestEnd) {
    lines.push(
      `Backtest:     ${result.backtestStart.toDate().toISOString()} → ${result.backtestEnd.toDate().toISOString()}`,
    );
  }

  lines.push(`Data points:  ${result.totalDataPoints.toLocaleString()}`);
  lines.push(`Total orders: ${result.totalOrders}`);
  lines.push(`Filled:       ${result.filledOrders}`);
  lines.push(`Cancelled:    ${result.cancelledOrders}`);
  lines.push(`Positions:    ${result.positionsOpened} opened, ${result.positionsClosed} closed`);

  lines.push('');
  lines.push('--- Account Balances ---');
  for (const [currency, amount] of result.finalBalances) {
    lines.push(`  ${currency}: ${amount}`);
  }

  lines.push('');
  lines.push('--- Performance ---');
  for (const [currency, pnl] of result.totalRealizedPnl) {
    lines.push(`  Realized PnL (${currency}): ${pnl.toFixed(2)}`);
  }
  lines.push(`  Max Drawdown:   ${(result.maxDrawdown * 100).toFixed(2)}%`);
  lines.push(`  Sharpe Ratio:   ${result.sharpeRatio.toFixed(3)}`);
  lines.push(`  Win Rate:       ${(result.winRate * 100).toFixed(1)}%`);
  lines.push(`  Profit Factor:  ${result.profitFactor.toFixed(3)}`);

  lines.push('='.repeat(60));
  return lines.join('\n');
}
