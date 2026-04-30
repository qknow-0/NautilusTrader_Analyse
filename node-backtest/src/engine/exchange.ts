import { Price, Quantity } from '../core/types.js';
import { InstrumentId } from '../core/identifiers.js';
import { Order } from '../model/order.js';
import { Bar, TradeTick, MarketData } from '../model/data.js';
import { CashAccount } from './account.js';
import { MatchingEngine } from './matching.js';
import { MessageBus } from '../msgbus/bus.js';
import { OrderSide, OrderStatus } from '../core/enums.js';
import Decimal from 'decimal.js';

export interface FillEvent {
  order: Order;
  fillPrice: Price;
  fillQty: Quantity;
}

export interface VenueConfig {
  name: string;
  startingBalances: Map<string, Decimal>;
  baseCurrency?: string; // undefined = multi-currency
}

export class SimulatedExchange {
  public readonly name: string;
  public readonly account: CashAccount;
  public readonly matchingEngine: MatchingEngine;
  private readonly msgbus: MessageBus;
  private readonly baseCurrency?: string;
  private orderCounter = 0;

  constructor(msgbus: MessageBus, config: VenueConfig) {
    this.name = config.name;
    this.account = new CashAccount(config.startingBalances);
    this.matchingEngine = new MatchingEngine();
    this.msgbus = msgbus;
    this.baseCurrency = config.baseCurrency;
  }

  submitOrder(order: Order): void {
    // Accept the order
    order.status = OrderStatus.Accepted;

    // Lock funds for buy orders
    if (order.side === OrderSide.Buy) {
      const cost = this.estimateCost(order);
      const quoteCurrency = this.getQuoteCurrency(order.instrumentId);
      this.account.lockForBuy(quoteCurrency, cost);
    }

    this.matchingEngine.addOrder(order);
    this.orderCounter++;

    this.msgbus.publish('events.order.*', { type: 'accepted', order });
  }

  cancelOrder(clientOrderId: string): Order | null {
    const order = this.matchingEngine.cancelOrder(clientOrderId);
    if (!order) return null;

    // Unlock any remaining locked funds
    if (order.side === OrderSide.Buy) {
      const remainingCost = this.estimateRemainingCost(order);
      const quoteCurrency = this.getQuoteCurrency(order.instrumentId);
      this.account.unlockForCancel(quoteCurrency, remainingCost);
    }

    order.status = OrderStatus.Cancelled;
    this.msgbus.publish('events.order.*', { type: 'cancelled', order });
    return order;
  }

  processBar(bar: Bar): void {
    this.matchingEngine.processBar(bar, (order, fillPrice, fillQty) => {
      this.onFill(order, fillPrice, fillQty, bar.tsInit);
    });
  }

  processTradeTick(tick: TradeTick): void {
    this.matchingEngine.processTradeTick(tick, (order, fillPrice, fillQty) => {
      this.onFill(order, fillPrice, fillQty, tick.tsInit);
    });
  }

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

  private estimateCost(order: Order): Decimal {
    const qty = order.quantity.value;
    if (order.type === 'LIMIT' && order.price) {
      return order.price.value.mul(qty);
    }
    // Market order: estimate at current price (will be adjusted on fill)
    return qty.mul(1.01); // 1% buffer for market orders
  }

  private estimateRemainingCost(order: Order): Decimal {
    if (order.type === 'LIMIT' && order.price) {
      return order.price.value.mul(order.remainingQty.value);
    }
    return order.remainingQty.value.mul(1.01);
  }

  private getQuoteCurrency(instrumentId: InstrumentId): string {
    const symbol = instrumentId.symbol.value;
    // Common quote currencies
    if (symbol.endsWith('-USDT') || symbol.endsWith('USDT')) return 'USDT';
    if (symbol.endsWith('-BTC') || symbol.endsWith('BTC')) return 'BTC';
    if (symbol.endsWith('-USD') || symbol.endsWith('USD')) return 'USD';
    return this.baseCurrency ?? 'USDT';
  }

  private getBaseCurrency(instrumentId: InstrumentId): string {
    const symbol = instrumentId.symbol.value;
    // Extract base currency (e.g. "BTC" from "BTC-USDT")
    const match = symbol.match(/^([A-Z0-9]+)-/);
    return match ? match[1] : symbol;
  }

  toString(): string {
    return `Exchange(${this.name}): ${this.account}`;
  }
}
