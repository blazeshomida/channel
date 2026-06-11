import type { PeerErrorHandler, PeerErrorPayload } from "../types";

export interface PendingRequest<TResult = unknown> {
  name: string;
  onError: PeerErrorHandler | undefined;
  cleanup(): void;
  resolve(value: TResult): void;
  reject(reason: unknown): void;
}

export type RequestIdFactory = () => number;

export interface PendingRequestRegistry {
  get(id: number): PendingRequest | undefined;
  set(id: number, request: PendingRequest): void;
  delete(id: number): void;
  rejectAll(error: PeerErrorPayload): void;
}

export function createRequestIdFactory(): RequestIdFactory {
  let previousId = 0;

  return () => {
    previousId += 1;
    return previousId;
  };
}

export function createPendingRequestRegistry(): PendingRequestRegistry {
  const requests = new Map<number, PendingRequest>();

  return {
    get(id) {
      return requests.get(id);
    },

    set(id, request) {
      requests.set(id, request);
    },

    delete(id) {
      requests.delete(id);
    },

    rejectAll(error) {
      const pendingRequests = [...requests.values()];

      requests.clear();

      for (const request of pendingRequests) {
        request.cleanup();
        request.reject(error);
      }
    },
  };
}
