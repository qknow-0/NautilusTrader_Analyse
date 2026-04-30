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

// 回测引擎配置接口
export interface BacktestEngineConfig {
  traderId?: string; // 交易员 ID
}

// 回测引擎：驱动整个回测主循环，协调交易所、策略和数据源
export class BacktestEngine {
  public readonly traderId: TraderId;     // 交易员 ID
  public readonly msgbus: MessageBus;     // 消息总线，用于组件间通信

  private venues: Map<string, SimulatedExchange> = new Map(); // 模拟交易所集合
  private instruments: Map<string, InstrumentId> = new Map(); // 注册的合约/标的
  private strategies: Strategy[] = [];                        // 策略列表
  private dataFeed: DataFeed | null = null;                   // 数据源迭代器
  private resultAggregator = new ResultAggregator();          // 结果聚合器
  private positions: Map<string, Position> = new Map();       // 当前持仓（按标的 ID 索引）
  private equityCurve: number[] = [];                         // 权益曲线（每个数据点的总权益）
  private currentTime: UnixNanos | null = null;               // 当前回测时间

  constructor(config?: BacktestEngineConfig) {
    this.traderId = TraderId.from(config?.traderId ?? 'BACKTEST-001');
    this.msgbus = new MessageBus();
  }

  // 添加一个模拟交易所
  addVenue(config: VenueConfig): void {
    const exchange = new SimulatedExchange(this.msgbus, config);
    this.venues.set(config.name, exchange);
  }

  // 注册一个合约/标的 ID
  addInstrument(instrumentId: InstrumentId): void {
    this.instruments.set(instrumentId.toString(), instrumentId);
  }

  // 添加市场数据（只能调用一次）
  addData(data: MarketData[]): void {
    if (this.dataFeed) {
      throw new Error('Data already added. Use a single addData call.');
    }
    this.dataFeed = new DataFeed(data);
  }

  // 添加一个交易策略
  addStrategy(strategy: Strategy): void {
    strategy.engine = this;
    strategy.msgbus = this.msgbus;
    this.strategies.push(strategy);
  }

