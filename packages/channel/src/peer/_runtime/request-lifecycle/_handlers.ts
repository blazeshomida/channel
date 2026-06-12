/// <reference lib="dom" />

import type { PeerRequestMessage } from "../../messages";
import type { PeerDispose, PeerErrorPayload } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolHandleOptions, ProtocolHandler } from "../types";

import { send } from "../../_actions/send";
import { reportError } from "../context";
import { createMethodNotFoundError, createRequestFailedError } from "../errors";

interface RegisteredHandler {
  handler: ProtocolHandler<unknown, unknown>;
  onError: ProtocolHandleOptions<unknown, unknown>["onError"];
}

interface CreateRequestHandlersArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export interface RequestHandlers {
  handle<TPayload, TResult>(options: ProtocolHandleOptions<TPayload, TResult>): PeerDispose;
  has(name: string): boolean;
  receive(message: PeerRequestMessage): Promise<void>;
  cancel(id: number, reason?: unknown): void;
  close(error: PeerErrorPayload): void;
}

export function createRequestHandlers<TSendOptions>({
  context,
}: CreateRequestHandlersArgs<TSendOptions>): RequestHandlers {
  const activeHandlers = new Map<number, AbortController>();
  const handlers = new Map<string, RegisteredHandler>();

  return {
    handle<TPayload, TResult>(options: ProtocolHandleOptions<TPayload, TResult>): PeerDispose {
      if (context.closed) {
        throw new Error("Peer is closed.");
      }

      if (handlers.has(options.name)) {
        throw new Error(`Handler already registered for "${options.name}".`);
      }

      const registeredHandler: RegisteredHandler = {
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

    has(name) {
      return handlers.has(name);
    },

    async receive(message) {
      const registeredHandler = handlers.get(message.name);

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

    cancel(id, reason) {
      const controller = activeHandlers.get(id);

      if (controller === undefined) {
        return;
      }

      activeHandlers.delete(id);
      controller.abort(reason);
    },

    close(error) {
      const active = [...activeHandlers.values()];

      activeHandlers.clear();
      handlers.clear();

      for (const controller of active) {
        controller.abort(error);
      }
    },
  };
}
