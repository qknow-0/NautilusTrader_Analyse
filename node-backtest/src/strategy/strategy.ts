// 策略 — 完整框架基类，镜像 Rust 的 Strategy trait
//
// 架构层级：
//   Component（生命周期状态机）
//     └── DataActor（数据订阅 + 事件分发）
//           └── Strategy（订单 + 持仓管理）
//                 └── YourStrategy（自定义逻辑）

import { OrderSide, OrderType, TimeInForce, ComponentState, ComponentTrigger, PositionSide, OrderStatus } from '../core/enums.js';
import { transitionState } from '../core/component.js';
import { Clock } from '../core/clock.js';
import { InstrumentId, ClientOrderId, StrategyId, TraderId } from '../core/identifiers.js';
import { Price, Quantity, UnixNanos } from '../core/types.js';
import { Order, createOrder, applyFill, isOrderActive } from '../model/order.js';
import { Position, createPosition, openPosition, addToPosition, closePosition, isPositionOpen, updateUnrealizedPnl } from '../model/position.js';
import { Bar, TradeTick, MarketData, isBar } from '../model/data.js';
import { MessageBus } from '../msgbus/bus.js';
import { StrategyCache } from './cache.js';
import { StrategyConfig, resolveConfig } from './config.js';
import { OrderFactory } from './order-factory.js';
import { Portfolio } from './portfolio.js';
import { RiskEngine, RiskLimits } from './risk.js';

// ─── Component（组件生命周期基类）─────────────────────────────────────────────

export abstract class Component {
  private _state: ComponentState = ComponentState.PreInitialized;  // 当前状态

  // 获取当前状态
  get state(): ComponentState {
    return this._state;
  }

  // 是否正在运行
  get isRunning(): boolean {
    return this._state === ComponentState.Running;
  }

  // 是否已停止
  get isStopped(): boolean {
    return this._state === ComponentState.Stopped;
  }

  // 执行状态转换
  protected transition(trigger: ComponentTrigger): void {
    this._state = transitionState(this._state, trigger);
  }

  /** 初始化：PreInitialized → Ready */
  initialize(): void {
    this.transition(ComponentTrigger.Initialize);
    this.onInit();
  }

  /** 启动：Ready → Running */
  start(): void {
    this.transition(ComponentTrigger.Start);
    this.onBeforeStart();
    this.onStart();
    this.transition(ComponentTrigger.StartCompleted);
  }

  /** 停止：Running → Stopped */
  stop(): void {
    this.transition(ComponentTrigger.Stop);
    this.onBeforeStop();
    this.onStop();
    this.transition(ComponentTrigger.StopCompleted);
  }

  /** 重置：Stopped → Ready */
  reset(): void {
    this.transition(ComponentTrigger.Reset);
    this.onReset();
    this.transition(ComponentTrigger.ResetCompleted);
  }

  // 生命周期钩子（子类可覆写）
  protected onInit(): void {}
  protected onBeforeStart(): void {}
  protected onStart(): void {
    console.warn('[Component] onStart called but not overridden');
  }
  protected onBeforeStop(): void {}
  protected onStop(): void {
    console.warn('[Component] onStop called but not overridden');
  }
  protected onReset(): void {}
}

// ─── DataActor（数据订阅与事件分发）──────────────────────────────────────────

export abstract class DataActor extends Component {
  public readonly id: StrategyId;                       // 策略 ID
  public clock: Clock;                                  // 时钟
  public cache: StrategyCache;                          // 策略缓存
  public msgbus: MessageBus;                            // 消息总线
  protected config: Required<StrategyConfig>;           // 已解析的配置

  constructor(id: string | StrategyId, config?: StrategyConfig) {
    super();
    this.id = typeof id === 'string' ? StrategyId.from(id) : id;
    this.config = resolveConfig(config);
    // 如果自动生成的 strategyId 覆盖了用户自定义 ID，则恢复用户 ID
    if (!this.config.strategyId.value.startsWith('STRATEGY-')) {
      this.config = { ...this.config, strategyId: this.id };
    }
    this.clock = new Clock();
    this.cache = new StrategyCache();
    this.msgbus = new MessageBus();
  }

  // ── 数据订阅 ──

  // 订阅 K 线数据
  subscribeBar(barType: string): void {
    this.cache.subscribeBar(barType);
  }

