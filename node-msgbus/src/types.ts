/**
 * Core type definitions for the message bus.
 *
 * Mirrors the Rust version's type system:
 * - Topic: hierarchical dot-separated strings (e.g. "data.quotes.BINANCE.BTCUSDT")
 * - Pattern: topic strings with wildcards (* matches any chars, ? matches single char)
 * - Endpoint: named point-to-point destination
 */

export type Topic = string;
export type Pattern = string;
export type Endpoint = string;

export interface HandlerInfo {
  id: string;
  priority: number;
}

export interface Subscription extends HandlerInfo {
  pattern: Pattern;
}

/**
 * Priority ordering: higher number = called first.
 */
export function compareSubscriptions(a: Subscription, b: Subscription): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.pattern.localeCompare(b.pattern) || a.id.localeCompare(b.id);
}
