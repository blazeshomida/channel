/// <reference lib="dom" />

import type { PeerStreamPullMessage, PeerStreamRequestMessage } from "../../messages";
import type { PeerDispose, PeerErrorHandler, PeerErrorPayload } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolHandleStreamOptions, ProtocolStreamHandler } from "../types";

import { send } from "../../_actions/send";
import { reportError } from "../context";
import { createMethodNotFoundError, createStreamFailedError } from "../errors";

interface ProducerStream {
  name: string;
  onError: PeerErrorHandler | undefined;
  controller: AbortController;
  iterator: AsyncIterator<unknown>;
  pulling: boolean;
}

interface RegisteredStreamHandler {
  handler: ProtocolStreamHandler<unknown, unknown>;
  onError: PeerErrorHandler | undefined;
}

interface CreateStreamProducersArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export interface StreamProducers {
  handle<TPayload, TResult>(options: ProtocolHandleStreamOptions<TPayload, TResult>): PeerDispose;
  hasHandler(name: string): boolean;
  receiveRequest(message: PeerStreamRequestMessage): void;
  receivePull(message: PeerStreamPullMessage): Promise<void>;
  cancel(id: number, reason?: unknown): void;
  close(error: PeerErrorPayload): void;
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

export function createStreamProducers<TSendOptions>({
  context,
}: CreateStreamProducersArgs<TSendOptions>): StreamProducers {
  const producers = new Map<number, ProducerStream>();
  const handlers = new Map<string, RegisteredStreamHandler>();

  const cancel = (id: number, reason?: unknown): void => {
    const producer = producers.get(id);

    if (producer === undefined) {
      return;
    }

    producers.delete(id);
    closeProducer(producer, reason);
  };

  return {
    handle<TPayload, TResult>(
      options: ProtocolHandleStreamOptions<TPayload, TResult>,
    ): PeerDispose {
      if (context.closed) {
        throw new Error("Peer is closed.");
      }

      if (handlers.has(options.name)) {
        throw new Error(`Stream handler already registered for "${options.name}".`);
      }

      const registeredHandler: RegisteredStreamHandler = {
        handler: (payload, handlerContext) => {
          // Type boundary: protocol payload validation belongs to the contract module.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return options.handler(payload as TPayload, handlerContext);
        },
        onError: options.onError,
      };

      handlers.set(options.name, registeredHandler);

      return () => {
        if (handlers.get(options.name) !== registeredHandler) {
          return;
        }

        handlers.delete(options.name);
      };
    },

    hasHandler(name) {
      return handlers.has(name);
    },

    receiveRequest(message) {
      const registeredHandler = handlers.get(message.name);

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

    cancel,

    close(error) {
      const activeProducers = [...producers.values()];

      producers.clear();
      handlers.clear();

      for (const producer of activeProducers) {
        closeProducer(producer, error);
      }
    },
  };
}