  // 取消订阅 K 线数据
  unsubscribeBar(barType: string): void {
    this.cache.unsubscribeBar(barType);
  }

  // 订阅报价数据
  subscribeQuotes(instrumentId: InstrumentId): void {
    this.cache.subscribeQuote(instrumentId);
  }

  // 取消订阅报价数据
  unsubscribeQuotes(instrumentId: InstrumentId): void {
    this.cache.unsubscribeQuote(instrumentId);
  }

  // 订阅成交数据
  subscribeTrades(instrumentId: InstrumentId): void {
    this.cache.subscribeTrade(instrumentId);
  }

  // 取消订阅成交数据
  unsubscribeTrades(instrumentId: InstrumentId): void {
    this.cache.unsubscribeTrade(instrumentId);
  }

  // ── 数据事件分发（子类覆写）──

  onBar(_bar: Bar): void {}
  onTrade(_trade: TradeTick): void {}
  onTimeEvent(_name: string, _ts: UnixNanos): void {}

  // ── 订单事件分发（子类覆写）──

  onOrderFilled(_order: Order): void {}
  onOrderCancelled(_order: Order): void {}
  onOrderRejected(_order: Order): void {}
  onOrderAccepted(_order: Order): void {}
  onOrderExpired(_order: Order): void {}
  onOrderModified(_order: Order): void {}

  // ── 持仓事件分发（子类覆写）──

  onPositionOpened(_position: Position): void {}
  onPositionChanged(_position: Position): void {}
  onPositionClosed(_position: Position): void {}

  // ── 定时器辅助 ──

  // 设置重复定时器（毫秒级）
  setTimer(name: string, intervalMs: number, callback: (name: string, ts: UnixNanos) => void): void {
    this.clock.setTimerNs(name, BigInt(intervalMs * 1_000_000), null, null, callback);
  }

  // 取消定时器
  cancelTimer(name: string): void {
    this.clock.cancelTimer(name);
  }

  // ── 日志 ──

  // 记录事件日志（受 logEvents 配置控制）
  log(message: string): void {
    if (this.config.logEvents) {
      console.log(`[${this.id.value}] ${message}`);
    }
  }

  // 记录警告日志（始终输出）
  logWarn(message: string): void {
    console.warn(`[${this.id.value}] WARN: ${message}`);
  }
}

// ─── Strategy（策略框架主类）────────────────────────────────────────────────

export abstract class Strategy extends DataActor {
  protected orderFactory: OrderFactory;                        // 订单工厂
  protected portfolio: Portfolio;                              // 投资组合
  protected riskEngine: RiskEngine;                            // 风控引擎
  protected lastPrices: Map<string, Price> = new Map();        // 最新价格映射

  // 内部状态
  private isExiting = false;                                   // 是否正在市场退出
  private pendingStop = false;                                 // 是否等待停止
  private marketExitAttempts = 0;                              // 市场退出尝试次数
  private marketExitIntervalMs = 100;                          // 退出检查间隔（毫秒）
  private marketExitMaxAttempts = 100;                         // 最大退出尝试次数

  constructor(id: string | StrategyId, config?: StrategyConfig) {
    super(id, config);
    this.orderFactory = new OrderFactory(this.id, {
      timestampNs: () => this.clock.timestampNs(),
    });
    this.portfolio = new Portfolio(this.cache);
    this.riskEngine = new RiskEngine(this.portfolio, {}, this.lastPrices);
  }

  // ── 订单管理 ──

  /** 提交订单，通过风控后加入缓存 */
  submitOrder(order: Order): boolean {
    // 风控检查
    const riskError = this.riskEngine.checkOrder(order);
    if (riskError) {
      this.logWarn(`Order denied: ${riskError}`);
      order.status = OrderStatus.Rejected;
      return false;
    }

    // 市场退出期间：拒绝非减仓订单
    if (this.isExiting && !order.reduceOnly) {
      this.logWarn('Order denied: market exit in progress');
      order.status = OrderStatus.Rejected;
      return false;
    }

    this.cache.addOrder(order);
    this.onOrderAccepted(order);
    return true;
  }

  /** 根据客户端订单 ID 取消订单 */
  cancelOrder(clientOrderId: string): Order | null {
    const order = this.cache.order(clientOrderId);
    if (!order || !isOrderActive(order)) return null;
    order.status = OrderStatus.Cancelled;
    this.cache.updateOrder(order);
    this.onOrderCancelled(order);
    return order;
  }

