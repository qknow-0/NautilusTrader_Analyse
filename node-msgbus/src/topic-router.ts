/**
 * TopicRouter<T> — typed pub/sub router with wildcard matching and index caching.
 *
 * Mirrors the Rust `TopicRouter<T>` in `crates/common/src/msgbus/typed_router.rs`.
 *
 * Features:
 *   - Subscribe/unsubscribe handlers by pattern
 *   - Wildcard matching (* and ?)
 *   - Priority-based ordering
 *   - Index cache for fast repeated publishes
 */

import { Topic, Pattern, Subscription, compareSubscriptions } from "./types.js";
import { isMatch } from "./matching.js";
import { Handler } from "./handler.js";

export class TopicRouter<T> {
  /** All active subscriptions, sorted by priority (desc). */
  private subscriptions: Subscription[] = [];

  /** Handler functions, indexed in the same order as `subscriptions`. */
  private handlers: Handler<T>[] = [];

  /** Cache: topic → indices of matching subscriptions. */
  private topicCache = new Map<Topic, number[]>();

  /** Subscribe a handler to a topic pattern. */
  subscribe(pattern: Pattern, handlerFn: Handler<T>, priority = 0): void {
    const sub: Subscription = {
      pattern,
      id: `handler-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      priority,
    };

    // Check for duplicate (same pattern + same handler ref)
    if (this.subscriptions.some((s) => s.pattern === pattern && s.id === sub.id)) {
      return;
    }

    this.subscriptions.push(sub);
    this.handlers.push(handlerFn);

    // Re-sort by priority and invalidate cache
    this.sortSubscriptions();
    this.topicCache.clear();
  }

  /** Unsubscribe a specific handler by pattern. */
  unsubscribe(pattern: Pattern, handlerId: string): boolean {
    const idx = this.subscriptions.findIndex(
      (s) => s.pattern === pattern && s.id === handlerId,
    );
    if (idx === -1) return false;

    this.subscriptions.splice(idx, 1);
    this.handlers.splice(idx, 1);
    this.topicCache.clear(); // invalidate cache on removal
    return true;
  }

  /** Remove a handler by pattern and ID. */
  removeHandler(pattern: Pattern, handlerId: string): boolean {
    return this.unsubscribe(pattern, handlerId);
  }

  /** Check if a handler is subscribed to a pattern. */
  isSubscribed(pattern: Pattern, handlerId: string): boolean {
    return this.subscriptions.some((s) => s.pattern === pattern && s.id === handlerId);
  }

  /** Check if there are any subscribers for the topic. */
  hasSubscribers(topic: Topic): boolean {
    return this.getMatchingIndices(topic).length > 0;
  }

  /** Return the count of subscribers for the topic. */
  subscriberCount(topic: Topic): number {
    return this.getMatchingIndices(topic).length;
  }

  /** Return the count of exact (non-wildcard) subscribers. */
  exactSubscriberCount(topic: Topic): number {
    return this.subscriptions.filter((s) => s.pattern === topic).length;
  }

  /** Publish a message to all handlers matching the topic. */
  publish(topic: Topic, message: T): void {
    const indices = this.getMatchingIndices(topic);
    for (const idx of indices) {
      this.handlers[idx](message);
    }
  }

  /** Get matching handler functions (for out-of-borrow calling). */
  getMatchingHandlers(topic: Topic): Handler<T>[] {
    return this.getMatchingIndices(topic).map((idx) => this.handlers[idx]);
  }

  /** Return all active subscription patterns. */
  patterns(): Pattern[] {
    return this.subscriptions.map((s) => s.pattern);
  }

  /** Return all handler IDs. */
  handlerIds(): string[] {
    return this.subscriptions.map((s) => s.id);
  }

  /** Return the number of active subscriptions. */
  subscriptionCount(): number {
    return this.subscriptions.length;
  }

  /** Check if there are any subscriptions. */
  isEmpty(): boolean {
    return this.subscriptions.length === 0;
  }

  /** Clear all subscriptions and cache. */
  clear(): void {
    this.subscriptions = [];
    this.handlers = [];
    this.topicCache.clear();
  }

  /** Get cached or computed matching indices. */
  private getMatchingIndices(topic: Topic): number[] {
    let indices = this.topicCache.get(topic);
    if (indices === undefined) {
      indices = this.findMatches(topic);
      this.topicCache.set(topic, indices);
    }
    return indices;
  }

  /** Find subscription indices matching the topic (no caching). */
  private findMatches(topic: Topic): number[] {
    const matches: number[] = [];
    for (let i = 0; i < this.subscriptions.length; i++) {
      if (isMatch(topic, this.subscriptions[i].pattern)) {
        matches.push(i);
      }
    }
    return matches;
  }

  /** Sort subscriptions by priority (desc), then pattern, then ID. */
  private sortSubscriptions(): void {
    // Create indexed pairs, sort, then reorder both arrays
    const indexed = this.subscriptions.map((s, i) => ({ sub: s, handler: this.handlers[i], idx: i }));
    indexed.sort((a, b) => compareSubscriptions(a.sub, b.sub));
    this.subscriptions = indexed.map((x) => x.sub);
    this.handlers = indexed.map((x) => x.handler);
  }
}
