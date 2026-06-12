/// <reference lib="dom" />

import type {
  PeerCancelMessage,
  PeerStreamEndMessage,
  PeerStreamErrorMessage,
  PeerStreamItemMessage,
} from "../../messages";
import type { PeerErrorHandler, PeerErrorPayload, PeerStream } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolStreamOptions } from "../types";

import { send } from "../../_actions/send";
import { createCancelledIds } from "../_cancelled-ids";
import { reportError } from "../context";
import { createPeerClosedError, createPeerError, createRequestCancelledError } from "../errors";

interface PendingPull<TResult> {
  resolve(result: IteratorResult<TResult>): void;
  reject(error: unknown): void;
}

interface ConsumerStream {
  name: string;
  onError: PeerErrorHandler | undefined;
  item(payload: unknown): void;
  end(): void;
  fail(error: PeerErrorPayload): void;
}

interface CreateStreamConsumersArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  getNextId: () => number;
}

export interface StreamConsumers<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolStreamOptions<TPayload, TSendOptions>,
  ): PeerStream<TResult>;
  receiveItem(message: PeerStreamItemMessage): void;
  receiveEnd(message: PeerStreamEndMessage): void;
  receiveError(message: PeerStreamErrorMessage): void;
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

function done<TResult>(): IteratorResult<TResult> {
  return {
    done: true,
    value: undefined,
  };
}

export function createStreamConsumers<TSendOptions>({
  context,
  getNextId,
}: CreateStreamConsumersArgs<TSendOptions>): StreamConsumers<TSendOptions> {
  const consumers = new Map<number, ConsumerStream>();
  const cancelledConsumers = createCancelledIds();

  const reportUnknownStreamMessage = (id: number): void => {
    reportError({
      context,
      error: createPeerError("STREAM_FAILED", `No pending stream for message "${id}".`),
      errorContext: {
        type: "stream-message",
        id,
      },
    });
  };

  const getConsumer = (id: number, terminal: boolean): ConsumerStream | undefined => {
    const consumer = consumers.get(id);

    if (consumer !== undefined) {
      return consumer;
    }

    if (cancelledConsumers.has(id)) {
      if (terminal) {
        cancelledConsumers.delete(id);
      }

      return undefined;
    }

    reportUnknownStreamMessage(id);
    return undefined;
  };

  return {
    create<TPayload, TResult>(
      options: ProtocolStreamOptions<TPayload, TSendOptions>,
    ): PeerStream<TResult> {
      let id: number | undefined;
      let started = false;
      let requestSent = false;
      let closed = false;
      let failure: PeerErrorPayload | undefined;
      let failureDelivered = false;
      let pendingPull: PendingPull<TResult> | undefined;
      let tail: Promise<void> | undefined;

      const cleanup = () => {
        options.signal?.removeEventListener("abort", onAbort);

        if (id !== undefined) {
          consumers.delete(id);
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

      const rollbackFailedSend = (error: unknown) => {
        closed = true;
        cleanup();
        pendingPull?.reject(error);
        pendingPull = undefined;
      };

      const cancelRemoteAfterFailedPull = () => {
        if (!requestSent || id === undefined) {
          return;
        }

        try {
          send({
            context,
            message: createCancelMessage(id, undefined),
          });
        } catch {
          // Preserve the original pull send failure when remote cleanup also fails.
        }
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

        cancelledConsumers.remember(streamId);
        fail(error);

        send({
          context,
          message: createCancelMessage(streamId, error.data),
        });
      };

      const start = () => {
        id = getNextId();
        started = true;

        consumers.set(id, {
          name: options.name,
          onError: options.onError,
          item(payload) {
            const pull = pendingPull;

            if (pull === undefined) {
              return;
            }

            pendingPull = undefined;
            // Type boundary: stream item types are compile-time contracts.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
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
            try {
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
              requestSent = true;
            } catch (error) {
              rollbackFailedSend(error);
            }
          }

          if (closed) {
            return;
          }

          try {
            send({
              context,
              message: {
                type: "stream-pull",
                id: getStreamId(),
              },
            });
          } catch (error) {
            rollbackFailedSend(error);
            cancelRemoteAfterFailedPull();
          }
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
            cancelledConsumers.remember(id);
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
    },

    receiveItem(message) {
      getConsumer(message.id, false)?.item(message.payload);
    },

    receiveEnd(message) {
      const consumer = getConsumer(message.id, true);

      if (consumer === undefined) {
        return;
      }

      consumers.delete(message.id);
      consumer.end();
    },

    receiveError(message) {
      const consumer = getConsumer(message.id, true);

      if (consumer === undefined) {
        return;
      }

      consumers.delete(message.id);

      reportError({
        context,
        error: message.error,
        errorContext: {
          type: "stream",
          id: message.id,
          name: consumer.name,
        },
        onError: consumer.onError,
      });

      consumer.fail(message.error);
    },

    close(error) {
      const pendingConsumers = [...consumers.values()];

      consumers.clear();
      cancelledConsumers.clear();

      for (const consumer of pendingConsumers) {
        consumer.fail(error);
      }
    },
  };
}
