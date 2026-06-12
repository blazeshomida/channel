/// <reference lib="dom" />

import type { PeerContext } from "../_runtime/context";
import type { ProtocolStreamOptions } from "../_runtime/types";
import type { PeerCancelMessage } from "../messages";
import type { PeerErrorPayload, PeerStream } from "../types";

import { createPeerClosedError, createRequestCancelledError } from "../_runtime/errors";
import { send } from "./send";

interface StreamArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: ProtocolStreamOptions<TPayload, TSendOptions>;
}

interface PendingPull<TResult> {
  resolve(result: IteratorResult<TResult>): void;
  reject(error: unknown): void;
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

function done<TResult>(): IteratorResult<TResult> {
  return {
    done: true,
    value: undefined,
  };
}

export function stream<TResult = unknown, TPayload = unknown, TSendOptions = void>({
  context,
  options,
}: StreamArgs<TPayload, TSendOptions>): PeerStream<TResult> {
  let id: number | undefined;
  let started = false;
  let closed = false;
  let failure: PeerErrorPayload | undefined;
  let failureDelivered = false;
  let pendingPull: PendingPull<TResult> | undefined;
  let tail: Promise<void> | undefined;

  const cleanup = () => {
    options.signal?.removeEventListener("abort", onAbort);

    if (id !== undefined) {
      context.pendingStreams.delete(id);
    }
  };

  const fail = (error: PeerErrorPayload) => {
    if (closed) {
      return;
    }

    closed = true;
    failure = error;
    cleanup();

    if (pendingPull !== undefined) {
      failureDelivered = true;
      pendingPull.reject(error);
      pendingPull = undefined;
    }
  };

  const finish = () => {
    if (closed) {
      return;
    }

    closed = true;
    cleanup();
    pendingPull?.resolve(done());
    pendingPull = undefined;
  };

  const onAbort = () => {
    const error = createRequestCancelledError(
      options.signal === undefined ? undefined : getAbortReason(options.signal),
    );

    if (!started) {
      fail(error);
      return;
    }

    const streamId = id;

    if (streamId === undefined || closed) {
      return;
    }

    context.cancelledRequests.add(streamId);
    fail(error);

    send({
      context,
      message: createCancelMessage(streamId, error.data),
    });
  };

  const start = () => {
    id = context.getRequestId();
    started = true;

    context.pendingStreams.set(id, {
      name: options.name,
      onError: options.onError,
      item(payload) {
        const pull = pendingPull;

        if (pull === undefined) {
          return;
        }

        pendingPull = undefined;
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Stream item types are compile-time contracts; runtime schemas belong in a future contract layer.
        pull.resolve({ done: false, value: payload as TResult });
      },
      end: finish,
      fail,
    });

    options.signal?.addEventListener("abort", onAbort, {
      once: true,
    });
  };

  const getStreamId = (): number => {
    if (id === undefined) {
      throw new Error("Stream has not started.");
    }

    return id;
  };

  const nextItem = (): Promise<IteratorResult<TResult>> => {
    if (failure !== undefined && !failureDelivered) {
      failureDelivered = true;
      return Promise.reject(failure);
    }

    if (closed) {
      return Promise.resolve(done());
    }

    if (context.closed) {
      fail(createPeerClosedError());
      return nextItem();
    }

    if (options.signal?.aborted) {
      onAbort();
      return nextItem();
    }

    return new Promise<IteratorResult<TResult>>((resolve, reject) => {
      const firstPull = !started;

      if (firstPull) {
        start();
      }

      pendingPull = {
        resolve,
        reject,
      };

      if (firstPull) {
        send({
          context,
          message: {
            type: "stream-request",
            id: getStreamId(),
            name: options.name,
            payload: options.payload,
          },
          options: options.send,
        });
      }

      if (closed) {
        return;
      }

      send({
        context,
        message: {
          type: "stream-pull",
          id: getStreamId(),
        },
      });
    });
  };

  const iterator: PeerStream<TResult> = {
    next() {
      const result = tail === undefined ? nextItem() : tail.then(nextItem);
      const completion = result.then(
        () => {},
        () => {},
      );

      tail = completion;

      void completion.finally(() => {
        if (tail === completion) {
          tail = undefined;
        }
      });

      return result;
    },

    return() {
      if (!closed && started && id !== undefined) {
        context.cancelledRequests.add(id);
        send({
          context,
          message: createCancelMessage(id, undefined),
        });
      }

      finish();

      return Promise.resolve(done());
    },

    [Symbol.asyncIterator]() {
      return iterator;
    },
  };

  return iterator;
}
