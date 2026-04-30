// 向后兼容：旧版 Strategy 已迁移至 strategy.ts（新框架包含组件状态机、数据订阅、风控等）
// 保留此类以兼容已有引用，但推荐使用新的 Strategy

import { Bar, TradeTick } from '../model/data.js';
import { Order, createOrder } from '../model/order.js';
import { InstrumentId, StrategyId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide, OrderType, TimeInForce } from '../core/enums.js';
import { MessageBus } from '../msgbus/bus.js';
import { BacktestEngine } from '../backtest/engine.js';

/**
 * @deprecated 请使用 `strategy.ts` 中的新 Strategy 基类
 */
export abstract class LegacyStrategy {
  public id: StrategyId;
  public engine: BacktestEngine | null = null;
  public msgbus: MessageBus | null = null;

  constructor(id: string) {
    this.id = StrategyId.from(id);
  }

  onStart(): void {}
  onStop(): void {}
  onBar(_bar: Bar): void {}
  onTrade(_trade: TradeTick): void {}
  onOrderFilled(_order: Order): void {}
  onOrderCancelled(_order: Order): void {}

  buyMarket(instrumentId: InstrumentId, quantity: Quantity | string): Order {
    const order = createOrder(this.id, instrumentId, OrderSide.Buy, OrderType.Market, quantity);
    this.engine!.submitOrder(order);
    return order;
  }

  sellMarket(instrumentId: InstrumentId, quantity: Quantity | string): Order {
    const order = createOrder(this.id, instrumentId, OrderSide.Sell, OrderType.Market, quantity);
    this.engine!.submitOrder(order);
    return order;
  }

  buyLimit(instrumentId: InstrumentId, quantity: Quantity | string, price: Price | string): Order {
    const order = createOrder(this.id, instrumentId, OrderSide.Buy, OrderType.Limit, quantity, price);
    this.engine!.submitOrder(order);
    return order;
  }

  sellLimit(instrumentId: InstrumentId, quantity: Quantity | string, price: Price | string): Order {
    const order = createOrder(this.id, instrumentId, OrderSide.Sell, OrderType.Limit, quantity, price);
    this.engine!.submitOrder(order);
    return order;
  }

  cancelOrder(clientOrderId: string): void {
    this.engine!.cancelOrder(clientOrderId);
  }

  log(message: string): void {
    console.log(`[${this.id.value}] ${message}`);
  }
}

// 保持旧名称以兼容已有引用
export { LegacyStrategy as Strategy };
