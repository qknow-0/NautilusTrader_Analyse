import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId, ClientOrderId, StrategyId } from '../core/identifiers.js';
import { OrderSide, OrderStatus, OrderType, TimeInForce } from '../core/enums.js';

export interface Order {
  clientId: ClientOrderId;
  strategyId: StrategyId;
  instrumentId: InstrumentId;
  side: OrderSide;
  type: OrderType;
  quantity: Quantity;
  price?: Price; // For limit orders
  timeInForce: TimeInForce;
  status: OrderStatus;
  filledQty: Quantity;
  avgPrice: Price;
  remainingQty: Quantity;
  tsInit: UnixNanos;
  tsLast: UnixNanos | null;
  reduceOnly: boolean;
}

export function createOrder(
  strategyId: StrategyId,
  instrumentId: InstrumentId,
  side: OrderSide,
  type: OrderType,
  quantity: Quantity | string,
  price?: Price | string,
  timeInForce: TimeInForce = TimeInForce.Gtc,
  tsInit?: UnixNanos,
  reduceOnly = false,
): Order {
  const qty = quantity instanceof Quantity ? quantity : Quantity.from(quantity);
  const p = price
    ? price instanceof Price
      ? price
      : Price.from(price)
    : undefined;

  return {
    clientId: ClientOrderId.generate(strategyId.value),
    strategyId,
    instrumentId,
    side,
    type,
    quantity: qty,
    price: p,
    timeInForce,
    status: OrderStatus.Initialized,
    filledQty: Quantity.from(0),
    avgPrice: Price.from(0),
    remainingQty: qty,
    tsInit: tsInit ?? UnixNanos.fromMillis(Date.now()),
    tsLast: null,
    reduceOnly,
  };
}

export function applyFill(
  order: Order,
  fillQty: Quantity | string,
  fillPrice: Price | string,
  tsEvent: UnixNanos,
): void {
  const fQty = fillQty instanceof Quantity ? fillQty : Quantity.from(fillQty);
  const fPrice = fillPrice instanceof Price ? fillPrice : Price.from(fillPrice);

  // Update average fill price
  const totalCost = order.avgPrice.value.mul(order.filledQty.value).add(fPrice.value.mul(fQty.value));
  const newFilled = order.filledQty.add(fQty);
  order.avgPrice = new Price(totalCost.div(newFilled.value));
  order.filledQty = newFilled;
  order.remainingQty = order.quantity.sub(newFilled);
  order.tsLast = tsEvent;

  if (order.remainingQty.isZero()) {
    order.status = OrderStatus.Filled;
  } else {
    order.status = OrderStatus.PartiallyFilled;
  }
}

export function isOrderActive(order: Order): boolean {
  return (
    order.status === OrderStatus.Initialized ||
    order.status === OrderStatus.Accepted ||
    order.status === OrderStatus.PartiallyFilled
  );
}
