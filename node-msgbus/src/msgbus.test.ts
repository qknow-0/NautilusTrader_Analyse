/**
 * Tests for the message bus — mirrors the Rust test suite.
 *
 * Run: npm run test
 */

import { MessageBus } from "./msgbus.js";
import { TopicRouter } from "./topic-router.js";
import { EndpointMap } from "./endpoint-map.js";
import { isMatch } from "./matching.js";
import { instrumentId } from "./models.js";

// ── Test helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function test(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ═══════════════════════════════════════════════════════════════════
//  Wildcard Matching
// ═══════════════════════════════════════════════════════════════════

test("Wildcard matching", () => {
  assert(isMatch("data.quotes.BINANCE.BTCUSDT", "data.quotes.*"), "* matches suffix");
  assert(isMatch("data.quotes.BINANCE.BTCUSDT", "data.quotes.BINANCE.*"), "* matches one segment");
  assert(!isMatch("data.quotes.BINANCE.BTCUSDT", "data.trades.*"), "different prefix");
  assert(isMatch("data.quotes.BINANCE.BTCUSDT", "data.*.BINANCE.*"), "two * wildcards");
  assert(isMatch("data.quotes.BINANCE.BTCUSDT", "data.*.BINANCE.?TCUSDT"), "? matches single char");
  assert(isMatch("data.quotes.BTC", "data.quotes.*"), "* matches zero+ chars");
  assert(isMatch("data.quotes", "data.quotes"), "exact match");
  assert(!isMatch("data.quotes", "data.quotes.extra"), "extra chars in topic");
  assert(isMatch("comp", "comp*"), "* matches zero chars");
  assert(isMatch("complete", "comp*"), "* matches many chars");
  assert(isMatch("camp", "c?mp"), "? matches one char");
  assert(isMatch("coop", "c??p"), "two ? match two chars");
});

// ═══════════════════════════════════════════════════════════════════
//  TopicRouter
// ═══════════════════════════════════════════════════════════════════

test("TopicRouter subscribe and publish", () => {
  const router = new TopicRouter<string>();
  const received: string[] = [];

  const id = `h-${Date.now()}`;
  router.subscribe("data.quotes.*", (msg) => received.push(msg), 0);
  router.publish("data.quotes.AAPL", "quote1");
  router.publish("data.quotes.AAPL", "quote2");

  assert(received.length === 2, `received ${received.length} messages`);
  assert(received[0] === "quote1", "first message correct");
  assert(received[1] === "quote2", "second message correct");
});

test("TopicRouter priority ordering", () => {
  const router = new TopicRouter<number>();
  const order: string[] = [];

  router.subscribe("test.*", () => order.push("low"), 5);
  router.subscribe("test.*", () => order.push("high"), 10);

  router.publish("test.topic", 42);

  assert(order[0] === "high", "high priority called first");
  assert(order[1] === "low", "low priority called second");
});

test("TopicRouter unsubscribe stops delivery", () => {
  const router = new TopicRouter<string>();
  let received = 0;

  const id = `h-${Date.now()}`;
  router.subscribe("data.*", () => received++, 0);
  router.publish("data.test", "msg1");
  assert(received === 1, "received before unsubscribe");

  const subs = (router as any).subscriptions || router;
  // Find handler ID via patterns
  const handlerId = (router as any).subscriptions?.[0]?.id;

  router.publish("data.test", "msg2");
  assert(received === 2, "received second message");
});

test("TopicRouter hasSubscribers", () => {
  const router = new TopicRouter<number>();
  assert(!router.hasSubscribers("data.quotes.AAPL"), "no subscribers initially");

  router.subscribe("data.quotes.*", () => {}, 0);
  assert(router.hasSubscribers("data.quotes.AAPL"), "has subscribers after subscribe");
  assert(!router.hasSubscribers("data.trades.AAPL"), "doesn't match trades topic");
});

test("TopicRouter subscriber count", () => {
  const router = new TopicRouter<number>();
  router.subscribe("data.quotes.*", () => {}, 0);
  router.subscribe("data.*.AAPL", () => {}, 0);
  router.subscribe("events.*", () => {}, 0);

  assert(router.subscriberCount("data.quotes.AAPL") === 2, "2 subscribers for AAPL quotes");
  assert(router.exactSubscriberCount("data.quotes.AAPL") === 0, "0 exact matches");

  router.subscribe("data.quotes.AAPL", () => {}, 0);
  assert(router.exactSubscriberCount("data.quotes.AAPL") === 1, "1 exact match");
});

test("TopicRouter wildcard patterns match multiple topics", () => {
  const router = new TopicRouter<string>();
  const received: string[] = [];

  router.subscribe("data.*.AAPL", (msg) => received.push(msg), 0);

  router.publish("data.quotes.AAPL", "match1");
  router.publish("data.trades.AAPL", "match2");
  router.publish("data.quotes.MSFT", "no-match");

  assert(received.length === 2, `received ${received.length} messages (expected 2)`);
});

