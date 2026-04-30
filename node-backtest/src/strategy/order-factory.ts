// 订单工厂 — 创建带有正确标识符的订单对象

import { createOrder } from '../model/order.js';
import { Order } from '../model/order.js';
import { InstrumentId, StrategyId } from '../core/identifiers.js';
import { Price, Quantity, UnixNanos } from '../core/types.js';
import { OrderSide, OrderType, TimeInForce } from '../core/enums.js';

export class OrderFactory {
  private strategyId: StrategyId;                      // 策略 ID
  private clock: { timestampNs: () => UnixNanos };     // 时钟接口（提供当前时间戳）

  constructor(
    strategyId: StrategyId,
    clock: { timestampNs: () => UnixNanos },
  ) {
    this.strategyId = strategyId;
    this.clock = clock;
  }

  // 创建市价单
  market(
    instrumentId: InstrumentId,
    side: OrderSide,
    quantity: Quantity | string,
    options: {
      timeInForce?: TimeInForce;   // 有效期限策略
      reduceOnly?: boolean;        // 是否仅减仓
      quoteQuantity?: boolean;     // 数量是否为报价货币数量
      tags?: string[];             // 标签
    } = {},
  ): Order {
    return createOrder(
      this.strategyId,
      instrumentId,
      side,
      OrderType.Market,
      quantity,
      undefined,                          // 市价单无限价
      options.timeInForce ?? TimeInForce.Gtc,
      this.clock.timestampNs(),           // 使用当前时钟时间戳
      options.reduceOnly ?? false,
    );
  }

  // 创建限价单
  limit(
    instrumentId: InstrumentId,
    side: OrderSide,
    quantity: Quantity | string,
    price: Price | string,
    options: {
      timeInForce?: TimeInForce;   // 有效期限策略
      reduceOnly?: boolean;        // 是否仅减仓
      postOnly?: boolean;          // 是否仅挂单（Maker Only）
      expireTimeNs?: bigint;       // 过期时间（纳秒）
      tags?: string[];             // 标签
    } = {},
  ): Order {
    const order = createOrder(
      this.strategyId,
      instrumentId,
      side,
      OrderType.Limit,
      quantity,
      price,
      options.timeInForce ?? TimeInForce.Gtc,
      this.clock.timestampNs(),
      options.reduceOnly ?? false,
    );
    return order;
  }

  // 创建停止市价单（触发后转为市价单）
  stopMarket(
    instrumentId: InstrumentId,
    side: OrderSide,
    quantity: Quantity | string,
    triggerPrice: Price | string,
    options: {
      timeInForce?: TimeInForce;
      reduceOnly?: boolean;
    } = {},
  ): Order {
    const order = createOrder(
      this.strategyId,
      instrumentId,
      side,
      OrderType.Market,
      quantity,
      triggerPrice,                       // 用 triggerPrice 暂存触发价
      options.timeInForce ?? TimeInForce.Gtc,
      this.clock.timestampNs(),
      options.reduceOnly ?? false,
    );
    // TODO: 当枚举支持时标记为停止单
    return order;
  }

  // 创建停止限价单（触发后转为限价单）
  stopLimit(
    instrumentId: InstrumentId,
    side: OrderSide,
    quantity: Quantity | string,
    price: Price | string,
    triggerPrice: Price | string,
    options: {
      timeInForce?: TimeInForce;
      reduceOnly?: boolean;
    } = {},
  ): Order {
    const order = createOrder(
      this.strategyId,
      instrumentId,
      side,
      OrderType.Limit,
      quantity,
      price,
      options.timeInForce ?? TimeInForce.Gtc,
      this.clock.timestampNs(),
      options.reduceOnly ?? false,
    );
    // TODO: 当枚举支持时标记为停止限价单
    return order;
  }
}
