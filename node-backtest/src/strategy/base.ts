import { Bar, TradeTick } from '../model/data.js';
import { Order, createOrder } from '../model/order.js';
import { InstrumentId, StrategyId } from '../core/identifiers.js';
import { Price, Quantity } from '../core/types.js';
import { OrderSide, OrderType, TimeInForce } from '../core/enums.js';
import { MessageBus } from '../msgbus/bus.js';
import { BacktestEngine } from '../backtest/engine.js';

export abstract class Strategy {
  public id: StrategyId;
  public engine: BacktestEngine | null = null;
  public msgbus: MessageBus | null = null;

  constructor(id: string) {
    this.id = StrategyId.from(id);
  }

  // Lifecycle
  onStart(): void {}
  onStop(): void {}

  // Data callbacks
  onBar(_bar: Bar): void {}
  onTrade(_trade: TradeTick): void {}

  // Order callbacks
  onOrderFilled(_order: Order): void {}
  onOrderCancelled(_order: Order): void {}

  // Order submission helpers
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
