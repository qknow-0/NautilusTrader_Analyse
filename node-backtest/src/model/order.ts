import { Price, Quantity, UnixNanos } from '../core/types.js';
import { InstrumentId, ClientOrderId, StrategyId } from '../core/identifiers.js';
import { OrderSide, OrderStatus, OrderType, TimeInForce } from '../core/enums.js';

// 订单接口，描述一个订单的完整状态
export interface Order {
  clientId: ClientOrderId;      // 客户端订单 ID（唯一标识）
  strategyId: StrategyId;       // 发起订单的策略 ID
  instrumentId: InstrumentId;   // 交易对/合约 ID
  side: OrderSide;              // 订单方向（买入/卖出）
  type: OrderType;              // 订单类型（市价/限价等）
  quantity: Quantity;           // 订单总数量
  price?: Price;                // 限价价格（仅限价订单使用）
  timeInForce: TimeInForce;     // 有效期限策略
  status: OrderStatus;          // 当前订单状态
  filledQty: Quantity;          // 已成交数量
  avgPrice: Price;              // 加权平均成交价
  remainingQty: Quantity;       // 剩余未成交数量
  tsInit: UnixNanos;            // 订单初始化时间戳
  tsLast: UnixNanos | null;     // 最后一次更新时间戳
  reduceOnly: boolean;          // 是否仅减仓（不允许反向开仓）
}

// 创建订单
export function createOrder(
  strategyId: StrategyId,                    // 策略 ID
  instrumentId: InstrumentId,                // 交易对/合约 ID
  side: OrderSide,                           // 订单方向
  type: OrderType,                           // 订单类型
  quantity: Quantity | string,               // 订单数量（可为字符串自动转换）
  price?: Price | string,                    // 限价价格（可选）
  timeInForce: TimeInForce = TimeInForce.Gtc, // 有效期限策略，默认 GTC
  tsInit?: UnixNanos,                        // 初始化时间戳，默认当前时间
  reduceOnly = false,                        // 是否仅减仓，默认 false
): Order {
  // 将输入的数量统一转为 Quantity 类型
  const qty = quantity instanceof Quantity ? quantity : Quantity.from(quantity);
  // 将输入的价格统一转为 Price 类型（如果提供了价格参数）
  const p = price
    ? price instanceof Price
      ? price
      : Price.from(price)
    : undefined;

  return {
    clientId: ClientOrderId.generate(strategyId.value),  // 自动生成唯一订单 ID
    strategyId,
    instrumentId,
    side,
    type,
    quantity: qty,
    price: p,
    timeInForce,
    status: OrderStatus.Initialized,   // 初始状态
    filledQty: Quantity.from(0),       // 初始已成交为 0
    avgPrice: Price.from(0),           // 初始均价为 0
    remainingQty: qty,                 // 剩余数量等于总数量
    tsInit: tsInit ?? UnixNanos.fromMillis(Date.now()),  // 默认当前时间
    tsLast: null,                      // 尚无更新记录
    reduceOnly,
  };
}

// 应用成交（更新订单的成交状态）
export function applyFill(
  order: Order,                 // 目标订单
  fillQty: Quantity | string,   // 本次成交数量
  fillPrice: Price | string,    // 本次成交价格
  tsEvent: UnixNanos,           // 事件时间戳
): void {
  // 统一转为 Quantity/Price 类型
  const fQty = fillQty instanceof Quantity ? fillQty : Quantity.from(fillQty);
  const fPrice = fillPrice instanceof Price ? fillPrice : Price.from(fillPrice);

  // 计算新的加权平均成交价：(旧均价 * 旧已成交 + 新价格 * 新成交) / 新总已成交
  const totalCost = order.avgPrice.value.mul(order.filledQty.value).add(fPrice.value.mul(fQty.value));
  const newFilled = order.filledQty.add(fQty);
  order.avgPrice = new Price(totalCost.div(newFilled.value));
  order.filledQty = newFilled;
  // 更新剩余数量 = 总数量 - 新已成交数量
  order.remainingQty = order.quantity.sub(newFilled);
  order.tsLast = tsEvent;

  // 根据剩余数量判断订单状态
  if (order.remainingQty.isZero()) {
    order.status = OrderStatus.Filled;         // 全部成交完成
  } else {
    order.status = OrderStatus.PartiallyFilled; // 部分成交
  }
}

// 判断订单是否处于活跃状态（未最终完成）
export function isOrderActive(order: Order): boolean {
  return (
    order.status === OrderStatus.Initialized ||    // 已初始化
    order.status === OrderStatus.Accepted ||        // 已接受
    order.status === OrderStatus.PartiallyFilled    // 部分成交
  );
}
