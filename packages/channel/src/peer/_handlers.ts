import type { PeerErrorHandler, PeerHandler } from "./types";

export interface RegisteredHandler {
  handler: PeerHandler<unknown, unknown>;
  onError: PeerErrorHandler | undefined;
}

export function createHandlerRegistry() {
  const handlers = new Map<string, RegisteredHandler>();

  return {
    get(name: string) {
      return handlers.get(name);
    },

    has(name: string) {
      return handlers.has(name);
    },

    set(name: string, handler: RegisteredHandler) {
      handlers.set(name, handler);
    },

    delete(name: string) {
      handlers.delete(name);
    },

    clear() {
      handlers.clear();
    },
  };
}
