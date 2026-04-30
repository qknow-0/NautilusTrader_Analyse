import Decimal from 'decimal.js';

/** 投资组合绩效统计指标 */
export interface PortfolioStats {
  /** 已实现盈亏，按品种分组的映射 */
  realizedPnl: Map<string, Decimal>;
  /** 最大回撤（0~1 之间的比例） */
  maxDrawdown: number;
  /** 夏普比率（年化） */
  sharpeRatio: number;
  /** 胜率（0~1 之间） */
  winRate: number;
  /** 盈亏比（总盈利 / 总亏损） */
  profitFactor: number;
  /** 索提诺比率（年化） */
  sortinoRatio: number;
  /** 总收益率 */
  totalReturn: number;
  /** 平均单笔收益率 */
  avgTradeReturn: number;
}

/**
 * 计算投资组合绩效统计
 *
 * @param equityCurve 权益曲线，每个时间点的账户净值
 * @param _resultAggregator 结果聚合器（暂未使用，用于获取单笔交易数据）
 * @returns 绩效统计指标
 */
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
    winRate: 0, // 需要单笔交易数据才能计算
    profitFactor: 0, // 需要单笔交易数据才能计算
    sortinoRatio,
    totalReturn,
    avgTradeReturn: 0, // 需要单笔交易数据才能计算
  };
}

/**
 * 计算最大回撤
 *
 * 遍历权益曲线，记录历史最高点和从最高点下跌的最大幅度。
 * 返回值为回撤比例（0~1）。
 */
function computeMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;

  let peak = equityCurve[0];  // 历史最高点
  let maxDrawdown = 0;        // 最大回撤比例

  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;  // 更新历史最高点
    }
    const drawdown = (peak - equity) / peak;  // 当前回撤比例
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;  // 更新最大回撤
    }
  }

  return maxDrawdown;
}

/**
 * 计算夏普比率（Sharpe Ratio）
 *
 * 公式: (平均收益率 - 无风险收益率) / 收益率标准差 * sqrt(年化因子)
 * 假设日频数据，年化因子 = 252（交易日数量）。
 *
 * @param equityCurve 权益曲线
 * @param riskFreeRate 年化无风险利率，默认 0
 */
function computeSharpeRatio(equityCurve: number[], riskFreeRate = 0): number {
  if (equityCurve.length < 2) return 0;

  const returns = computeReturns(equityCurve);
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  // 样本方差（除以 n-1）
  const variance = returns.reduce((acc, r) => acc + (r - avgReturn) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // 将年化无风险利率折算为日频
  const dailyRiskFreeRate = riskFreeRate / 252;
  // 年化夏普比率
  return ((avgReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(252);
}

/**
 * 计算索提诺比率（Sortino Ratio）
 *
 * 与夏普比率类似，但分母只使用下行波动率（负收益的标准差），
 * 因此只惩罚下行风险。
 *
 * @param equityCurve 权益曲线
 * @param riskFreeRate 年化无风险利率，默认 0
 */
function computeSortinoRatio(equityCurve: number[], riskFreeRate = 0): number {
  if (equityCurve.length < 2) return 0;

  const returns = computeReturns(equityCurve);
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  // 只取负收益（下行收益）
  const downsideReturns = returns.filter((r) => r < 0);

  if (downsideReturns.length === 0) return 0;  // 无亏损交易，无法计算下行波动

  // 下行方差 = 下行收益平方和 / 总样本数
  const downsideVariance =
    downsideReturns.reduce((acc, r) => acc + r ** 2, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  const dailyRiskFreeRate = riskFreeRate / 252;
  return ((avgReturn - dailyRiskFreeRate) / downsideDeviation) * Math.sqrt(252);
}

/**
 * 计算总收益率
 *
 * 公式: (期末净值 - 期初净值) / 期初净值
 */
function computeTotalReturn(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  return (equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0];
}

/**
 * 从权益曲线计算逐期收益率序列
 *
 * 公式: return_i = (equity_i - equity_{i-1}) / equity_{i-1}
 * 跳过期初净值为 0 的情况，避免除以零。
 */
function computeReturns(equityCurve: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1] !== 0) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
  }
  return returns;
}
