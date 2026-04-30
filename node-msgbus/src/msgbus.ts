/**
 * MessageBus — core message bus for intra-process communication.
 *
 * Mirrors the Rust `MessageBus` in `crates/common/src/msgbus/core.rs`.
 *
 * Provides:
 *   - Typed Pub/Sub:  publish_quote, subscribe_quotes, etc. (zero downcast)
 *   - Any-based Pub/Sub: publish_any, subscribe_any (flexible, for custom types)
 *   - Point-to-Point: register endpoint + send (single destination)
 *   - Request/Response: correlation_id-based response routing
 */

import { Topic, Pattern, Endpoint, Subscription } from "./types.js";
import { isMatch } from "./matching.js";
import { TopicRouter } from "./topic-router.js";
import { EndpointMap, IntoEndpointMap } from "./endpoint-map.js";
import { Handler, AnyHandler } from "./handler.js";
import { MessagingSwitchboard } from "./switchboard.js";

// Domain models
import {
  QuoteTick,
  TradeTick,
  Bar,
  OrderBookDeltas,
  OrderBookDelta,
  OrderBookDeltas as OrderBookDeltasType,
  OrderEventAny,
  PositionEvent,
  AccountState,
  TradingCommand,
  DataCommand,
  DataResponse,
  isQuoteTick,
  isTradeTick,
  isBar,
  isOrderEvent,
  isAccountState,
  isPositionEvent,
  isOrderBookDeltas,
  isTradingCommand,
  isDataCommand,
  isDataResponse,
  isData,
} from "./models.js";

// ── OrderBook type (simplified) ─────────────────────────────────────

export interface OrderBook {
  instrumentId: { venue: string; symbol: string; toString(): string };
  bids: Map<number, number>;
  asks: Map<number, number>;
}

export const isOrderBook = (m: unknown): m is OrderBook =>
  typeof m === "object" && m !== null && "bids" in m && "asks" in m;

// ── Subscription record (for any-based routing) ─────────────────────

interface AnySubscription extends Subscription {
  handler: AnyHandler;
}

// ── MessageBus ──────────────────────────────────────────────────────

export class MessageBus {
  /** Identifiers */
  traderId: string;
  instanceId: string;
  name: string;

  /** Switchboard for topic generation */
  switchboard: MessagingSwitchboard;

  // ── Typed Pub/Sub Routers ───────────────────────────────────────
  routerQuotes = new TopicRouter<QuoteTick>();
  routerTrades = new TopicRouter<TradeTick>();
  routerBars = new TopicRouter<Bar>();
  routerDeltas = new TopicRouter<OrderBookDeltasType>();
  routerBookSnapshots = new TopicRouter<OrderBook>();
  routerMarkPrices = new TopicRouter<{ instrumentId: { venue: string; symbol: string; toString(): string }; price: number }>();
  routerIndexPrices = new TopicRouter<{ instrumentId: { venue: string; symbol: string; toString(): string }; price: number }>();
  routerFundingRates = new TopicRouter<{ instrumentId: { venue: string; symbol: string; toString(): string }; rate: number }>();
  routerOrderEvents = new TopicRouter<OrderEventAny>();
  routerPositionEvents = new TopicRouter<PositionEvent>();
  routerAccountState = new TopicRouter<AccountState>();

  // ── Typed Endpoints (Point-to-Point) ────────────────────────────
  endpointsQuotes = new EndpointMap<QuoteTick>();
  endpointsTrades = new EndpointMap<TradeTick>();
  endpointsBars = new EndpointMap<Bar>();
  endpointsAccountState = new EndpointMap<AccountState>();
  endpointsTradingCommands = new IntoEndpointMap<TradingCommand>();
  endpointsDataCommands = new IntoEndpointMap<DataCommand>();
  endpointsDataResponses = new IntoEndpointMap<DataResponse>();
  endpointsOrderEvents = new IntoEndpointMap<OrderEventAny>();

