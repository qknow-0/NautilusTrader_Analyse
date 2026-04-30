// 投资组合 — 跟踪策略的持仓、盈亏和敞口

import Decimal from 'decimal.js';
import { StrategyCache } from './cache.js';
import { Position } from '../model/position.js';
import { InstrumentId, StrategyId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide, PositionSide } from '../core/enums.js';

export class Portfolio {
  private cache: StrategyCache;  // 策略缓存

  constructor(cache: StrategyCache) {
    this.cache = cache;
  }

  // 计算所有未平仓持仓的未实现盈亏总和
  unrealizedPnl(strategyId?: StrategyId): Decimal {
    let total = new Decimal(0);
    const positions = this.cache.positionsOpen(strategyId);
    for (const p of positions) {
      if (p.unrealizedPnl) {
        total = total.add(p.unrealizedPnl.value);
      }
    }
    return total;
  }

  // 计算所有持仓的已实现盈亏总和
  realizedPnl(strategyId?: StrategyId): Decimal {
    let total = new Decimal(0);
    const positions = this.cache.positionsOpen(strategyId);
    for (const p of positions) {
      total = total.add(p.realizedPnl.value);
    }
    return total;
  }

  // 获取标的物的净持仓数量（多头为正，空头为负）
  netPosition(instrumentId: InstrumentId): Decimal {
    const positions = this.cache.positionsOpen(undefined, instrumentId);
    let qty = new Decimal(0);
    for (const p of positions) {
      if (p.side === PositionSide.Long) {
        qty = qty.add(p.quantity.value);   // 多头累加
      } else {
        qty = qty.sub(p.quantity.value);   // 空头扣减
      }
    }
    return qty;
  }

  // 计算总敞口（所有持仓数量 × 最新价格的绝对值之和）
  totalExposure(lastPrices: Map<string, Price>, strategyId?: StrategyId): Decimal {
    let total = new Decimal(0);
    const positions = this.cache.positionsOpen(strategyId);
    for (const p of positions) {
      const price = lastPrices.get(p.instrumentId.toString());
      if (price) {
        total = total.add(p.quantity.value.mul(price.value));
      }
    }
    return total;
  }

  // 检查策略是否有未平仓持仓
  hasOpenPositions(strategyId?: StrategyId, instrumentId?: InstrumentId): boolean {
    return this.cache.positionsOpen(strategyId, instrumentId).length > 0;
  }

  // 获取所有未平仓持仓
  openPositions(strategyId?: StrategyId, instrumentId?: InstrumentId): Position[] {
    return this.cache.positionsOpen(strategyId, instrumentId);
  }
}