  /** 取消指定标的物的所有活跃订单 */
  cancelAllOrders(instrumentId?: InstrumentId): number {
    const orders = this.cache.ordersOpen(
      this.id,
      instrumentId,
    );
    for (const order of orders) {
      order.status = OrderStatus.Cancelled;
      this.cache.updateOrder(order);
      this.onOrderCancelled(order);
    }
    return orders.length;
  }

  /** 平掉指定标的物的所有持仓 */
  closeAllPositions(instrumentId?: InstrumentId): number {
    const positions = this.cache.positionsOpen(this.id, instrumentId);
    for (const pos of positions) {
      this.closePosition(pos);
    }
    return positions.length;
  }

  /** 使用市价单平掉单个持仓 */
  closePosition(position: Position): Order | null {
    if (position.side === PositionSide.Flat || position.quantity.isZero()) {
      return null;  // 无持仓或数量为零，无需平仓
    }

    // 根据持仓方向决定平仓方向
    const side = position.side === PositionSide.Long ? OrderSide.Sell : OrderSide.Buy;
    const order = this.orderFactory.market(
      position.instrumentId,
      side,
      position.quantity,
      { reduceOnly: true, tags: ['MARKET_EXIT'] },
    );

    if (this.submitOrder(order)) {
      return order;
    }
    return null;
  }

  // ── 订单工厂快捷方法 ──

  // 买入市价单
  buyMarket(instrumentId: InstrumentId, quantity: Quantity | string): Order | null {
    const order = this.orderFactory.market(instrumentId, OrderSide.Buy, quantity);
    return this.submitOrder(order) ? order : null;
  }

  // 卖出市价单
  sellMarket(instrumentId: InstrumentId, quantity: Quantity | string): Order | null {
    const order = this.orderFactory.market(instrumentId, OrderSide.Sell, quantity);
    return this.submitOrder(order) ? order : null;
  }

  // 买入限价单
  buyLimit(instrumentId: InstrumentId, quantity: Quantity | string, price: Price | string): Order | null {
    const order = this.orderFactory.limit(instrumentId, OrderSide.Buy, quantity, price);
    return this.submitOrder(order) ? order : null;
  }

  // 卖出限价单
  sellLimit(instrumentId: InstrumentId, quantity: Quantity | string, price: Price | string): Order | null {
    const order = this.orderFactory.limit(instrumentId, OrderSide.Sell, quantity, price);
    return this.submitOrder(order) ? order : null;
  }

  // ── 市场退出 ──

  /**
   * 发起受控的市场退出流程。
   * 取消所有订单并平掉所有持仓，然后等待全部完成。
   */
  marketExit(): void {
    if (this.state !== ComponentState.Running || this.isExiting) return;

    this.isExiting = true;
    this.marketExitAttempts = 0;

    this.log('Initiating market exit...');
    this.onMarketExit();

    // 取消所有活跃订单
    this.cancelAllOrders();
    // 平掉所有持仓
    this.closeAllPositions();

    // 设置定时器定期检查退出状态
    this.setTimer(
      'MARKET_EXIT_CHECK',
      this.marketExitIntervalMs,
      () => this.checkMarketExit(),
    );
  }

  // 检查市场退出是否完成
  private checkMarketExit(): void {
    if (!this.isExiting) return;

    this.marketExitAttempts++;
    if (this.marketExitAttempts >= this.marketExitMaxAttempts) {
      this.logWarn(`Market exit max attempts (${this.marketExitMaxAttempts}) reached`);
      this.finalizeMarketExit();
      return;
    }

    const openOrders = this.cache.ordersOpen(this.id);
    const openPositions = this.cache.positionsOpen(this.id);

    if (openOrders.length === 0 && openPositions.length === 0) {
      // 全部完成
      this.finalizeMarketExit();
    } else if (openPositions.length > 0 && openOrders.length === 0) {
      // 重新提交剩余持仓的平仓单
      for (const pos of openPositions) {
        this.closePosition(pos);
      }
    }
  }

  // 最终化市场退出流程
  private finalizeMarketExit(): void {
    this.isExiting = false;
    this.pendingStop = false;
    this.marketExitAttempts = 0;
    this.cancelTimer('MARKET_EXIT_CHECK');
    this.log('Market exit complete');
    this.onPostMarketExit();

    // 如果有等待中的停止请求，执行停止
    if (this.pendingStop) {
      this.stop();
    }
  }