  // ── Any-based Pub/Sub ───────────────────────────────────────────
  private subscriptions: AnySubscription[] = [];
  private topics = new Map<Topic, AnySubscription[]>();
  private anyEndpoints = new Map<Endpoint, AnyHandler>();

  // ── Request/Response ────────────────────────────────────────────
  private correlationIndex = new Map<string, AnyHandler>();

  constructor(traderId = "TRADER-001", instanceId = crypto.randomUUID()) {
    this.traderId = traderId;
    this.instanceId = instanceId;
    this.name = "MessageBus";
    this.switchboard = new MessagingSwitchboard();
  }

  // ═══════════════════════════════════════════════════════════════
  //  Typed Pub/Sub API
  // ═══════════════════════════════════════════════════════════════

  subscribeQuotes(pattern: Pattern, handler: Handler<QuoteTick>, priority = 0): void {
    this.routerQuotes.subscribe(pattern, handler, priority);
  }

  unsubscribeQuotes(pattern: Pattern, handlerId: string): boolean {
    return this.routerQuotes.unsubscribe(pattern, handlerId);
  }

  publishQuote(topic: Topic, quote: QuoteTick): void {
    this.routerQuotes.publish(topic, quote);
  }

  subscribeTrades(pattern: Pattern, handler: Handler<TradeTick>, priority = 0): void {
    this.routerTrades.subscribe(pattern, handler, priority);
  }

  unsubscribeTrades(pattern: Pattern, handlerId: string): boolean {
    return this.routerTrades.unsubscribe(pattern, handlerId);
  }

  publishTrade(topic: Topic, trade: TradeTick): void {
    this.routerTrades.publish(topic, trade);
  }

  subscribeBars(pattern: Pattern, handler: Handler<Bar>, priority = 0): void {
    this.routerBars.subscribe(pattern, handler, priority);
  }

  unsubscribeBars(pattern: Pattern, handlerId: string): boolean {
    return this.routerBars.unsubscribe(pattern, handlerId);
  }

  publishBar(topic: Topic, bar: Bar): void {
    this.routerBars.publish(topic, bar);
  }

  subscribeBookDeltas(pattern: Pattern, handler: Handler<OrderBookDeltasType>, priority = 0): void {
    this.routerDeltas.subscribe(pattern, handler, priority);
  }

  unsubscribeBookDeltas(pattern: Pattern, handlerId: string): boolean {
    return this.routerDeltas.unsubscribe(pattern, handlerId);
  }

  publishBookDeltas(topic: Topic, deltas: OrderBookDeltasType): void {
    this.routerDeltas.publish(topic, deltas);
  }

  subscribeBookSnapshots(pattern: Pattern, handler: Handler<OrderBook>, priority = 0): void {
    this.routerBookSnapshots.subscribe(pattern, handler, priority);
  }

  publishBookSnapshot(topic: Topic, book: OrderBook): void {
    this.routerBookSnapshots.publish(topic, book);
  }

  subscribeOrderEvents(pattern: Pattern, handler: Handler<OrderEventAny>, priority = 0): void {
    this.routerOrderEvents.subscribe(pattern, handler, priority);
  }

  unsubscribeOrderEvents(pattern: Pattern, handlerId: string): boolean {
    return this.routerOrderEvents.unsubscribe(pattern, handlerId);
  }

  publishOrderEvent(topic: Topic, event: OrderEventAny): void {
    this.routerOrderEvents.publish(topic, event);
  }

  subscribePositionEvents(pattern: Pattern, handler: Handler<PositionEvent>, priority = 0): void {
    this.routerPositionEvents.subscribe(pattern, handler, priority);
  }

  publishPositionEvent(topic: Topic, event: PositionEvent): void {
    this.routerPositionEvents.publish(topic, event);
  }

