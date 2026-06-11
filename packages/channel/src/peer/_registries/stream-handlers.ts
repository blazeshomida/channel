import type { PeerErrorHandler, PeerStreamHandler } from "../types";

export interface RegisteredStreamHandler {
  handler: PeerStreamHandler<unknown, unknown>;
  onError: PeerErrorHandler | undefined;
}

export interface StreamHandlerRegistry {
  get(name: string): RegisteredStreamHandler | undefined;
  has(name: string): boolean;
  set(name: string, handler: RegisteredStreamHandler): void;
  delete(name: string): void;
  clear(): void;
}

export function createStreamHandlerRegistry(): StreamHandlerRegistry {
  const handlers = new Map<string, RegisteredStreamHandler>();

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
