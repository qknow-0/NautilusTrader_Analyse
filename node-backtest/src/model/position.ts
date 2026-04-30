import Decimal from 'decimal.js';
import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { PositionSide } from '../core/enums.js';

export interface Position {
  instrumentId: InstrumentId;
  side: PositionSide;
  quantity: Quantity;
  avgEntryPrice: Price;
  avgExitPrice: Price | null;
  unrealizedPnl: Price | null;
  realizedPnl: Price;
  tsOpened: UnixNanos | null;
  tsClosed: UnixNanos | null;
  tsLastUpdate: UnixNanos | null;
}

export function createPosition(
  instrumentId: InstrumentId,
): Position {
  return {
    instrumentId,
    side: PositionSide.Flat,
    quantity: Quantity.from(0),
    avgEntryPrice: Price.from(0),
    avgExitPrice: null,
    unrealizedPnl: null,
    realizedPnl: Price.from(0),
    tsOpened: null,
    tsClosed: null,
    tsLastUpdate: null,
  };
}

export function openPosition(
  position: Position,
  quantity: Quantity,
  price: Price,
  tsEvent: UnixNanos,
): void {
  position.side = PositionSide.Long;
  position.quantity = quantity;
  position.avgEntryPrice = price;
  position.avgExitPrice = null;
  position.tsOpened = tsEvent;
  position.tsLastUpdate = tsEvent;
}

export function addToPosition(
  position: Position,
  quantity: Quantity,
  price: Price,
  tsEvent: UnixNanos,
): void {
  // Weighted average entry price
  const totalCost = position.avgEntryPrice.value
    .mul(position.quantity.value)
    .add(price.value.mul(quantity.value));
  const newQty = position.quantity.add(quantity);
  position.avgEntryPrice = new Price(totalCost.div(newQty.value));
  position.quantity = newQty;
  position.tsLastUpdate = tsEvent;
}

export function closePosition(
  position: Position,
  quantity: Quantity,
  price: Price,
  tsEvent: UnixNanos,
): { closedQty: Quantity; realizedPnl: Price } {
  const closedQty = Quantity.from(
    Decimal.min(quantity.value, position.quantity.value).toString(),
  );

  // Realized PnL = (exitPrice - entryPrice) * closedQty
  const pnlPerUnit = price.value.sub(position.avgEntryPrice.value);
  const realizedPnl = new Price(pnlPerUnit.mul(closedQty.value));

  position.realizedPnl = new Price(
    position.realizedPnl.value.add(realizedPnl.value),
  );
  position.avgExitPrice = price;
  position.quantity = position.quantity.sub(closedQty);
  position.tsLastUpdate = tsEvent;

  if (position.quantity.isZero()) {
    position.side = PositionSide.Flat;
    position.tsClosed = tsEvent;
  }

  return { closedQty, realizedPnl };
}

export function updateUnrealizedPnl(
  position: Position,
  currentPrice: Price,
): void {
  if (position.side === PositionSide.Flat) {
    position.unrealizedPnl = null;
    return;
  }

  const pnlPerUnit = currentPrice.value.sub(position.avgEntryPrice.value);
  position.unrealizedPnl = new Price(
    pnlPerUnit.mul(position.quantity.value),
  );
}

export function isPositionOpen(position: Position): boolean {
  return position.side !== PositionSide.Flat && !position.quantity.isZero();
}
