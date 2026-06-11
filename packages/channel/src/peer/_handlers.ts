import type { PeerErrorHandler, PeerHandler } from "./types";

export interface RegisteredHandler {
  handler: PeerHandler<unknown, unknown>;
  onError: PeerErrorHandler | undefined;
}

export interface HandlerRegistry {
  get(name: string): RegisteredHandler | undefined;
  has(name: string): boolean;
  set(name: string, handler: RegisteredHandler): void;
  delete(name: string): void;
  clear(): void;
}

export function createHandlerRegistry(): HandlerRegistry {
  const handlers = new Map<string, RegisteredHandler>();

  return {
    get(name) {
      return handlers.get(name);
    },

    has(name) {
      return handlers.has(name);
    },

    set(name, handler) {
      handlers.set(name, handler);
    },

    delete(name) {
      handlers.delete(name);
    },

    clear() {
      handlers.clear();
    },
  };
}
