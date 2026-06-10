import type { PeerErrorHandler, PeerErrorPayload } from "./types";

export interface PendingRequest<TResult> {
  name: string;
  onError: PeerErrorHandler | undefined;
  resolve(value: TResult): void;
  reject(reason: PeerErrorPayload): void;
}

export function createRequestIdFactory() {
  let previousId = 0;

  return () => {
    previousId += 1;
    return previousId;
  };
}

export function createPendingRequestRegistry() {
  const requests = new Map<number, PendingRequest<unknown>>();

  return {
    get(id: number) {
      return requests.get(id);
    },

    set(id: number, request: PendingRequest<unknown>) {
      requests.set(id, request);
    },

    delete(id: number) {
      requests.delete(id);
    },

    rejectAll(error: PeerErrorPayload) {
      const pendingRequests = [...requests.values()];

      requests.clear();

      for (const request of pendingRequests) {
        request.reject(error);
      }
    },
  };
}
