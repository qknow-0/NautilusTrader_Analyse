import { Price, Quantity } from '../core/types.js';
import { Order, applyFill, isOrderActive } from '../model/order.js';
import { Bar, TradeTick, isBar } from '../model/data.js';
import { OrderSide, OrderType } from '../core/enums.js';

// Simple matching engine for bar-driven and trade-driven execution
export class MatchingEngine {
  private pendingOrders: Order[] = [];

  addOrder(order: Order): void {
    this.pendingOrders.push(order);
  }

  // Process a bar and match pending orders against OHLC prices
  processBar(bar: Bar, onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void): void {
    const activeOrders = this.pendingOrders.filter(isOrderActive);

    for (const order of activeOrders) {
      if (order.instrumentId.toString() !== bar.instrumentId.toString()) continue;

      if (order.type === OrderType.Market) {
        this.fillMarketOrder(order, bar, onFill);
      } else if (order.type === OrderType.Limit && order.price) {
        this.fillLimitOrder(order, bar, onFill);
      }
    }
  }

  // Process a trade tick and match pending orders against trade prices
  processTradeTick(
    tick: TradeTick,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const activeOrders = this.pendingOrders.filter(isOrderActive);

    for (const order of activeOrders) {
      if (order.instrumentId.toString() !== tick.instrumentId.toString()) continue;

      if (order.type === OrderType.Market) {
        this.fillMarketOrderOnTrade(order, tick, onFill);
      } else if (order.type === OrderType.Limit && order.price) {
        this.fillLimitOrderOnTrade(order, tick, onFill);
      }
    }
  }

  private fillMarketOrder(
    order: Order,
    bar: Bar,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    // Market orders fill at Open price
    const fillPrice = bar.open;
    const fillQty = order.remainingQty;
    applyFill(order, fillQty, fillPrice, bar.tsEvent);
    onFill(order, fillPrice, fillQty);
  }

  private fillMarketOrderOnTrade(
    order: Order,
    tick: TradeTick,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const fillPrice = tick.price;
    const fillQty = Quantity.from(
      tick.size.value.lt(order.remainingQty.value)
        ? tick.size.value.toString()
        : order.remainingQty.value.toString(),
    );

    if (fillQty.isZero()) return;

    applyFill(order, fillQty, fillPrice, tick.tsEvent);
    onFill(order, fillPrice, fillQty);
  }

  private fillLimitOrder(
    order: Order,
    bar: Bar,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const limitPrice = order.price!;

    // For buy orders: fill if bar low <= limit price
    // For sell orders: fill if bar high >= limit price
    const canFill =
      (order.side === OrderSide.Buy && bar.low.le(limitPrice)) ||
      (order.side === OrderSide.Sell && bar.high.ge(limitPrice));

    if (!canFill) return;

    // Fill price is the better of limit price and bar price
    // Buy: fill at min(open, limit), Sell: fill at max(open, limit)
    const fillPrice =
      order.side === OrderSide.Buy
        ? bar.open.lt(limitPrice) ? bar.open : limitPrice
        : bar.open.gt(limitPrice) ? bar.open : limitPrice;

    const fillQty = order.remainingQty;
    applyFill(order, fillQty, fillPrice, bar.tsEvent);
    onFill(order, fillPrice, fillQty);
  }

  private fillLimitOrderOnTrade(
    order: Order,
    tick: TradeTick,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const limitPrice = order.price!;

    const canFill =
      (order.side === OrderSide.Buy && tick.price.le(limitPrice)) ||
      (order.side === OrderSide.Sell && tick.price.ge(limitPrice));

    if (!canFill) return;

    const fillQty = Quantity.from(
      tick.size.value.lt(order.remainingQty.value)
        ? tick.size.value.toString()
        : order.remainingQty.value.toString(),
    );

    if (fillQty.isZero()) return;

    applyFill(order, fillQty, limitPrice, tick.tsEvent);
    onFill(order, limitPrice, fillQty);
  }

  cancelOrder(clientOrderId: string): Order | null {
    const idx = this.pendingOrders.findIndex(
      (o) => o.clientId.value === clientOrderId,
    );
    if (idx < 0) return null;
    return this.pendingOrders.splice(idx, 1)[0];
  }

  getActiveOrders(): Order[] {
    return this.pendingOrders.filter(isOrderActive);
  }

  getAllOrders(): Order[] {
    return [...this.pendingOrders];
  }
}
