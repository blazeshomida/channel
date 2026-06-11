import type { PeerErrorHandler, PeerErrorPayload } from "../types";

export interface PendingStream {
  name: string;
  onError: PeerErrorHandler | undefined;
  item(payload: unknown): void;
  end(): void;
  fail(error: PeerErrorPayload): void;
}

export interface PendingStreamRegistry {
  get(id: number): PendingStream | undefined;
  set(id: number, stream: PendingStream): void;
  delete(id: number): void;
  rejectAll(error: PeerErrorPayload): void;
}

export function createPendingStreamRegistry(): PendingStreamRegistry {
  const streams = new Map<number, PendingStream>();

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

    rejectAll(error) {
      const pendingStreams = [...streams.values()];

      streams.clear();

      for (const stream of pendingStreams) {
        stream.fail(error);
      }
    },
  };
}