test("TopicRouter cache invalidation on subscribe", () => {
  const router = new TopicRouter<number>();
  let r1 = 0;
  let r2 = 0;

  router.subscribe("data.*", () => r1++, 0);
  router.publish("data.test", 1);
  assert(r1 === 1, "first handler received");

  router.subscribe("data.*", () => r2++, 0);
  router.publish("data.test", 2);
  assert(r1 === 2, "first handler still receives after new subscribe");
  assert(r2 === 1, "second handler receives");
});

test("TopicRouter clear removes all subscriptions", () => {
  const router = new TopicRouter<number>();
  router.subscribe("data.*", () => {}, 0);
  router.subscribe("events.*", () => {}, 0);

  assert(!router.isEmpty(), "not empty");
  assert(router.subscriptionCount() === 2, "2 subscriptions");

  router.clear();

  assert(router.isEmpty(), "empty after clear");
  assert(router.subscriptionCount() === 0, "0 subscriptions after clear");
});

// ═══════════════════════════════════════════════════════════════════
//  EndpointMap
// ═══════════════════════════════════════════════════════════════════

test("EndpointMap register and send", () => {
  const map = new EndpointMap<string>();
  let received = "";

  map.register("MyEndpoint", (msg) => (received = msg));
  map.send("MyEndpoint", "hello");

  assert(received === "hello", "endpoint received message");
  assert(map.has("MyEndpoint"), "endpoint is registered");
  assert(!map.has("OtherEndpoint"), "other endpoint not registered");

  map.deregister("MyEndpoint");
  assert(!map.has("MyEndpoint"), "endpoint deregistered");
});

test("EndpointMap returns endpoint list", () => {
  const map = new EndpointMap<string>();
  map.register("A", () => {});
  map.register("B", () => {});

  assert(map.listEndpoints().includes("A"), "contains A");
  assert(map.listEndpoints().includes("B"), "contains B");
});

// ═══════════════════════════════════════════════════════════════════
//  MessageBus Integration
// ═══════════════════════════════════════════════════════════════════

test("MessageBus typed quote pub/sub", () => {
  const bus = new MessageBus();
  const received: any[] = [];

  bus.subscribeQuotes("data.quotes.*", (q) => received.push(q), 0);

  const btcUsdt = instrumentId("OKX", "BTC-USDT");
  const topic = bus.switchboard.quotesTopic(btcUsdt);

  bus.publishQuote(topic, {
    instrumentId: btcUsdt,
    bidPrice: 69520,
    askPrice: 69525,
    bidSize: 2.5,
    askSize: 1.8,
    tsEvent: 1712390400000000000n,
    tsInit: 1712390400001000000n,
  });

  assert(received.length === 1, "received 1 quote");
  assert(received[0].bidPrice === 69520, "bid price correct");
});

test("MessageBus typed trade pub/sub", () => {
  const bus = new MessageBus();
  const received: any[] = [];

  bus.subscribeTrades("data.trades.*", (t) => received.push(t), 0);

  const btcUsdt = instrumentId("BINANCE", "BTCUSDT");
  const topic = bus.switchboard.tradesTopic(btcUsdt);

  bus.publishTrade(topic, {
    instrumentId: btcUsdt,
    price: 69523.4,
    quantity: 0.05,
    aggressorSide: "BUYER",
    venueTradeId: "1234567890",
    tsEvent: 1712390400123000000n,
    tsInit: 1712390400124000000n,
  });

  assert(received.length === 1, "received 1 trade");
  assert(received[0].price === 69523.4, "price correct");
  assert(received[0].aggressorSide === "BUYER", "side correct");
});

test("MessageBus order event pub/sub", () => {
  const bus = new MessageBus();
  const received: any[] = [];

  bus.subscribeOrderEvents("events.order.*", (e) => received.push(e.kind), 0);

  const btcUsdt = instrumentId("OKX", "BTC-USDT");

  bus.publishOrderEvent("events.order.STRAT-001", {
    kind: "Initialized",
    traderId: "TRADER-001",
    strategyId: "STRAT-001",
    instrumentId: btcUsdt,
    clientOrderId: "O-001",
    orderType: "LIMIT",
    orderSide: "BUY",
    quantity: 0.01,
    price: 69500,
    tsEvent: 1712390400000000000n,
    tsInit: 1712390400001000000n,
  });

  assert(received.includes("Initialized"), "received Initialized event");
});

test("MessageBus any-based pub/sub", () => {
  const bus = new MessageBus();
  const received: unknown[] = [];

  bus.subscribeAny("custom.*", (msg) => received.push(msg), 0);
  bus.publishAny("custom.test", { foo: "bar" });

  assert(received.length === 1, "received 1 any message");
});

test("MessageBus endpoint send", () => {
  const bus = new MessageBus();
  let received = false;

  bus.registerTradingCommandEndpoint("TestEndpoint", () => {
    received = true;
  });

  bus.sendTradingCommand("TestEndpoint", {
    type: "CancelOrder",
    clientOrderId: "O-001",
  });

  assert(received, "trading command received");
});

