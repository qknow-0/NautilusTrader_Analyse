import Decimal from 'decimal.js';
import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { PositionSide } from '../core/enums.js';

// 持仓接口，跟踪一个合约的持仓状态
export interface Position {
  instrumentId: InstrumentId;   // 交易对/合约 ID
  side: PositionSide;           // 持仓方向（多/空/平）
  quantity: Quantity;           // 当前持仓数量
  avgEntryPrice: Price;         // 加权平均开仓价格
  avgExitPrice: Price | null;   // 加权平均平仓价格（未平仓时为 null）
  unrealizedPnl: Price | null;  // 未实现盈亏（未平仓时为 null）
  realizedPnl: Price;           // 已实现盈亏
  tsOpened: UnixNanos | null;   // 开仓时间戳
  tsClosed: UnixNanos | null;   // 平仓时间戳
  tsLastUpdate: UnixNanos | null;  // 最后一次更新时间戳
}

// 创建一个空持仓
export function createPosition(
  instrumentId: InstrumentId,  // 交易对/合约 ID
): Position {
  return {
    instrumentId,
    side: PositionSide.Flat,         // 初始方向为平
    quantity: Quantity.from(0),      // 初始数量为 0
    avgEntryPrice: Price.from(0),    // 初始均价为 0
    avgExitPrice: null,              // 尚无平仓价格
    unrealizedPnl: null,             // 尚无未实现盈亏
    realizedPnl: Price.from(0),      // 初始已实现盈亏为 0
    tsOpened: null,                  // 尚未开仓
    tsClosed: null,                  // 尚未平仓
    tsLastUpdate: null,              // 尚无更新记录
  };
}

// 开仓（建立新的多头持仓）
export function openPosition(
  position: Position,     // 目标持仓
  quantity: Quantity,     // 开仓数量
  price: Price,           // 开仓价格
  tsEvent: UnixNanos,     // 事件时间戳
): void {
  position.side = PositionSide.Long;        // 设为多头方向
  position.quantity = quantity;             // 设置持仓数量
  position.avgEntryPrice = price;           // 设置开仓均价
  position.avgExitPrice = null;             // 清除平仓价格
  position.tsOpened = tsEvent;              // 记录开仓时间
  position.tsLastUpdate = tsEvent;          // 更新最后操作时间
}

// 加仓（在已有持仓基础上追加）
export function addToPosition(
  position: Position,     // 目标持仓
  quantity: Quantity,     // 追加数量
  price: Price,           // 追加价格
  tsEvent: UnixNanos,     // 事件时间戳
): void {
  // 计算加权平均开仓价：(旧均价 * 旧数量 + 新价格 * 新数量) / 新总数量
  const totalCost = position.avgEntryPrice.value
    .mul(position.quantity.value)
    .add(price.value.mul(quantity.value));
  const newQty = position.quantity.add(quantity);
  position.avgEntryPrice = new Price(totalCost.div(newQty.value));
  position.quantity = newQty;
  position.tsLastUpdate = tsEvent;
}

// 平仓（减少或全部平掉持仓）
export function closePosition(
  position: Position,     // 目标持仓
  quantity: Quantity,     // 平仓数量
  price: Price,           // 平仓价格
  tsEvent: UnixNanos,     // 事件时间戳
): { closedQty: Quantity; realizedPnl: Price } {
  // 实际平仓数量取平仓请求数量与当前持仓数量的较小值
  const closedQty = Quantity.from(
    Decimal.min(quantity.value, position.quantity.value).toString(),
  );

  // 计算已实现盈亏 = (平仓价 - 开仓均价) * 实际平仓数量
  const pnlPerUnit = price.value.sub(position.avgEntryPrice.value);
  const realizedPnl = new Price(pnlPerUnit.mul(closedQty.value));

  // 累加到已实现盈亏总额
  position.realizedPnl = new Price(
    position.realizedPnl.value.add(realizedPnl.value),
  );
  position.avgExitPrice = price;                // 记录平仓价格
  position.quantity = position.quantity.sub(closedQty);  // 减少持仓数量
  position.tsLastUpdate = tsEvent;              // 更新最后操作时间

  // 如果持仓数量归零，标记为完全平仓
  if (position.quantity.isZero()) {
    position.side = PositionSide.Flat;
    position.tsClosed = tsEvent;
  }

  return { closedQty, realizedPnl };
}

// 更新未实现盈亏（根据当前市场价格计算）
export function updateUnrealizedPnl(
  position: Position,     // 目标持仓
  currentPrice: Price,    // 当前市场价格
): void {
  // 如果当前无持仓，清除未实现盈亏
  if (position.side === PositionSide.Flat) {
    position.unrealizedPnl = null;
    return;
  }

  // 未实现盈亏 = (当前价格 - 开仓均价) * 持仓数量
  const pnlPerUnit = currentPrice.value.sub(position.avgEntryPrice.value);
  position.unrealizedPnl = new Price(
    pnlPerUnit.mul(position.quantity.value),
  );
}

// 判断持仓是否仍处于开启状态
export function isPositionOpen(position: Position): boolean {
  return position.side !== PositionSide.Flat && !position.quantity.isZero();
}
