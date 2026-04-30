/**
 * EndpointMap<T> — point-to-point typed endpoint registry.
 *
 * Mirrors the Rust `EndpointMap<T>` in `crates/common/src/msgbus/typed_endpoints.rs`.
 */

import { Endpoint } from "./types.js";
import { Handler, IntoHandler } from "./handler.js";

export class EndpointMap<T> {
  private endpoints = new Map<Endpoint, { id: string; fn: Handler<T> }>();

  /** Register a handler for an endpoint. */
  register(endpoint: Endpoint, handlerFn: Handler<T>, id?: string): void {
    this.endpoints.set(endpoint, {
      id: id ?? endpoint,
      fn: handlerFn,
    });
  }

  /** Send a message to the registered endpoint handler. */
  send(endpoint: Endpoint, message: T): boolean {
    const handler = this.endpoints.get(endpoint);
    if (handler) {
      handler.fn(message);
      return true;
    }
    return false;
  }

  /** Check if an endpoint is registered. */
  has(endpoint: Endpoint): boolean {
    return this.endpoints.has(endpoint);
  }

  /** Deregister an endpoint. */
  deregister(endpoint: Endpoint): boolean {
    return this.endpoints.delete(endpoint);
  }

  /** Return all registered endpoint names. */
  listEndpoints(): Endpoint[] {
    return [...this.endpoints.keys()];
  }

  /** Get the handler ID for an endpoint. */
  getHandlerId(endpoint: Endpoint): string | undefined {
    return this.endpoints.get(endpoint)?.id;
  }

  /** Clear all endpoints. */
  clear(): void {
    this.endpoints.clear();
  }
}

/**
 * IntoEndpointMap<T> — ownership-based endpoint map.
 * For messages that are transferred by value.
 */
export class IntoEndpointMap<T> {
  private endpoints = new Map<Endpoint, { id: string; fn: IntoHandler<T> }>();

  register(endpoint: Endpoint, handlerFn: IntoHandler<T>, id?: string): void {
    this.endpoints.set(endpoint, {
      id: id ?? endpoint,
      fn: handlerFn,
    });
  }

  send(endpoint: Endpoint, message: T): boolean {
    const handler = this.endpoints.get(endpoint);
    if (handler) {
      handler.fn(message);
      return true;
    }
    return false;
  }

  has(endpoint: Endpoint): boolean {
    return this.endpoints.has(endpoint);
  }

  deregister(endpoint: Endpoint): boolean {
    return this.endpoints.delete(endpoint);
  }

  listEndpoints(): Endpoint[] {
    return [...this.endpoints.keys()];
  }

  clear(): void {
    this.endpoints.clear();
  }
}
