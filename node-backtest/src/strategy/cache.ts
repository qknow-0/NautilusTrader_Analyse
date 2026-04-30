// 策略缓存 — 存储订单、持仓、标的物、历史数据供快速查找

import { Order } from '../model/order.js';
import { Position } from '../model/position.js';
import { InstrumentId, StrategyId, ClientOrderId } from '../core/identifiers.js';
import { OrderStatus, PositionSide } from '../core/enums.js';
import { Bar, TradeTick } from '../model/data.js';

export class StrategyCache {
  // -- 数据存储 --
  private orders: Map<string, Order> = new Map();              // clientOrderId → 订单
  private positions: Map<string, Position> = new Map();        // instrumentId → 持仓
  private instruments: Map<string, unknown> = new Map();       // instrumentId → 标的物信息
  private barsHistory: Map<string, Bar[]> = new Map();         // barType → K 线历史
  private tradesHistory: Map<string, TradeTick[]> = new Map(); // instrumentId → 成交历史
  private priceHistoryMap: Map<string, number[]> = new Map();  // instrumentId → 价格历史
  private barSubscriptions: Set<string> = new Set();           // 已订阅的 K 线类型
  private quoteSubscriptions: Set<string> = new Set();         // 已订阅的报价
  private tradeSubscriptions: Set<string> = new Set();         // 已订阅的成交数据

  // -- 订单管理 --

  // 添加订单到缓存
  addOrder(order: Order): void {
    this.orders.set(order.clientId.value, order);
  }

  // 根据订单 ID 查询订单
  order(clientOrderId: ClientOrderId | string): Order | undefined {
    const key = typeof clientOrderId === 'string' ? clientOrderId : clientOrderId.value;
    return this.orders.get(key);
  }

  // 查询活跃订单（已初始化/已接受/部分成交）
  ordersOpen(strategyId?: StrategyId, instrumentId?: InstrumentId): Order[] {
    return this.filterOrders(
      (o) =>
        (o.status === OrderStatus.Initialized ||
          o.status === OrderStatus.Accepted ||
          o.status === OrderStatus.PartiallyFilled) &&
        (!strategyId || o.strategyId.value === strategyId.value) &&
        (!instrumentId || o.instrumentId.toString() === instrumentId.toString()),
    );
  }

  // 查询处理中订单（已接受/部分成交，排除仅初始化状态）
  ordersInflight(strategyId?: StrategyId, instrumentId?: InstrumentId): Order[] {
    return this.filterOrders(
      (o) =>
        (o.status === OrderStatus.Accepted ||
          o.status === OrderStatus.PartiallyFilled) &&
        (!strategyId || o.strategyId.value === strategyId.value) &&
        (!instrumentId || o.instrumentId.toString() === instrumentId.toString()),
    );
  }

  // 查询指定策略的所有订单
  ordersForStrategy(strategyId: StrategyId): Order[] {
    return this.filterOrders((o) => o.strategyId.value === strategyId.value);
  }

  // 查询指定标的物的所有订单
  ordersForInstrument(instrumentId: InstrumentId): Order[] {
    return this.filterOrders(
      (o) => o.instrumentId.toString() === instrumentId.toString(),
    );
  }

  // 检查订单是否存在
  orderExists(clientOrderId: ClientOrderId | string): boolean {
    const key = typeof clientOrderId === 'string' ? clientOrderId : clientOrderId.value;
    return this.orders.has(key);
  }

  // 更新订单状态
  updateOrder(order: Order): void {
    this.orders.set(order.clientId.value, order);
  }

  // -- 持仓管理 --

  // 添加持仓到缓存
  addPosition(position: Position): void {
    this.positions.set(position.instrumentId.toString(), position);
  }

  // 根据标的物查询持仓
  position(instrumentId: InstrumentId): Position | undefined {
    return this.positions.get(instrumentId.toString());
  }

