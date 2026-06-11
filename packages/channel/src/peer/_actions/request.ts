/// <reference lib="dom" />

import type { PeerContext } from "../_runtime/context";
import type { PeerCancelMessage } from "../messages";
import type { PeerRequestOptions } from "../types";

import { createPeerClosedError, createRequestCancelledError } from "../_runtime/errors";
import { send } from "./send";

interface RequestArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerRequestOptions<TPayload, TSendOptions>;
}

function rejectIfClosed<TResult, TSendOptions>(
  context: PeerContext<TSendOptions>,
): Promise<TResult> | undefined {
  if (!context.closed) {
    return undefined;
  }

  return Promise.reject(createPeerClosedError());
}

function getAbortReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;

  return reason;
}

function rejectIfCancelled<TResult>(signal: AbortSignal | undefined): Promise<TResult> | undefined {
  if (!signal?.aborted) {
    return undefined;
  }

  return Promise.reject(createRequestCancelledError(getAbortReason(signal)));
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

export function request<TPayload = unknown, TResult = unknown, TSendOptions = void>({
  context,
  options,
}: RequestArgs<TPayload, TSendOptions>): Promise<TResult> {
  const closedPromise = rejectIfClosed<TResult, TSendOptions>(context);

  if (closedPromise) {
    return closedPromise;
  }

  const cancelledPromise = rejectIfCancelled<TResult>(options.signal);

  if (cancelledPromise) {
    return cancelledPromise;
  }

  const id = context.getRequestId();

  return new Promise<TResult>((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      const error = createRequestCancelledError(
        options.signal === undefined ? undefined : getAbortReason(options.signal),
      );

      cleanup();
      context.pendingRequests.delete(id);
      context.cancelledRequests.add(id);
      reject(error);

      send({
        context,
        message: createCancelMessage(id, error.data),
      });
    };

    context.pendingRequests.set(id, {
      name: options.name,
      onError: options.onError,
      cleanup,
      resolve: (value) => {
        cleanup();
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Request result types are compile-time contracts; runtime schemas belong in a future contract layer.
        resolve(value as TResult);
      },
      reject: (reason) => {
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
}
