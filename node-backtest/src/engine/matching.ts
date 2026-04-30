import { Price, Quantity } from '../core/types.js';
import { Order, applyFill, isOrderActive } from '../model/order.js';
import { Bar, TradeTick, isBar } from '../model/data.js';
import { OrderSide, OrderType } from '../core/enums.js';

// 简单撮合引擎，支持 K 线和逐笔成交两种驱动模式
export class MatchingEngine {
  private pendingOrders: Order[] = [];  // 待撮合订单列表

  // 添加订单到待撮合队列
  addOrder(order: Order): void {
    this.pendingOrders.push(order);
  }

  // 处理 K 线数据，用 OHLC 价格撮合待成交订单
  processBar(bar: Bar, onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void): void {
    const activeOrders = this.pendingOrders.filter(isOrderActive);

    for (const order of activeOrders) {
      // 仅撮合约内品种的订单
      if (order.instrumentId.toString() !== bar.instrumentId.toString()) continue;

      if (order.type === OrderType.Market) {
        this.fillMarketOrder(order, bar, onFill);
      } else if (order.type === OrderType.Limit && order.price) {
        this.fillLimitOrder(order, bar, onFill);
      }
    }
  }

  // 处理逐笔成交数据，用成交价格撮合待成交订单
  processTradeTick(
    tick: TradeTick,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const activeOrders = this.pendingOrders.filter(isOrderActive);

    for (const order of activeOrders) {
      // 仅撮合约内品种的订单
      if (order.instrumentId.toString() !== tick.instrumentId.toString()) continue;

      if (order.type === OrderType.Market) {
        this.fillMarketOrderOnTrade(order, tick, onFill);
      } else if (order.type === OrderType.Limit && order.price) {
        this.fillLimitOrderOnTrade(order, tick, onFill);
      }
    }
  }

  // K 线驱动下市价单成交：以开盘价成交
  private fillMarketOrder(
    order: Order,
    bar: Bar,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const fillPrice = bar.open;
    const fillQty = order.remainingQty;
    applyFill(order, fillQty, fillPrice, bar.tsEvent);
    onFill(order, fillPrice, fillQty);
  }

  // 逐笔驱动下市价单成交：以成交价格成交，数量取 tick 量和剩余量的较小值
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

  // K 线驱动下限价单成交：检查价格条件后以最优价格成交
  private fillLimitOrder(
    order: Order,
    bar: Bar,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const limitPrice = order.price!;

    // 买单：K 线最低价 <= 限价 时可成交
    // 卖单：K 线最高价 >= 限价 时可成交
    const canFill =
      (order.side === OrderSide.Buy && bar.low.le(limitPrice)) ||
      (order.side === OrderSide.Sell && bar.high.ge(limitPrice));

    if (!canFill) return;

    // 成交价取更优者：买单取开盘价和限价的较小值，卖单取较大值
    const fillPrice =
      order.side === OrderSide.Buy
        ? bar.open.lt(limitPrice) ? bar.open : limitPrice
        : bar.open.gt(limitPrice) ? bar.open : limitPrice;

    const fillQty = order.remainingQty;
    applyFill(order, fillQty, fillPrice, bar.tsEvent);
    onFill(order, fillPrice, fillQty);
  }

  // 逐笔驱动下限价单成交：以限价成交，数量取 tick 量和剩余量的较小值
  private fillLimitOrderOnTrade(
    order: Order,
    tick: TradeTick,
    onFill: (order: Order, fillPrice: Price, fillQty: Quantity) => void,
  ): void {
    const limitPrice = order.price!;

    // 买单：成交价 <= 限价 时可成交
    // 卖单：成交价 >= 限价 时可成交
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

  // 按客户端订单 ID 撤销订单
  cancelOrder(clientOrderId: string): Order | null {
    const idx = this.pendingOrders.findIndex(
      (o) => o.clientId.value === clientOrderId,
    );
    if (idx < 0) return null;
    return this.pendingOrders.splice(idx, 1)[0];
  }

  // 获取所有活跃订单
  getActiveOrders(): Order[] {
    return this.pendingOrders.filter(isOrderActive);
  }

  // 获取全部订单（含已完成的）
  getAllOrders(): Order[] {
    return [...this.pendingOrders];
  }
}
