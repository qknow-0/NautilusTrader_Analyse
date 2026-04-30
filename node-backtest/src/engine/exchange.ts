import { Price, Quantity } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { Order } from '../model/order.js';
import { Bar, TradeTick, MarketData } from '../model/data.js';
import { CashAccount } from './account.js';
import { MatchingEngine } from './matching.js';
import { MessageBus } from '../msgbus/bus.js';
import { OrderSide, OrderStatus } from '../core/enums.js';
import Decimal from 'decimal.js';

// 成交事件，携带订单和成交信息
export interface FillEvent {
  order: Order;
  fillPrice: Price;
  fillQty: Quantity;
}

// 交易场所配置
export interface VenueConfig {
  name: string;                           // 交易所名称
  startingBalances: Map<string, Decimal>; // 初始余额（币种 -> 金额）
  baseCurrency?: string;                  // 基础货币，undefined 表示多币种模式
}

// 模拟交易所，整合账户、撮合引擎和消息总线
export class SimulatedExchange {
  public readonly name: string;
  public readonly account: CashAccount;
  public readonly matchingEngine: MatchingEngine;
  private readonly msgbus: MessageBus;
  private readonly baseCurrency?: string;
  private orderCounter = 0;  // 订单计数器

  // 初始化交易所：创建账户、撮合引擎，保存消息总线
  constructor(msgbus: MessageBus, config: VenueConfig) {
    this.name = config.name;
    this.account = new CashAccount(config.startingBalances);
    this.matchingEngine = new MatchingEngine();
    this.msgbus = msgbus;
    this.baseCurrency = config.baseCurrency;
  }

  // 提交订单：接受订单、冻结资金（买单）、加入撮合队列
  submitOrder(order: Order): void {
    // 标记订单为已接受
    order.status = OrderStatus.Accepted;

    // 买单需要冻结计价币资金
    if (order.side === OrderSide.Buy) {
      const cost = this.estimateCost(order);
      const quoteCurrency = this.getQuoteCurrency(order.instrumentId);
      this.account.lockForBuy(quoteCurrency, cost);
    }

    this.matchingEngine.addOrder(order);
    this.orderCounter++;

    // 发布订单已接受事件
    this.msgbus.publish('events.order.*', { type: 'accepted', order });
  }

  // 撤销订单：从撮合队列移除、解冻剩余资金、更新状态
  cancelOrder(clientOrderId: string): Order | null {
    const order = this.matchingEngine.cancelOrder(clientOrderId);
    if (!order) return null;

    // 解冻买单剩余冻结资金
    if (order.side === OrderSide.Buy) {
      const remainingCost = this.estimateRemainingCost(order);
      const quoteCurrency = this.getQuoteCurrency(order.instrumentId);
      this.account.unlockForCancel(quoteCurrency, remainingCost);
    }

    order.status = OrderStatus.Cancelled;
    this.msgbus.publish('events.order.*', { type: 'cancelled', order });
    return order;
  }

  // 处理 K 线数据，驱动撮合引擎成交
  processBar(bar: Bar): void {
    this.matchingEngine.processBar(bar, (order, fillPrice, fillQty) => {
      this.onFill(order, fillPrice, fillQty, bar.tsInit);
    });
  }

  // 处理逐笔成交数据，驱动撮合引擎成交
  processTradeTick(tick: TradeTick): void {
    this.matchingEngine.processTradeTick(tick, (order, fillPrice, fillQty) => {
      this.onFill(order, fillPrice, fillQty, tick.tsInit);
    });
  }

  // 订单成交回调：更新账户余额，发布成交事件
  private onFill(
    order: Order,
    fillPrice: Price,
    fillQty: Quantity,
    tsEvent: import('../core/types.js').UnixNanos,
  ): void {
    const quoteCurrency = this.getQuoteCurrency(order.instrumentId);
    const baseCurrency = this.getBaseCurrency(order.instrumentId);
    const cost = fillPrice.value.mul(fillQty.value);

    this.account.fillOrder(
      order.side,
      order.type,
      quoteCurrency,
      baseCurrency,
      cost,
      fillQty.value,
    );

    const fillEvent: FillEvent = { order, fillPrice, fillQty: fillQty };
    this.msgbus.publish('events.order.*', { type: 'filled', ...fillEvent });
  }

  // 估算买单所需资金：限价单用限价，市价单加 1% 缓冲
  private estimateCost(order: Order): Decimal {
    const qty = order.quantity.value;
    if (order.type === 'LIMIT' && order.price) {
      return order.price.value.mul(qty);
    }
    // 市价单：暂估当前价格（成交时会调整）
    return qty.mul(1.01); // 市价单 1% 缓冲
  }

  // 估算订单剩余所需资金
  private estimateRemainingCost(order: Order): Decimal {
    if (order.type === 'LIMIT' && order.price) {
      return order.price.value.mul(order.remainingQty.value);
    }
    return order.remainingQty.value.mul(1.01);
  }

  // 从交易对符号推断计价币（如 BTC-USDT -> USDT）
  private getQuoteCurrency(instrumentId: InstrumentId): string {
    const symbol = instrumentId.symbol.value;
    // 常见计价币匹配
    if (symbol.endsWith('-USDT') || symbol.endsWith('USDT')) return 'USDT';
    if (symbol.endsWith('-BTC') || symbol.endsWith('BTC')) return 'BTC';
    if (symbol.endsWith('-USD') || symbol.endsWith('USD')) return 'USD';
    return this.baseCurrency ?? 'USDT';
  }

  // 从交易对符号推断基础币（如 BTC-USDT -> BTC）
  private getBaseCurrency(instrumentId: InstrumentId): string {
    const symbol = instrumentId.symbol.value;
    // 提取前缀基础币
    const match = symbol.match(/^([A-Z0-9]+)-/);
    return match ? match[1] : symbol;
  }

  // 格式化输出交易所信息
  toString(): string {
    return `Exchange(${this.name}): ${this.account}`;
  }
}
