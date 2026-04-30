/**
 * Example: complete data flow through the message bus.
 *
 * Demonstrates:
 *   1. Instrument sync → instrument registration
 *   2. Real-time quote/trade/bar subscriptions
 *   3. Order lifecycle (submit → accept → fill)
 *   4. Any-based pub/sub for custom types
 *   5. Point-to-point endpoints
 *   6. Request/response with correlation IDs
 *
 * Run: npm run example
 */

import { MessageBus } from "./msgbus.js";
import { MessagingSwitchboard } from "./switchboard.js";
import { instrumentId, isQuoteTick, isTradeTick } from "./models.js";

const btcUsdt = instrumentId("OKX", "BTC-USDT");
const ethUsdt = instrumentId("OKX", "ETH-USDT");

const bus = new MessageBus("TRADER-001");
const sb = bus.switchboard;

// ═══════════════════════════════════════════════════════════════
//  1. Subscribe to market data (typed pub/sub)
// ═══════════════════════════════════════════════════════════════

console.log("=== 1. Typed Pub/Sub ===\n");

const quoteHandlerId = `quote-${Date.now()}`;
bus.subscribeQuotes(
  `data.quotes.${btcUsdt.venue}.*`,
  (quote) => {
    console.log(
      `[Quote] ${quote.instrumentId} bid=${quote.bidPrice} ask=${quote.askPrice}`,
    );
  },
  10, // priority
);

bus.subscribeTrades(
  `data.trades.${btcUsdt.venue}.*`,
  (trade) => {
    console.log(
      `[Trade] ${trade.instrumentId} price=${trade.price} qty=${trade.quantity} side=${trade.aggressorSide}`,
    );
  },
  5,
);

// Publish simulated data
const quoteTopic = sb.quotesTopic(btcUsdt);
const tradeTopic = sb.tradesTopic(btcUsdt);

bus.publishQuote(quoteTopic, {
  instrumentId: btcUsdt,
  bidPrice: 69520,
  askPrice: 69525,
  bidSize: 2.5,
  askSize: 1.8,
  tsEvent: 1712390400000000000n,
  tsInit: 1712390400001000000n,
});

bus.publishTrade(tradeTopic, {
  instrumentId: btcUsdt,
  price: 69523.4,
  quantity: 0.05,
  aggressorSide: "BUYER",
  venueTradeId: "98765",
  tsEvent: 1712390400123000000n,
  tsInit: 1712390400124000000n,
});

// ═══════════════════════════════════════════════════════════════
//  2. Any-based pub/sub (flexible, for custom types)
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 2. Any-based Pub/Sub ===\n");

bus.subscribeAny("events.*", (msg) => {
  console.log(`[Any events.*] received: ${typeof msg === "object" ? JSON.stringify(msg).slice(0, 80) : msg}`);
});

bus.subscribeAny("events.order.*", (msg) => {
  if (isQuoteTick(msg)) {
    console.log(`[Any order handler] quote: bid=${msg.bidPrice}`);
  } else {
    console.log(`[Any order handler] other: ${typeof msg}`);
  }
});

bus.publishAny("events.order.strategy-001", { kind: "Filled", venueOrderId: "123456" });

// ═══════════════════════════════════════════════════════════════
//  3. Order lifecycle via endpoints
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 3. Order Lifecycle (Endpoints) ===\n");

// Register risk engine endpoint
bus.registerTradingCommandEndpoint(
  "RiskEngine.queue_execute",
  (cmd) => {
    console.log(`[RiskEngine] received command: ${cmd.type}`);
    if (cmd.type === "SubmitOrder") {
      console.log("  → Risk check passed, forwarding to ExecEngine");
    }
  },
);

// Register execution engine endpoint
bus.registerOrderEventEndpoint(
  "ExecEngine.process",
  (event) => {
    console.log(`[ExecEngine] order event: ${event.kind} (${event.clientOrderId})`);
  },
);

// Simulate order flow
bus.sendTradingCommand("RiskEngine.queue_execute", {
  type: "SubmitOrder",
  payload: { instrument: "BTC-USDT", side: "BUY", qty: 0.01, price: 69500 },
});

bus.sendOrderEvent("ExecEngine.process", {
  kind: "Initialized",
  traderId: "TRADER-001",
  strategyId: "STRAT-001",
  instrumentId: btcUsdt,
  clientOrderId: "O-20240406-001",
  orderType: "LIMIT",
  orderSide: "BUY",
  quantity: 0.01,
  price: 69500,
  tsEvent: 1712390400000000000n,
  tsInit: 1712390400001000000n,
});

bus.sendOrderEvent("ExecEngine.process", {
  kind: "Accepted",
  traderId: "TRADER-001",
  strategyId: "STRAT-001",
  instrumentId: btcUsdt,
  clientOrderId: "O-20240406-001",
  venueOrderId: "1234567890",
  orderType: "LIMIT",
  orderSide: "BUY",
  quantity: 0.01,
  price: 69500,
  tsEvent: 1712390401000000000n,
  tsInit: 1712390401001000000n,
});