  // 由策略调用：提交订单到交易所
  submitOrder(order: Order): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) {
      throw new Error('No venues configured');
    }
    exchange.submitOrder(order);
    this.resultAggregator.recordOrder(order);
  }

  // 由策略调用：取消订单
  cancelOrder(clientOrderId: string): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) return;
    exchange.cancelOrder(clientOrderId);
  }

  // 获取所有当前持仓
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  // 获取指定标的的持仓，若不存在则创建新持仓
  getPosition(instrumentId: InstrumentId): Position {
    const key = instrumentId.toString();
    let pos = this.positions.get(key);
    if (!pos) {
      pos = createPosition(instrumentId);
      this.positions.set(key, pos);
    }
    return pos;
  }

  // 获取指定币种的账户可用余额
  getAccountBalance(currency: string): Decimal {
    const exchange = this.venues.values().next().value;
    if (!exchange) return new Decimal(0);
    return exchange.account.getFree(currency);
  }

  // 记录各标的最新价格（从 K 线或成交数据中提取）
  private lastPrices: Map<string, { price: Decimal }> = new Map();

  // 获取标的的当前最新价格
  private getCurrentPrice(instrumentId: InstrumentId): { price: Decimal } | null {
    return this.lastPrices.get(instrumentId.toString()) || null;
  }

  // === 回测主循环 ===
  run(startTime?: UnixNanos, endTime?: UnixNanos): BacktestResult {
    if (!this.dataFeed) {
      throw new Error('No data added. Call addData() before run().');
    }
    if (this.strategies.length === 0) {
      throw new Error('No strategies added. Call addStrategy() before run().');
    }

    // 记录回测运行开始时间
    this.resultAggregator.start();

    // 初始化所有策略（调用 onStart）
    for (const strategy of this.strategies) {
      strategy.onStart();
    }

    // 注册订单成交事件监听器：收到成交事件后更新持仓
    this.msgbus.subscribe('events.order.*', (data: unknown) => {
      const event = data as { type: string; order?: Order; fillPrice?: any; fillQty?: any };
      if (event.type === 'filled' && event.order) {
        // 通知所有策略订单已成交
        for (const strategy of this.strategies) {
          strategy.onOrderFilled(event.order);
        }
        this.resultAggregator.recordOrder(event.order);

        // 根据成交结果更新持仓
        this.updatePositionFromFill(event.order, event.fillPrice!, event.fillQty!);
      }
    });

    // 设置回测时间范围
    const startTs = startTime;
    const endTs = endTime;

    if (startTs && endTs) {
      this.resultAggregator.setBacktestRange(startTs, endTs);
    }

    // 主循环：逐条处理市场数据
    let data = this.dataFeed.next();
    while (data) {
      // 时间范围过滤：跳过起始时间之前的数据
      if (startTs && data.tsInit.lt(startTs)) {
        data = this.dataFeed.next();
        continue;
      }
      // 超出结束时间则终止回测
      if (endTs && data.tsInit.gt(endTs)) {
        break;
      }

      // 更新当前回测时间
      this.currentTime = data.tsInit;

      // 步骤 1：将数据送入交易所处理（撮合订单等）
      for (const [, exchange] of this.venues) {
        if (isBar(data)) {
          exchange.processBar(data);
          // 记录最新收盘价
          this.lastPrices.set(
            data.instrumentId.toString(),
            { price: data.close.value },
          );
        } else if (isTradeTick(data)) {
          exchange.processTradeTick(data);
          // 记录最新成交价
          this.lastPrices.set(
            data.instrumentId.toString(),
            { price: data.price.value },
          );
        }
      }

      // 步骤 2：将数据分发给策略处理（onBar / onTrade）
      for (const strategy of this.strategies) {
        if (isBar(data)) {
          strategy.onBar(data);
        } else if (isTradeTick(data)) {
          strategy.onTrade(data);
        }
      }

      // 步骤 3：更新所有未平仓持仓的浮盈浮亏
      this.updateUnrealizedPnls();

      // 步骤 4：记录当前权益值（用于绘制权益曲线）
      this.recordEquity();

      // 记录已处理数据点
      this.resultAggregator.recordDataPoint();
      data = this.dataFeed.next();
    }

    // 回测结束：通知所有策略停止
    for (const strategy of this.strategies) {
      strategy.onStop();
    }

    this.resultAggregator.stop();

    // 计算最终绩效统计
    const stats = this.computeFinalStats();

    // 收集各币种最终余额
    const finalBalances = new Map<string, string>();
    const exchange = this.venues.values().next().value;
    if (exchange) {
      for (const [currency, bal] of exchange.account.balances) {
        finalBalances.set(currency, bal.total.toString());
      }
    }

    // 将各币种已实现盈亏转为数字格式
    const realizedPnl = new Map<string, number>();
    for (const [currency, val] of stats.realizedPnl) {
      realizedPnl.set(currency, Number(val));
    }

    // 构建并返回最终回测结果
    return this.resultAggregator.build(
      finalBalances,
      realizedPnl,
      stats.maxDrawdown,
      stats.sharpeRatio,
      stats.winRate,
      stats.profitFactor,
    );
  }

  // 根据订单成交结果更新持仓（开仓/加仓/平仓）
  private updatePositionFromFill(
    order: Order,
    fillPrice: Price,
    fillQty: Quantity,
  ): void {
    const position = this.getPosition(order.instrumentId);

    if (order.side === OrderSide.Buy) {
      // 买入：未持仓则开仓，已有持仓则加仓
      if (!isPositionOpen(position)) {
        openPosition(position, fillQty, fillPrice, order.tsLast!);
      } else {
        addToPosition(position, fillQty, fillPrice, order.tsLast!);
      }
    } else {
      // 卖出：已有持仓则减仓/平仓
      if (isPositionOpen(position)) {
        closePosition(position, fillQty, fillPrice, order.tsLast!);
        this.resultAggregator.recordPosition(position);
      }
    }
  }

  // 更新所有未平仓持仓的浮盈浮亏
  private updateUnrealizedPnls(): void {
    for (const [, position] of this.positions) {
      const lastPrice = this.getCurrentPrice(position.instrumentId);
      if (lastPrice && isPositionOpen(position)) {
        updateUnrealizedPnl(position, Price.from(lastPrice.price.toString()));
      }
    }
  }

  // 记录当前总权益（余额 + 浮盈浮亏）
  private recordEquity(): void {
    const exchange = this.venues.values().next().value;
    if (!exchange) return;

    let equity = 0;
    // 累加各币种账户余额
    for (const [currency, bal] of exchange.account.balances) {
      equity += Number(bal.total);
    }
    // 加上未平仓持仓的浮盈浮亏
    for (const [, position] of this.positions) {
      if (isPositionOpen(position) && position.unrealizedPnl) {
        equity += Number(position.unrealizedPnl.value);
      }
    }
    this.equityCurve.push(equity);
  }

  // 计算最终绩效统计指标（夏普比率、最大回撤、胜率等）
  private computeFinalStats(): PortfolioStats {
    return computeStats(this.equityCurve, this.resultAggregator);
  }
}
