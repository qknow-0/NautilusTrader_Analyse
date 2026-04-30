// 风控引擎 — 订单提交前的预检查

import Decimal from 'decimal.js';
import { Order } from '../model/order.js';
import { Price, Quantity } from '../core/types.js';
import { Portfolio } from './portfolio.js';
import { InstrumentId } from '../core/identifiers.js';

// 风控限制接口
export interface RiskLimits {
  /** 单笔订单最大数量 */
  maxOrderQty?: Quantity;
  /** 单笔订单最大名义价值 */
  maxNotional?: Decimal;
  /** 每个标的物最大未平仓持仓数 */
  maxPositions?: number;
  /** 最大总敞口 */
  maxExposure?: Decimal;
}

export class RiskEngine {
  private portfolio: Portfolio;                            // 投资组合
  private limits: RiskLimits;                              // 风控限制
  private lastPrices: Map<string, Price>;                  // 最新价格映射

  constructor(
    portfolio: Portfolio,
    limits: RiskLimits = {},
    lastPrices: Map<string, Price> = new Map(),
  ) {
    this.portfolio = portfolio;
    this.limits = limits;
    this.lastPrices = lastPrices;
  }

  // 更新最新价格映射
  updatePrices(lastPrices: Map<string, Price>): void {
    this.lastPrices = lastPrices;
  }

  // 检查订单是否通过风控检查，返回错误信息或 null（通过）
  checkOrder(order: Order): string | null {
    // 最大数量检查
    if (this.limits.maxOrderQty && order.quantity.gt(this.limits.maxOrderQty)) {
      return `Order quantity ${order.quantity} exceeds max ${this.limits.maxOrderQty}`;
    }

    // 最大名义价值检查（数量 × 价格）
    if (this.limits.maxNotional && order.price) {
      const notional = order.quantity.value.mul(order.price.value);
      if (notional.gt(this.limits.maxNotional)) {
        return `Order notional ${notional} exceeds max ${this.limits.maxNotional}`;
      }
    }

    return null;  // 通过所有风控检查
  }

  // 检查增加持仓是否会超出限制
  checkExposure(instrumentId: InstrumentId, additionalQty: Quantity, price?: Price): string | null {
    const currentQty = this.portfolio.netPosition(instrumentId);
    const newQty = currentQty.add(additionalQty.value);

    // 最大持仓数检查
    if (this.limits.maxPositions) {
      // 简单检查：如果已有持仓且最大值为 1，则拒绝
      if (currentQty.abs().gt(0) && this.limits.maxPositions === 1) {
        return 'Already have open position, max positions exceeded';
      }
    }

    // 最大敞口检查
    if (this.limits.maxExposure && price) {
      const exposure = newQty.abs().mul(price.value);
      if (exposure.gt(this.limits.maxExposure)) {
        return `Exposure ${exposure} exceeds max ${this.limits.maxExposure}`;
      }
    }

    return null;  // 通过所有敞口检查
  }
}