  // 查询活跃持仓（非 Flat 且数量 > 0）
  positionsOpen(strategyId?: StrategyId, instrumentId?: InstrumentId): Position[] {
    return Array.from(this.positions.values()).filter((p) => {
      const isOpen = p.side !== PositionSide.Flat && p.quantity.value.gt(0);
      return (
        isOpen &&
        (!instrumentId || p.instrumentId.toString() === instrumentId.toString())
      );
    });
  }

  // -- 数据订阅 --

  // 检查是否已订阅指定 K 线类型
  isBarSubscribed(barType: string): boolean {
    return this.barSubscriptions.has(barType);
  }

  // 订阅 K 线数据
  subscribeBar(barType: string): void {
    this.barSubscriptions.add(barType);
  }

  // 取消订阅 K 线数据
  unsubscribeBar(barType: string): void {
    this.barSubscriptions.delete(barType);
  }

  // 检查是否已订阅指定报价
  isQuoteSubscribed(instrumentId: InstrumentId): boolean {
    return this.quoteSubscriptions.has(instrumentId.toString());
  }

  // 订阅报价数据
  subscribeQuote(instrumentId: InstrumentId): void {
    this.quoteSubscriptions.add(instrumentId.toString());
  }

  // 取消订阅报价数据
  unsubscribeQuote(instrumentId: InstrumentId): void {
    this.quoteSubscriptions.delete(instrumentId.toString());
  }

  // 检查是否已订阅指定成交数据
  isTradeSubscribed(instrumentId: InstrumentId): boolean {
    return this.tradeSubscriptions.has(instrumentId.toString());
  }

  // 订阅成交数据
  subscribeTrade(instrumentId: InstrumentId): void {
    this.tradeSubscriptions.add(instrumentId.toString());
  }

  // 取消订阅成交数据
  unsubscribeTrade(instrumentId: InstrumentId): void {
    this.tradeSubscriptions.delete(instrumentId.toString());
  }

  // -- 历史数据 --

  // 添加一条 K 线数据
  addBar(bar: Bar): void {
    const bars = this.barsHistory.get(bar.barType) ?? [];
    bars.push(bar);
    this.barsHistory.set(bar.barType, bars);
  }

  // 查询 K 线历史，默认返回最近 1000 条
  bars(barType: string, limit = 1000): Bar[] {
    const bars = this.barsHistory.get(barType) ?? [];
    return bars.slice(-limit);
  }

  // 添加一个价格数据点
  addPricePoint(instrumentId: InstrumentId, price: number): void {
    const key = instrumentId.toString();
    const prices = this.priceHistoryMap.get(key) ?? [];
    prices.push(price);
    this.priceHistoryMap.set(key, prices);
  }

  // 查询价格历史，默认返回最近 1000 个点
  priceHistory(instrumentId: InstrumentId, limit = 1000): number[] {
    const key = instrumentId.toString();
    const prices = this.priceHistoryMap.get(key) ?? [];
    return prices.slice(-limit);
  }

  // 获取最新价格
  lastPrice(instrumentId: InstrumentId): number | undefined {
    const prices = this.priceHistoryMap.get(instrumentId.toString());
    if (!prices || prices.length === 0) return undefined;
    return prices[prices.length - 1];
  }

  // -- 标的物信息 --

  // 添加标的物信息
  addInstrument(id: InstrumentId, info: unknown): void {
    this.instruments.set(id.toString(), info);
  }

  // 查询标的物信息
  instrument(instrumentId: InstrumentId): unknown | undefined {
    return this.instruments.get(instrumentId.toString());
  }

  // -- 工具方法 --

  // 清空所有缓存
  clear(): void {
    this.orders.clear();
    this.positions.clear();
    this.instruments.clear();
    this.barsHistory.clear();
    this.tradesHistory.clear();
    this.priceHistoryMap.clear();
    this.barSubscriptions.clear();
    this.quoteSubscriptions.clear();
    this.tradeSubscriptions.clear();
  }

  // 通用订单过滤方法
  private filterOrders(predicate: (order: Order) => boolean): Order[] {
    return Array.from(this.orders.values()).filter(predicate);
  }
}
