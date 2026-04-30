import Decimal from 'decimal.js';
import { UnixNanos } from '../core/types.js';
import { InstrumentId, TraderId, StrategyId } from '../core/identifiers.js';
import { MarketData, isBar, isTradeTick } from '../model/data.js';
import { Order } from '../model/order.js';
import { Position, createPosition, isPositionOpen, updateUnrealizedPnl, openPosition, addToPosition, closePosition } from '../model/position.js';
import { SimulatedExchange, VenueConfig } from '../engine/exchange.js';
import { Price, Quantity } from '../core/types.js';
import { DataFeed } from './data-feed.js';
import { ResultAggregator, BacktestResult } from './result.js';
import { MessageBus } from '../msgbus/bus.js';
import { Strategy } from '../strategy/base.js';
import { computeStats, PortfolioStats } from '../analysis/stats.js';
import { OrderSide } from '../core/enums.js';

export interface BacktestEngineConfig {
  traderId?: string;
}

export class BacktestEngine {
  public readonly traderId: TraderId;
  public readonly msgbus: MessageBus;

  private venues: Map<string, SimulatedExchange> = new Map();
  private instruments: Map<string, InstrumentId> = new Map();
  private strategies: Strategy[] = [];
  private dataFeed: DataFeed | null = null;
  private resultAggregator = new ResultAggregator();
  private positions: Map<string, Position> = new Map();
  private equityCurve: number[] = [];
  private currentTime: UnixNanos | null = null;

  constructor(config?: BacktestEngineConfig) {
    this.traderId = TraderId.from(config?.traderId ?? 'BACKTEST-001');
    this.msgbus = new MessageBus();
  }

  addVenue(config: VenueConfig): void {
    const exchange = new SimulatedExchange(this.msgbus, config);
    this.venues.set(config.name, exchange);
  }

  addInstrument(instrumentId: InstrumentId): void {
    this.instruments.set(instrumentId.toString(), instrumentId);
  }

  addData(data: MarketData[]): void {
    if (this.dataFeed) {
      throw new Error('Data already added. Use a single addData call.');
    }
    this.dataFeed = new DataFeed(data);
  }

  addStrategy(strategy: Strategy): void {
    strategy.engine = this;
    strategy.msgbus = this.msgbus;
    this.strategies.push(strategy);
  }