bus.sendOrderEvent("ExecEngine.process", {
  kind: "Filled",
  traderId: "TRADER-001",
  strategyId: "STRAT-001",
  instrumentId: btcUsdt,
  clientOrderId: "O-20240406-001",
  venueOrderId: "1234567890",
  orderType: "LIMIT",
  orderSide: "BUY",
  quantity: 0.01,
  price: 69500,
  lastQty: 0.01,
  lastPx: 69500,
  commission: 0.695,
  tsEvent: 1712390402000000000n,
  tsInit: 1712390402001000000n,
});

// ═══════════════════════════════════════════════════════════════
//  4. Request/Response with correlation ID
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 4. Request/Response ===\n");

const correlationId = crypto.randomUUID();

bus.registerResponseHandler(correlationId, (resp) => {
  console.log(`[Strategy] got response: type=${resp.type}`);
  if (resp.type === "Bars") {
    console.log(`  → received ${resp.data.length} bars`);
    for (const bar of resp.data) {
      console.log(`     O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close} V=${bar.volume}`);
    }
  }
});

// Simulate data engine responding
bus.sendResponse(correlationId, {
  type: "Bars",
  correlationId,
  data: [
    {
      instrumentId: btcUsdt,
      barType: "1-HOUR-LAST-EXTERNAL",
      open: 69500,
      high: 69800,
      low: 69200,
      close: 69650,
      volume: 1234.5678,
      tsEvent: 1712390400000000000n,
      tsInit: 1712390400001000000n,
    },
    {
      instrumentId: btcUsdt,
      barType: "1-HOUR-LAST-EXTERNAL",
      open: 69650,
      high: 70100,
      low: 69500,
      close: 70000,
      volume: 2345.6789,
      tsEvent: 1712394000000000000n,
      tsInit: 1712394000001000000n,
    },
  ],
});

// ═══════════════════════════════════════════════════════════════
//  5. Wildcard pattern matching
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 5. Wildcard Patterns ===\n");

let receivedCount = 0;
const multiHandlerId = `multi-${Date.now()}`;

bus.subscribeQuotes("data.quotes.*", (q) => {
  receivedCount++;
  console.log(`[Wildcard] quote for ${q.instrumentId}`);
});

// Publish to multiple instruments
const btcTopic = sb.quotesTopic(btcUsdt);
const ethTopic = sb.quotesTopic(ethUsdt);

bus.publishQuote(btcTopic, {
  instrumentId: btcUsdt,
  bidPrice: 69520,
  askPrice: 69525,
  bidSize: 2.5,
  askSize: 1.8,
  tsEvent: 1712390400000000000n,
  tsInit: 1712390400001000000n,
});

bus.publishQuote(ethTopic, {
  instrumentId: ethUsdt,
  bidPrice: 3450,
  askPrice: 3451,
  bidSize: 10,
  askSize: 8,
  tsEvent: 1712390400000000000n,
  tsInit: 1712390400001000000n,
});

console.log(`\nTotal wildcard matches: ${receivedCount}`);

// ═══════════════════════════════════════════════════════════════
//  6. Topic name conventions (switchboard)
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 6. Topic Names ===\n");

console.log(`quotes topic:     ${sb.quotesTopic(btcUsdt)}`);
console.log(`trades topic:     ${sb.tradesTopic(btcUsdt)}`);
console.log(`bars topic:       ${sb.barsTopic("1-HOUR-LAST-EXTERNAL")}`);
console.log(`deltas topic:     ${sb.bookDeltasTopic(btcUsdt)}`);
console.log(`fills topic:      ${sb.orderFillsTopic(btcUsdt)}`);
console.log(`orders topic:     ${sb.eventOrdersTopic("STRAT-001")}`);
console.log(`shutdown topic:   ${MessagingSwitchboard.shutdownSystemTopic()}`);
console.log(`risk engine:      ${MessagingSwitchboard.riskEngineQueueExecute()}`);
console.log(`exec engine:      ${MessagingSwitchboard.execEngineExecute()}`);

// ═══════════════════════════════════════════════════════════════
//  7. Re-entrant calls (handler calls back into bus)
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 7. Re-entrant Calls ===\n");

let step = 0;

bus.registerTradingCommandEndpoint("Test.cancelEndpoint", (cmd) => {
  step++;
  console.log(`  Step ${step}: Cancel command received (${cmd.type})`);
});

// An order event endpoint handler that triggers a cancel command
bus.registerOrderEventEndpoint("ReentrantTest.process", (event) => {
  if (event.kind === "Accepted") {
    step++;
    console.log(`  Step ${step}: Order accepted, sending cancel...`);
    bus.sendTradingCommand("Test.cancelEndpoint", {
      type: "CancelOrder",
      clientOrderId: event.clientOrderId,
    });
    step++;
    console.log(`  Step ${step}: Cancel sent (re-entrant call succeeded)`);
  }
});

bus.sendOrderEvent("ReentrantTest.process", {
  kind: "Accepted",
  traderId: "TRADER-001",
  strategyId: "STRAT-001",
  instrumentId: btcUsdt,
  clientOrderId: "O-REENTRANT-001",
  venueOrderId: "999",
  orderType: "LIMIT",
  orderSide: "BUY",
  quantity: 0.01,
  price: 69500,
  tsEvent: 1712390500000000000n,
  tsInit: 1712390500001000000n,
});

console.log("\n=== Done ===");
bus.dispose();