  subscribeAccountState(pattern: Pattern, handler: Handler<AccountState>, priority = 0): void {
    this.routerAccountState.subscribe(pattern, handler, priority);
  }

  publishAccountState(topic: Topic, state: AccountState): void {
    this.routerAccountState.publish(topic, state);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Any-based Pub/Sub API
  // ═══════════════════════════════════════════════════════════════

  subscribeAny(pattern: Pattern, handler: AnyHandler, priority = 0): void {
    const sub: AnySubscription = {
      pattern,
      id: `any-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      priority,
      handler,
    };

    if (this.subscriptions.some((s) => s.pattern === pattern && s.id === sub.id)) {
      return;
    }

    // Update cached topics
    for (const [topic, subs] of this.topics) {
      if (isMatch(topic, pattern)) {
        subs.push(sub);
        subs.sort((a, b) => b.priority - a.priority);
      }
    }

    this.subscriptions.push(sub);
  }

  unsubscribeAny(pattern: Pattern, handlerId: string): void {
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.pattern === pattern && s.id === handlerId),
    );
    for (const subs of this.topics.values()) {
      subs.splice(
        subs.findIndex((s) => s.pattern === pattern && s.id === handlerId),
        1,
      );
    }
  }

  publishAny(topic: Topic, message: unknown): void {
    let subs = this.topics.get(topic);
    if (subs === undefined) {
      subs = this.subscriptions.filter((s) => isMatch(topic, s.pattern));
      subs.sort((a, b) => b.priority - a.priority);
      this.topics.set(topic, subs);
    }
    for (const sub of subs) {
      sub.handler(message);
    }
  }

  hasSubscribers(topic: Topic): boolean {
    return this.subscriptionsCount(topic) > 0;
  }

  subscriptionsCount(topic: Topic): number {
    return this.subscriptions.filter((s) => isMatch(topic, s.pattern)).length;
  }

  patterns(): Pattern[] {
    return this.subscriptions.map((s) => s.pattern);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Typed Endpoint API
  // ═══════════════════════════════════════════════════════════════

  registerQuoteEndpoint(endpoint: Endpoint, handler: Handler<QuoteTick>): void {
    this.endpointsQuotes.register(endpoint, handler);
  }

  sendQuote(endpoint: Endpoint, quote: QuoteTick): void {
    if (!this.endpointsQuotes.send(endpoint, quote)) {
      console.error(`sendQuote: no registered endpoint '${endpoint}'`);
    }
  }

  registerTradeEndpoint(endpoint: Endpoint, handler: Handler<TradeTick>): void {
    this.endpointsTrades.register(endpoint, handler);
  }

  sendTrade(endpoint: Endpoint, trade: TradeTick): void {
    if (!this.endpointsTrades.send(endpoint, trade)) {
      console.error(`sendTrade: no registered endpoint '${endpoint}'`);
    }
  }

  registerBarEndpoint(endpoint: Endpoint, handler: Handler<Bar>): void {
    this.endpointsBars.register(endpoint, handler);
  }

  sendBar(endpoint: Endpoint, bar: Bar): void {
    if (!this.endpointsBars.send(endpoint, bar)) {
      console.error(`sendBar: no registered endpoint '${endpoint}'`);
    }
  }

  registerAccountStateEndpoint(endpoint: Endpoint, handler: Handler<AccountState>): void {
    this.endpointsAccountState.register(endpoint, handler);
  }

  sendAccountState(endpoint: Endpoint, state: AccountState): void {
    if (!this.endpointsAccountState.send(endpoint, state)) {
      console.error(`sendAccountState: no registered endpoint '${endpoint}'`);
    }
  }

  registerTradingCommandEndpoint(
    endpoint: Endpoint,
    handler: (cmd: TradingCommand) => void,
  ): void {
    this.endpointsTradingCommands.register(endpoint, handler);
  }

  sendTradingCommand(endpoint: Endpoint, command: TradingCommand): void {
    if (!this.endpointsTradingCommands.send(endpoint, command)) {
      console.error(`sendTradingCommand: no registered endpoint '${endpoint}'`);
    }
  }

  registerDataCommandEndpoint(
    endpoint: Endpoint,
    handler: (cmd: DataCommand) => void,
  ): void {
    this.endpointsDataCommands.register(endpoint, handler);
  }

  sendDataCommand(endpoint: Endpoint, command: DataCommand): void {
    if (!this.endpointsDataCommands.send(endpoint, command)) {
      console.error(`sendDataCommand: no registered endpoint '${endpoint}'`);
    }
  }

  registerDataResponseEndpoint(
    endpoint: Endpoint,
    handler: (resp: DataResponse) => void,
  ): void {
    this.endpointsDataResponses.register(endpoint, handler);
  }

  sendDataResponse(endpoint: Endpoint, response: DataResponse): void {
    if (!this.endpointsDataResponses.send(endpoint, response)) {
      console.error(`sendDataResponse: no registered endpoint '${endpoint}'`);
    }
  }

  registerOrderEventEndpoint(
    endpoint: Endpoint,
    handler: (event: OrderEventAny) => void,
  ): void {
    this.endpointsOrderEvents.register(endpoint, handler);
  }

  sendOrderEvent(endpoint: Endpoint, event: OrderEventAny): void {
    if (!this.endpointsOrderEvents.send(endpoint, event)) {
      console.error(`sendOrderEvent: no registered endpoint '${endpoint}'`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Any-based Endpoint API
  // ═══════════════════════════════════════════════════════════════

  registerAny(endpoint: Endpoint, handler: AnyHandler): void {
    this.anyEndpoints.set(endpoint, handler);
  }

  deregisterAny(endpoint: Endpoint): void {
    this.anyEndpoints.delete(endpoint);
  }

  sendAny(endpoint: Endpoint, message: unknown): void {
    const handler = this.anyEndpoints.get(endpoint);
    if (handler) {
      handler(message);
    } else {
      console.error(`sendAny: no registered endpoint '${endpoint}'`);
    }
  }

  isRegistered(endpoint: Endpoint): boolean {
    return this.anyEndpoints.has(endpoint);
  }

  endpoints(): Endpoint[] {
    return [...this.anyEndpoints.keys()];
  }

  // ═══════════════════════════════════════════════════════════════
  //  Request/Response API
  // ═══════════════════════════════════════════════════════════════

  registerResponseHandler(correlationId: string, handler: AnyHandler): boolean {
    if (this.correlationIndex.has(correlationId)) {
      console.error(`Correlation ID '${correlationId}' already has a registered handler`);
      return false;
    }
    this.correlationIndex.set(correlationId, handler);
    return true;
  }

  sendResponse(correlationId: string, response: DataResponse): void {
    const handler = this.correlationIndex.get(correlationId);
    if (handler) {
      handler(response);
    } else {
      console.error(`sendResponse: handler not found for correlation_id '${correlationId}'`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════

  dispose(): void {
    this.subscriptions = [];
    this.topics.clear();
    this.anyEndpoints.clear();
    this.correlationIndex.clear();

    this.routerQuotes.clear();
    this.routerTrades.clear();
    this.routerBars.clear();
    this.routerDeltas.clear();
    this.routerBookSnapshots.clear();
    this.routerMarkPrices.clear();
    this.routerIndexPrices.clear();
    this.routerFundingRates.clear();
    this.routerOrderEvents.clear();
    this.routerPositionEvents.clear();
    this.routerAccountState.clear();

    this.endpointsQuotes.clear();
    this.endpointsTrades.clear();
    this.endpointsBars.clear();
    this.endpointsAccountState.clear();
    this.endpointsTradingCommands.clear();
    this.endpointsDataCommands.clear();
    this.endpointsDataResponses.clear();
    this.endpointsOrderEvents.clear();
  }
}
