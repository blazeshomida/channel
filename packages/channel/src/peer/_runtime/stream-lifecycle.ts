/// <reference lib="dom" />

import type {
  PeerCancelMessage,
  PeerStreamEndMessage,
  PeerStreamErrorMessage,
  PeerStreamItemMessage,
  PeerStreamPullMessage,
  PeerStreamRequestMessage,
} from "../messages";
import type { PeerErrorHandler, PeerErrorPayload, PeerStream } from "../types";
import type { PeerContext } from "./context";
import type { ProtocolStreamOptions } from "./types";

import { send } from "../_actions/send";
import { reportError } from "./context";
import {
  createMethodNotFoundError,
  createPeerClosedError,
  createPeerError,
  createRequestCancelledError,
  createStreamFailedError,
} from "./errors";

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

interface ProducerStream {
  name: string;
  onError: PeerErrorHandler | undefined;
  controller: AbortController;
  iterator: AsyncIterator<unknown>;
  pulling: boolean;
}

interface CreateStreamLifecycleArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  getNextId: () => number;
}

export interface StreamLifecycle<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolStreamOptions<TPayload, TSendOptions>,
  ): PeerStream<TResult>;
  receiveRequest(message: PeerStreamRequestMessage): void;
  receivePull(message: PeerStreamPullMessage): Promise<void>;
  receiveItem(message: PeerStreamItemMessage): void;
  receiveEnd(message: PeerStreamEndMessage): void;
  receiveError(message: PeerStreamErrorMessage): void;
  cancelProducer(id: number, reason?: unknown): void;
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

function closeProducer(stream: ProducerStream, reason?: unknown): void {
  stream.controller.abort(reason);

  if (stream.iterator.return === undefined) {
    return;
  }

  try {
    void stream.iterator.return().catch(() => {});
  } catch {
    // Cancellation cleanup must not escape into peer lifecycle methods.
  }
}

export function createStreamLifecycle<TSendOptions>({
  context,
  getNextId,
}: CreateStreamLifecycleArgs<TSendOptions>): StreamLifecycle<TSendOptions> {
  const consumers = new Map<number, ConsumerStream>();
  const cancelledConsumers = new Set<number>();
  const producers = new Map<number, ProducerStream>();

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

  const cancelProducer = (id: number, reason?: unknown): void => {
    const producer = producers.get(id);

    if (producer === undefined) {
      return;
    }

    producers.delete(id);
    closeProducer(producer, reason);
  };

  return {
    create<TPayload, TResult>(
      options: ProtocolStreamOptions<TPayload, TSendOptions>,
    ): PeerStream<TResult> {
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

        cancelledConsumers.add(streamId);
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
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Stream item types are compile-time contracts; runtime validation belongs to the contract layer.
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
            cancelledConsumers.add(id);
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

    receiveRequest(message) {
      const registeredHandler = context.streamHandlers.get(message.name);

      if (registeredHandler === undefined) {
        send({
          context,
          message: {
            type: "stream-error",
            id: message.id,
            error: createMethodNotFoundError(message.name),
          },
        });

        return;
      }

      const controller = new AbortController();

      try {
        const iterable = registeredHandler.handler(message.payload, {
          id: message.id,
          name: message.name,
          signal: controller.signal,
        });

        producers.set(message.id, {
          name: message.name,
          onError: registeredHandler.onError,
          controller,
          iterator: iterable[Symbol.asyncIterator](),
          pulling: false,
        });
      } catch (error) {
        const streamError = createStreamFailedError(error);

        reportError({
          context,
          error: streamError,
          errorContext: {
            type: "stream-handler",
            id: message.id,
            name: message.name,
          },
          onError: registeredHandler.onError,
        });

        send({
          context,
          message: {
            type: "stream-error",
            id: message.id,
            error: streamError,
          },
        });
      }
    },

    async receivePull(message) {
      const producer = producers.get(message.id);

      if (producer === undefined || producer.pulling) {
        return;
      }

      producer.pulling = true;

      try {
        const result = await producer.iterator.next();

        producer.pulling = false;

        if (
          producer.controller.signal.aborted ||
          context.closed ||
          producers.get(message.id) !== producer
        ) {
          return;
        }

        if (result.done) {
          producers.delete(message.id);
          send({
            context,
            message: {
              type: "stream-end",
              id: message.id,
            },
          });
          return;
        }

        send({
          context,
          message: {
            type: "stream-item",
            id: message.id,
            payload: result.value,
          },
        });
      } catch (error) {
        producer.pulling = false;

        if (
          producer.controller.signal.aborted ||
          context.closed ||
          producers.get(message.id) !== producer
        ) {
          return;
        }

        producers.delete(message.id);

        const streamError = createStreamFailedError(error);

        reportError({
          context,
          error: streamError,
          errorContext: {
            type: "stream-handler",
            id: message.id,
            name: producer.name,
          },
          onError: producer.onError,
        });

        send({
          context,
          message: {
            type: "stream-error",
            id: message.id,
            error: streamError,
          },
        });
      }
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

    cancelProducer,

    close(error) {
      const pendingConsumers = [...consumers.values()];
      const activeProducers = [...producers.values()];

      consumers.clear();
      cancelledConsumers.clear();
      producers.clear();

      for (const consumer of pendingConsumers) {
        consumer.fail(error);
      }

      for (const producer of activeProducers) {
        closeProducer(producer, error);
      }
    },
  };
}
