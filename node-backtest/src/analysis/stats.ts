import Decimal from 'decimal.js';

export interface PortfolioStats {
  realizedPnl: Map<string, Decimal>;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  sortinoRatio: number;
  totalReturn: number;
  avgTradeReturn: number;
}

// Simple portfolio statistics computation
export function computeStats(
  equityCurve: number[],
  _resultAggregator: any,
): PortfolioStats {
  const maxDrawdown = computeMaxDrawdown(equityCurve);
  const sharpeRatio = computeSharpeRatio(equityCurve);
  const sortinoRatio = computeSortinoRatio(equityCurve);
  const totalReturn = computeTotalReturn(equityCurve);

  return {
    realizedPnl: new Map(),
    maxDrawdown,
    sharpeRatio,
    winRate: 0, // Would need individual trade data
    profitFactor: 0, // Would need individual trade data
    sortinoRatio,
    totalReturn,
    avgTradeReturn: 0,
  };
}

function computeMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;

  let peak = equityCurve[0];
  let maxDrawdown = 0;

  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

function computeSharpeRatio(equityCurve: number[], riskFreeRate = 0): number {
  if (equityCurve.length < 2) return 0;

  const returns = computeReturns(equityCurve);
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - avgReturn) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualized (assuming daily data, 252 trading days)
  const dailyRiskFreeRate = riskFreeRate / 252;
  return ((avgReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(252);
}

function computeSortinoRatio(equityCurve: number[], riskFreeRate = 0): number {
  if (equityCurve.length < 2) return 0;

  const returns = computeReturns(equityCurve);
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downsideReturns = returns.filter((r) => r < 0);

  if (downsideReturns.length === 0) return 0;

  const downsideVariance =
    downsideReturns.reduce((acc, r) => acc + r ** 2, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  const dailyRiskFreeRate = riskFreeRate / 252;
  return ((avgReturn - dailyRiskFreeRate) / downsideDeviation) * Math.sqrt(252);
}

function computeTotalReturn(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  return (equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0];
}

function computeReturns(equityCurve: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1] !== 0) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
  }
  return returns;
}
