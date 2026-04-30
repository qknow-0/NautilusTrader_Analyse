import { Order } from '../model/order.js';
import { Position } from '../model/position.js';
import { UnixNanos } from '../core/types.js';
import { MarketData } from '../model/data.js';

// 回测结果接口：记录回测运行的元数据和统计信息
export interface BacktestResult {
  // 运行元数据
  runStarted: Date | null;        // 回测开始时间（Wall clock）
  runFinished: Date | null;       // 回测结束时间（Wall clock）
  backtestStart: UnixNanos | null; // 回测数据范围起点
  backtestEnd: UnixNanos | null;   // 回测数据范围终点
  durationMs: number;             // 回测运行耗时（毫秒）

  // 统计信息
  totalDataPoints: number;        // 处理的数据点总数
  totalOrders: number;            // 订单总数
  filledOrders: number;           // 已成交订单数
  cancelledOrders: number;        // 已取消订单数
  totalTrades: number;            // 成交笔数

  // 持仓统计
  positionsOpened: number;        // 开仓次数
  positionsClosed: number;        // 平仓次数

  // 账户状态
  finalBalances: Map<string, string>; // 各币种最终余额

  // 绩效指标
  totalRealizedPnl: Map<string, number>; // 各币种已实现盈亏
  maxDrawdown: number;            // 最大回撤
  sharpeRatio: number;            // 夏普比率
  winRate: number;                // 胜率
  profitFactor: number;           // 盈亏比
}

// 结果聚合器：在回测运行期间收集各项数据，最终构建 BacktestResult
export class ResultAggregator {
  private orders: Order[] = [];           // 所有订单记录
  private positions: Position[] = [];     // 所有持仓记录
  private dataPoints = 0;                 // 已处理数据点计数
  private runStarted: Date | null = null; // 运行开始时间
  private runFinished: Date | null = null; // 运行结束时间
  private backtestStart: UnixNanos | null = null; // 回测数据范围起点
  private backtestEnd: UnixNanos | null = null;   // 回测数据范围终点

  // 标记回测运行开始
  start(): void {
    this.runStarted = new Date();
  }

  // 标记回测运行结束
  stop(): void {
    this.runFinished = new Date();
  }

  // 设置回测数据时间范围
  setBacktestRange(start: UnixNanos, end: UnixNanos): void {
    this.backtestStart = start;
    this.backtestEnd = end;
  }

  // 记录一个已处理的数据点
  recordDataPoint(): void {
    this.dataPoints++;
  }

  // 记录一笔订单
  recordOrder(order: Order): void {
    this.orders.push(order);
  }

  // 记录一个持仓
  recordPosition(position: Position): void {
    this.positions.push(position);
  }

  // 构建最终回测结果
  build(
    finalBalances: Map<string, string>,    // 最终账户余额
    realizedPnl: Map<string, number>,      // 已实现盈亏
    maxDrawdown: number,                   // 最大回撤
    sharpeRatio: number,                   // 夏普比率
    winRate: number,                       // 胜率
    profitFactor: number,                  // 盈亏比
  ): BacktestResult {
    // 统计已成交和已取消订单数
    const filledOrders = this.orders.filter(
      (o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED',
    ).length;
    const cancelledOrders = this.orders.filter(
      (o) => o.status === 'CANCELLED',
    ).length;
    // 统计开仓和平仓次数
    const positionsOpened = this.positions.filter(
      (p) => p.tsOpened !== null,
    ).length;
    const positionsClosed = this.positions.filter(
      (p) => p.tsClosed !== null,
    ).length;

    // 计算运行耗时
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

// 格式化回测结果为可读文本
export function formatBacktestResult(result: BacktestResult): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push(' BACKTEST RESULT');
  lines.push('='.repeat(60));

  // 运行时间
  if (result.runStarted && result.runFinished) {
    lines.push(`Run time:     ${result.durationMs}ms`);
  }
  // 回测数据范围
  if (result.backtestStart && result.backtestEnd) {
    lines.push(
      `Backtest:     ${result.backtestStart.toDate().toISOString()} → ${result.backtestEnd.toDate().toISOString()}`,
    );
  }

  // 数据与订单统计
  lines.push(`Data points:  ${result.totalDataPoints.toLocaleString()}`);
  lines.push(`Total orders: ${result.totalOrders}`);
  lines.push(`Filled:       ${result.filledOrders}`);
  lines.push(`Cancelled:    ${result.cancelledOrders}`);
  lines.push(`Positions:    ${result.positionsOpened} opened, ${result.positionsClosed} closed`);

  // 账户余额
  lines.push('');
  lines.push('--- Account Balances ---');
  for (const [currency, amount] of result.finalBalances) {
    lines.push(`  ${currency}: ${amount}`);
  }

  // 绩效指标
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
