/**
 * Handler types — mirrors the Rust Handler<T> / IntoHandler<T> / CallbackHandler traits.
 *
 * Three handler flavours:
 *   1. `handler`    — takes a reference, can be called multiple times (Handler<T>)
 *   2. `intoHandler` — takes ownership of the value (IntoHandler<T>)
 *   3. `anyHandler`  — receives `unknown`, downcasts internally (Handler<dyn Any>)
 */

/**
 * A handler that receives a reference to the message.
 * The message is not consumed, so multiple handlers can see it.
 */
export type Handler<T> = (message: T) => void;

/**
 * A handler that takes ownership of the message.
 * Only one such handler can effectively process the message.
 */
export type IntoHandler<T> = (message: T) => void;

/**
 * A handler that receives `unknown` and is responsible for
 * narrowing the type (mirrors Handler<dyn Any>).
 */
export type AnyHandler = (message: unknown) => void;

/**
 * Create a handler with a custom ID.
 */
export function handler<T>(id: string, fn: Handler<T>): { id: string; fn: Handler<T> } {
  return { id, fn };
}

/**
 * Create an any-based handler from a typed callback.
 * The callback is only invoked when the message is of type T (duck-checked).
 */
export function anyHandler<T>(
  id: string,
  typeGuard: (m: unknown) => m is T,
  fn: Handler<T>,
): { id: string; fn: AnyHandler } {
  return {
    id,
    fn: (message: unknown) => {
      if (typeGuard(message)) {
        fn(message);
      }
    },
  };
}

/**
 * Generate a unique handler ID (equivalent to Rust UUID4-based ID generation).
 */
let _handlerCounter = 0;
export function genHandlerId(): string {
  _handlerCounter++;
  return `handler-${_handlerCounter}`;
}
