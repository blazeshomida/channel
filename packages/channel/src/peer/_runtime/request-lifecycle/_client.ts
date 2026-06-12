/// <reference lib="dom" />

import type { PeerCancelMessage, PeerResponseMessage } from "../../messages";
import type { PeerErrorHandler, PeerErrorPayload } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolRequestOptions } from "../types";

import { send } from "../../_actions/send";
import { reportError } from "../context";
import { createPeerClosedError, createPeerError, createRequestCancelledError } from "../errors";

const maxCancelledRequests = 1024;

interface PendingRequest {
  name: string;
  onError: PeerErrorHandler | undefined;
  cleanup(): void;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}

interface CreateRequestClientArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export interface RequestClient<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;
  getNextId: () => number;
  receiveResponse(message: PeerResponseMessage): void;
  close(error: PeerErrorPayload): void;
}

function getAbortReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;

  return reason;
}

function createCancelMessage(id: number, reason: unknown): PeerCancelMessage {
  if (reason === undefined) {
    return {
      type: "cancel",
      id,
    };
  }

  return {
    type: "cancel",
    id,
    reason,
  };
}

export function createRequestClient<TSendOptions>({
  context,
}: CreateRequestClientArgs<TSendOptions>): RequestClient<TSendOptions> {
  let previousId = 0;
  const pendingRequests = new Map<number, PendingRequest>();
  const cancelledRequests = new Set<number>();
  const cancelledRequestOrder: number[] = [];

  const getNextId = (): number => {
    previousId += 1;
    return previousId;
  };

  const rememberCancelledRequest = (id: number): void => {
    if (cancelledRequests.has(id)) {
      return;
    }

    cancelledRequests.add(id);
    cancelledRequestOrder.push(id);

    while (cancelledRequestOrder.length > maxCancelledRequests) {
      const expiredId = cancelledRequestOrder.shift();

      if (expiredId !== undefined) {
        cancelledRequests.delete(expiredId);
      }
    }
  };

  return {
    create<TPayload, TResult>(
      options: ProtocolRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      if (context.closed) {
        return Promise.reject(createPeerClosedError());
      }

      if (options.signal?.aborted) {
        return Promise.reject(createRequestCancelledError(getAbortReason(options.signal)));
      }

      const id = getNextId();

      return new Promise<TResult>((resolve, reject) => {
        const cleanup = () => {
          options.signal?.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
          const error = createRequestCancelledError(
            options.signal === undefined ? undefined : getAbortReason(options.signal),
          );

          cleanup();
          pendingRequests.delete(id);
          rememberCancelledRequest(id);
          reject(error);

          send({
            context,
            message: createCancelMessage(id, error.data),
          });
        };

        pendingRequests.set(id, {
          name: options.name,
          onError: options.onError,
          cleanup,
          resolve(value) {
            cleanup();
            // Type boundary: request result types are compile-time contracts.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            resolve(value as TResult);
          },
          reject(reason) {
            cleanup();
            reject(reason);
          },
        });

        options.signal?.addEventListener("abort", onAbort, {
          once: true,
        });

        try {
          send({
            context,
            message: {
              type: "request",
              id,
              name: options.name,
              payload: options.payload,
            },
            options: options.send,
          });
        } catch (error) {
          cleanup();
          pendingRequests.delete(id);
          reject(error);
        }
      });
    },

    getNextId,

    receiveResponse(message) {
      const pendingRequest = pendingRequests.get(message.id);

      if (pendingRequest === undefined) {
        if (cancelledRequests.delete(message.id)) {
          return;
        }

        reportError({
          context,
          error: createPeerError(
            "REQUEST_FAILED",
            `No pending request for response "${message.id}".`,
          ),
          errorContext: {
            type: "response",
            id: message.id,
          },
        });

        return;
      }

      pendingRequests.delete(message.id);

      if (message.ok) {
        pendingRequest.resolve(message.payload);
        return;
      }

      reportError({
        context,
        error: message.error,
        errorContext: {
          type: "request",
          id: message.id,
          name: pendingRequest.name,
        },
        onError: pendingRequest.onError,
      });

      pendingRequest.reject(message.error);
    },

    close(error) {
      const pending = [...pendingRequests.values()];

      pendingRequests.clear();
      cancelledRequests.clear();
      cancelledRequestOrder.length = 0;

      for (const request of pending) {
        request.cleanup();
        request.reject(error);
      }
    },
  };
}
