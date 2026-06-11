/// <reference lib="dom" />

import type { PeerErrorHandler } from "../types";

export interface ActiveStream {
  name: string;
  onError: PeerErrorHandler | undefined;
  controller: AbortController;
  iterator: AsyncIterator<unknown>;
  pulling: boolean;
}

export interface ActiveStreamRegistry {
  get(id: number): ActiveStream | undefined;
  set(id: number, stream: ActiveStream): void;
  delete(id: number): void;
  abort(id: number, reason?: unknown): void;
  abortAll(reason?: unknown): void;
}

function abortStream(stream: ActiveStream, reason?: unknown): void {
  stream.controller.abort(reason);

  if (stream.iterator.return !== undefined) {
    try {
      void stream.iterator.return().catch(() => {});
    } catch {
      // Cancellation cleanup must not escape into peer lifecycle methods.
    }
  }
}

export function createActiveStreamRegistry(): ActiveStreamRegistry {
  const streams = new Map<number, ActiveStream>();

  return {
    get(id) {
      return streams.get(id);
    },

    set(id, stream) {
      streams.set(id, stream);
    },

    delete(id) {
      streams.delete(id);
    },

    abort(id, reason) {
      const stream = streams.get(id);

      if (!stream) {
        return;
      }

      streams.delete(id);
      abortStream(stream, reason);
    },

    abortAll(reason) {
      const activeStreams = [...streams.values()];

      streams.clear();

      for (const stream of activeStreams) {
        abortStream(stream, reason);
      }
    },
  };
}