  // Called by strategies to submit orders
  submitOrder(order: Order): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) {
      throw new Error('No venues configured');
    }
    exchange.submitOrder(order);
    this.resultAggregator.recordOrder(order);
  }

  // Called by strategies to cancel orders
  cancelOrder(clientOrderId: string): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) return;
    exchange.cancelOrder(clientOrderId);
  }

  // Get current portfolio state
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPosition(instrumentId: InstrumentId): Position {
    const key = instrumentId.toString();
    let pos = this.positions.get(key);
    if (!pos) {
      pos = createPosition(instrumentId);
      this.positions.set(key, pos);
    }
    return pos;
  }

  getAccountBalance(currency: string): Decimal {
    const exchange = this.venues.values().next().value;
    if (!exchange) return new Decimal(0);
    return exchange.account.getFree(currency);
  }

  private getCurrentPrice(instrumentId: InstrumentId): { price: Decimal } | null {
    // Track last known prices from bar processing
    return this.lastPrices.get(instrumentId.toString()) || null;
  }

  private lastPrices: Map<string, { price: Decimal }> = new Map();

  run(startTime?: UnixNanos, endTime?: UnixNanos): BacktestResult {
    if (!this.dataFeed) {
      throw new Error('No data added. Call addData() before run().');
    }
    if (this.strategies.length === 0) {
      throw new Error('No strategies added. Call addStrategy() before run().');
    }

    this.resultAggregator.start();

    // Initialize strategies
    for (const strategy of this.strategies) {
      strategy.onStart();
    }

    // Register fill event handler
    this.msgbus.subscribe('events.order.*', (data: unknown) => {
      const event = data as { type: string; order?: Order; fillPrice?: any; fillQty?: any };
      if (event.type === 'filled' && event.order) {
        for (const strategy of this.strategies) {
          strategy.onOrderFilled(event.order);
        }
        this.resultAggregator.recordOrder(event.order);

        // Update position
        this.updatePositionFromFill(event.order, event.fillPrice!, event.fillQty!);
      }
    });

    // Main loop
    const startTs = startTime;
    const endTs = endTime;

    if (startTs && endTs) {
      this.resultAggregator.setBacktestRange(startTs, endTs);
    }

    let data = this.dataFeed.next();
    while (data) {
      // Time range filtering
      if (startTs && data.tsInit.lt(startTs)) {
        data = this.dataFeed.next();
        continue;
      }
      if (endTs && data.tsInit.gt(endTs)) {
        break;
      }

      this.currentTime = data.tsInit;

      // Process data through exchange
      for (const [, exchange] of this.venues) {
        if (isBar(data)) {
          exchange.processBar(data);
          // Track last price
          this.lastPrices.set(
            data.instrumentId.toString(),
            { price: data.close.value },
          );
        } else if (isTradeTick(data)) {
          exchange.processTradeTick(data);
          this.lastPrices.set(
            data.instrumentId.toString(),
            { price: data.price.value },
          );
        }
      }

      // Dispatch data to strategies
      for (const strategy of this.strategies) {
        if (isBar(data)) {
          strategy.onBar(data);
        } else if (isTradeTick(data)) {
          strategy.onTrade(data);
        }
      }

      // Update positions unrealized PnL
      this.updateUnrealizedPnls();

      // Record equity
      this.recordEquity();

      this.resultAggregator.recordDataPoint();
      data = this.dataFeed.next();
    }

    // Finalize
    for (const strategy of this.strategies) {
      strategy.onStop();
    }

    this.resultAggregator.stop();

    // Compute final stats
    const stats = this.computeFinalStats();
    const finalBalances = new Map<string, string>();
    const exchange = this.venues.values().next().value;
    if (exchange) {
      for (const [currency, bal] of exchange.account.balances) {
        finalBalances.set(currency, bal.total.toString());
      }
    }

    const realizedPnl = new Map<string, number>();
    for (const [currency, val] of stats.realizedPnl) {
      realizedPnl.set(currency, Number(val));
    }

    return this.resultAggregator.build(
      finalBalances,
      realizedPnl,
      stats.maxDrawdown,
      stats.sharpeRatio,
      stats.winRate,
      stats.profitFactor,
    );
  }

  private updatePositionFromFill(
    order: Order,
    fillPrice: Price,
    fillQty: Quantity,
  ): void {
    const position = this.getPosition(order.instrumentId);

    if (order.side === OrderSide.Buy) {
      if (!isPositionOpen(position)) {
        openPosition(position, fillQty, fillPrice, order.tsLast!);
      } else {
        addToPosition(position, fillQty, fillPrice, order.tsLast!);
      }
    } else {
      if (isPositionOpen(position)) {
        closePosition(position, fillQty, fillPrice, order.tsLast!);
        this.resultAggregator.recordPosition(position);
      }
    }
  }

  private updateUnrealizedPnls(): void {
    for (const [, position] of this.positions) {
      const lastPrice = this.getCurrentPrice(position.instrumentId);
      if (lastPrice && isPositionOpen(position)) {
        updateUnrealizedPnl(position, Price.from(lastPrice.price.toString()));
      }
    }
  }

  private recordEquity(): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) return;

    let equity = 0;
    for (const [currency, bal] of exchange.account.balances) {
      // Simple: use total balance as equity (ignoring unrealized for simplicity)
      equity += Number(bal.total);
    }
    // Add unrealized PnL
    for (const [, position] of this.positions) {
      if (isPositionOpen(position) && position.unrealizedPnl) {
        equity += Number(position.unrealizedPnl.value);
      }
    }
    this.equityCurve.push(equity);
  }

  private computeFinalStats(): PortfolioStats {
    return computeStats(this.equityCurve, this.resultAggregator);
  }
}
