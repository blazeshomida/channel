import { assertOpen, createContext } from "./_context";
import { createPeerClosedError } from "./_errors";
import { receive } from "./_receive";
import { send } from "./_send";
import type {
  CreatePeerOptions,
  Peer,
  PeerHandleOptions,
  PeerNotifyOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
} from "./types";

export function createPeer<TSendOptions = void>(
  options: CreatePeerOptions<TSendOptions>,
): Peer<TSendOptions> {
  const context = createContext({ options });
  const { pendingRequests, handlers, notifications } = context;

  function rejectIfClosed<TResult>(): Promise<TResult> | undefined {
    if (!context.closed) {
      return undefined;
    }

    return Promise.reject(createPeerClosedError());
  }

  const unsubscribe = context.channel.subscribe((message) => {
    receive({ context, message });
  });

  return {
    request<TPayload = unknown, TResult = unknown>(
      requestOptions: PeerRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      const closedPromise = rejectIfClosed<TResult>();

      if (closedPromise) {
        return closedPromise;
      }

      const id = context.getRequestId();

      return new Promise<TResult>((resolve, reject) => {
        pendingRequests.set(id, {
          name: requestOptions.name,
          onError: requestOptions.onError,
          resolve: (value) => {
            resolve(value as TResult);
          },
          reject,
        });

        send({
          context,
          message: {
            type: "request",
            id,
            name: requestOptions.name,
            payload: requestOptions.payload,
          },
          options: requestOptions.send,
        });
      });
    },

    handle<TPayload = unknown, TResult = unknown>(
      handleOptions: PeerHandleOptions<TPayload, TResult>,
    ) {
      assertOpen({ context });

      if (handlers.has(handleOptions.name)) {
        throw new Error(`Handler already registered for "${handleOptions.name}".`);
      }

      let active = true;

      handlers.set(handleOptions.name, {
        handler: (payload, handlerContext) =>
          handleOptions.handler(payload as TPayload, handlerContext),
        onError: handleOptions.onError,
      });

      return () => {
        if (!active) {
          return;
        }

        active = false;
        handlers.delete(handleOptions.name);
      };
    },

    hasHandler(name) {
      return handlers.has(name);
    },

    notify<TPayload = unknown>(notifyOptions: PeerNotifyOptions<TPayload, TSendOptions>) {
      assertOpen({ context });

      send({
        context,
        message: {
          type: "notification",
          name: notifyOptions.name,
          payload: notifyOptions.payload,
        },
        options: notifyOptions.send,
      });
    },

    on<TPayload = unknown>(onOptions: PeerOnOptions<TPayload>) {
      assertOpen({ context });

      return notifications.add({
        name: onOptions.name,
        listener: (payload, notificationContext) =>
          onOptions.listener(payload as TPayload, notificationContext),
        onError: onOptions.onError,
        once: false,
      });
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      assertOpen({ context });

      return notifications.add({
        name: onceOptions.name,
        listener: (payload, notificationContext) =>
          onceOptions.listener(payload as TPayload, notificationContext),
        onError: onceOptions.onError,
        once: true,
      });
    },

    close() {
      if (context.closed) {
        return;
      }

      context.closed = true;

      pendingRequests.rejectAll(createPeerClosedError());
      handlers.clear();
      notifications.clear();
      unsubscribe();
      context.channel.close();
    },
  };
}
