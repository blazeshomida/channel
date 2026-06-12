/// <reference lib="dom" />

import type { PeerCancelMessage, PeerRequestMessage, PeerResponseMessage } from "../messages";
import type { PeerErrorHandler, PeerErrorPayload } from "../types";
import type { PeerContext } from "./context";
import type { ProtocolRequestOptions } from "./types";

import { send } from "../_actions/send";
import { reportError } from "./context";
import {
  createMethodNotFoundError,
  createPeerClosedError,
  createPeerError,
  createRequestCancelledError,
  createRequestFailedError,
} from "./errors";

const maxCancelledRequests = 1024;

interface PendingRequest {
  name: string;
  onError: PeerErrorHandler | undefined;
  cleanup(): void;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}

interface CreateRequestLifecycleArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export interface RequestLifecycle<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;
  getNextId: () => number;
  receiveResponse(message: PeerResponseMessage): void;
  receiveRequest(message: PeerRequestMessage): Promise<void>;
  cancelHandler(id: number, reason?: unknown): void;
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

export function createRequestLifecycle<TSendOptions>({
  context,
}: CreateRequestLifecycleArgs<TSendOptions>): RequestLifecycle<TSendOptions> {
  let previousId = 0;
  const pendingRequests = new Map<number, PendingRequest>();
  const cancelledRequests = new Set<number>();
  const cancelledRequestOrder: number[] = [];
  const activeHandlers = new Map<number, AbortController>();

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
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Request result types are compile-time contracts; runtime validation belongs to the contract layer.
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

    async receiveRequest(message) {
      const registeredHandler = context.handlers.get(message.name);

      if (registeredHandler === undefined) {
        send({
          context,
          message: {
            type: "response",
            id: message.id,
            ok: false,
            error: createMethodNotFoundError(message.name),
          },
        });

        return;
      }

      const controller = new AbortController();
      activeHandlers.set(message.id, controller);

      try {
        const payload = await registeredHandler.handler(message.payload, {
          id: message.id,
          name: message.name,
          signal: controller.signal,
        });

        activeHandlers.delete(message.id);

        if (controller.signal.aborted || context.closed) {
          return;
        }

        send({
          context,
          message: {
            type: "response",
            id: message.id,
            ok: true,
            payload,
          },
        });
      } catch (error) {
        activeHandlers.delete(message.id);

        if (controller.signal.aborted || context.closed) {
          return;
        }

        const responseError = createRequestFailedError(error);

        reportError({
          context,
          error: responseError,
          errorContext: {
            type: "handler",
            id: message.id,
            name: message.name,
          },
          onError: registeredHandler.onError,
        });

        send({
          context,
          message: {
            type: "response",
            id: message.id,
            ok: false,
            error: responseError,
          },
        });
      }
    },

    cancelHandler(id, reason) {
      const controller = activeHandlers.get(id);

      if (controller === undefined) {
        return;
      }

      activeHandlers.delete(id);
      controller.abort(reason);
    },

    close(error) {
      const pending = [...pendingRequests.values()];
      const active = [...activeHandlers.values()];

      pendingRequests.clear();
      cancelledRequests.clear();
      cancelledRequestOrder.length = 0;
      activeHandlers.clear();

      for (const request of pending) {
        request.cleanup();
        request.reject(error);
      }

      for (const controller of active) {
        controller.abort(error);
      }
    },
  };
}