  // 取消市场退出
  cancelMarketExit(): void {
    this.cancelTimer('MARKET_EXIT_CHECK');
    this.isExiting = false;
    this.pendingStop = false;
    this.marketExitAttempts = 0;
  }

  /**
   * 安全停止策略。若 manageStop 启用则先执行市场退出。
   */
  safeStop(): void {
    if (this.state !== ComponentState.Running) {
      this.stop();
      return;
    }

    if (this.config.manageStop) {
      if (this.pendingStop) return;  // 已在等待停止
      this.pendingStop = true;

      if (!this.isExiting) {
        this.marketExit();
      }
      return;
    }

    // manageStop 未启用：直接取消退出并立即停止
    if (this.isExiting) {
      this.cancelMarketExit();
    }
    this.stop();
  }

  // ── 市场退出钩子（子类可覆写）──

  protected onMarketExit(): void {}
  protected onPostMarketExit(): void {}

  // 是否正在市场退出
  get isExitingMarket(): boolean {
    return this.isExiting;
  }

  // ── 持仓辅助 ──

  /** 根据成交事件更新持仓（由引擎调用） */
  updatePositionFromFill(order: Order, fillPrice: Price, fillQty: Quantity): void {
    let position = this.cache.position(order.instrumentId);
    if (!position) {
      position = createPosition(order.instrumentId);
      this.cache.addPosition(position);
    }

    if (order.side === OrderSide.Buy) {
      // 买入：开仓或加仓
      if (!isPositionOpen(position)) {
        openPosition(position, fillQty, fillPrice, order.tsLast!);
        this.onPositionOpened(position);
      } else {
        addToPosition(position, fillQty, fillPrice, order.tsLast!);
        this.onPositionChanged(position);
      }
    } else {
      // 卖出：减仓或清仓
      if (isPositionOpen(position)) {
        const result = closePosition(position, fillQty, fillPrice, order.tsLast!);
        this.onPositionChanged(position);
        if (position.side === PositionSide.Flat) {
          this.onPositionClosed(position);
        }
      }
    }
  }

  /** 更新所有未平仓持仓的未实现盈亏 */
  updateUnrealizedPnls(): void {
    for (const position of this.cache.positionsOpen(this.id)) {
      const lastPrice = this.lastPrices.get(position.instrumentId.toString());
      if (lastPrice) {
        updateUnrealizedPnl(position, lastPrice);
      }
    }
  }

  // ── 数据分发覆写 ──

  override onBar(bar: Bar): void {
    // 跟踪最新价格
    this.lastPrices.set(bar.instrumentId.toString(), bar.close);
    this.cache.addBar(bar);
    this.cache.addPricePoint(bar.instrumentId, Number(bar.close.value));
  }

  // ── 生命周期覆写 ──

  protected override onStart(): void {
    this.log(`Starting ${this.id.value}`);

    // 若启用了 GTD 过期管理，重新激活定时器
    if (this.config.manageGtdExpiry) {
      this.reactivateGtdTimers();
    }
  }

  protected override onStop(): void {
    this.log(`Stopping ${this.id.value}`);
  }

  protected override onReset(): void {
    this.cache.clear();
    this.lastPrices.clear();
    this.isExiting = false;
    this.pendingStop = false;
    this.marketExitAttempts = 0;
  }

  // ── GTD 定时器管理 ──

  private reactivateGtdTimers(): void {
    // 对于可能在上一轮运行中有待处理 GTD 订单的策略，
    // 根据缓存中的订单数据重新注册定时器。
    // 此功能需要扩展 Order 模型以支持 expireTime。
    const openOrders = this.cache.ordersOpen(this.id);
    for (const order of openOrders) {
      // 如果订单有过期时间（存储在元数据中），重新设置定时器
    }
  }

  // ── 投资组合 / 风控访问 ──

  // 获取投资组合实例
  getPortfolio(): Portfolio {
    return this.portfolio;
  }

  // 获取风控引擎实例
  getRiskEngine(): RiskEngine {
    return this.riskEngine;
  }

  // 设置风控限制
  setRiskLimits(limits: RiskLimits): void {
    this.riskEngine = new RiskEngine(this.portfolio, limits, this.lastPrices);
  }
}