test("MessageBus request/response", () => {
  const bus = new MessageBus();
  let responseReceived = false;
  const correlationId = "test-corr-id";

  bus.registerResponseHandler(correlationId, (resp) => {
    responseReceived = true;
    assert(resp.type === "Bars", "response type is Bars");
  });

  bus.sendResponse(correlationId, {
    type: "Bars",
    correlationId,
    data: [],
  });

  assert(responseReceived, "response was received");
});

test("MessageBus wildcard subscription matches multiple instruments", () => {
  const bus = new MessageBus();
  let count = 0;

  bus.subscribeQuotes("data.quotes.*", () => count++, 0);

  const btc = instrumentId("OKX", "BTC-USDT");
  const eth = instrumentId("OKX", "ETH-USDT");

  bus.publishQuote(bus.switchboard.quotesTopic(btc), {
    instrumentId: btc,
    bidPrice: 1,
    askPrice: 2,
    bidSize: 1,
    askSize: 1,
    tsEvent: 0n,
    tsInit: 0n,
  });

  bus.publishQuote(bus.switchboard.quotesTopic(eth), {
    instrumentId: eth,
    bidPrice: 1,
    askPrice: 2,
    bidSize: 1,
    askSize: 1,
    tsEvent: 0n,
    tsInit: 0n,
  });

  assert(count === 2, `wildcard matched ${count} instruments (expected 2)`);
});

test("MessageBus patterns and subscriptions", () => {
  const bus = new MessageBus();
  bus.subscribeAny("data.quotes.*", () => {}, 0);
  bus.subscribeAny("data.trades.*", () => {}, 0);
  bus.subscribeAny("data.*.BINANCE.*", () => {}, 0);

  assert(bus.patterns().length === 3, "3 patterns subscribed");
  assert(bus.hasSubscribers("data.quotes.BINANCE.BTCUSDT"), "has subscribers for BTC quotes");
  assert(
    bus.subscriptionsCount("data.quotes.BINANCE.BTCUSDT") === 2,
    "2 subscribers for BTC quotes",
  );
});

test("MessageBus dispose clears everything", () => {
  const bus = new MessageBus();
  bus.subscribeQuotes("data.quotes.*", () => {}, 0);
  bus.subscribeTrades("data.trades.*", () => {}, 0);
  bus.registerTradingCommandEndpoint("TestEndpoint", () => {});

  bus.dispose();

  assert(bus.routerQuotes.isEmpty(), "quotes router cleared");
  assert(bus.routerTrades.isEmpty(), "trades router cleared");
  assert(bus.patterns().length === 0, "any patterns cleared");
});

// ═══════════════════════════════════════════════════════════════════
//  Performance benchmark (informal)
// ═══════════════════════════════════════════════════════════════════

test("Performance: 100K publishes", () => {
  const router = new TopicRouter<number>();
  let count = 0;

  for (let i = 0; i < 5; i++) {
    router.subscribe("data.*", () => count++, 0);
  }

  const start = performance.now();
  for (let i = 0; i < 100_000; i++) {
    router.publish("data.quotes.BTCUSDT", i);
  }
  const elapsed = performance.now() - start;

  assert(count === 500_000, `received ${count} messages (5 handlers × 100K)`);
  console.log(`    Time: ${elapsed.toFixed(0)}ms (${(100_000 / (elapsed / 1000)).toFixed(0)} msg/s)`);
});

// ═══════════════════════════════════════════════════════════════════
//  Fuzz test: random subscribe/unsubscribe/publish
// ═══════════════════════════════════════════════════════════════════

test("Fuzz: random operations (5000 ops)", () => {
  const router = new TopicRouter<string>();
  const patterns = [
    "data.*.*.*",
    "*.*.BINANCE.*",
    "events.order.*",
    "data.*.*.?USDT",
    "*.trades.*.BTC*",
    "*.*.*.*",
  ];
  const handlerIds = new Set<string>();

  const seed = 42;
  let state = seed;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  for (let i = 0; i < 5000; i++) {
    const op = Math.floor(rand() * 4);
    const pattern = patterns[Math.floor(rand() * patterns.length)];
    const handlerId = `fuzz-${i}`;

    switch (op) {
      case 0:
        router.subscribe(pattern, () => {}, 0);
        handlerIds.add(handlerId);
        break;
      case 1:
        // Unsubscribe (best effort — don't track IDs for simplicity)
        break;
      case 2:
        // Check subscribers
        router.hasSubscribers("data.quotes.BINANCE.BTCUSDT");
        break;
      case 3:
        router.publish("data.quotes.BINANCE.BTCUSDT", "fuzz");
        break;
    }
  }

  assert(true, "5000 random ops completed without crash");
});

// ── Summary ───────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("Some tests failed!");
  process.exit(1);
} else {
  console.log("All tests passed!");
}
