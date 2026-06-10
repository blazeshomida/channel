import { assertOpen, createContext } from "./_context";
import { createPeerClosedError } from "./_errors";
import { notify } from "./_notify";
import { receive } from "./_receive";
import { request } from "./_request";
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

  const unsubscribe = context.channel.subscribe((message) => {
    receive({ context, message });
  });

  return {
    request<TPayload = unknown, TResult = unknown>(
      requestOptions: PeerRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      return request<TPayload, TResult, TSendOptions>({
        context,
        options: requestOptions,
      });
    },

    handle<TPayload = unknown, TResult = unknown>(
      handleOptions: PeerHandleOptions<TPayload, TResult>,
    ) {
      assertOpen({ context });

      if (context.handlers.has(handleOptions.name)) {
        throw new Error(`Handler already registered for "${handleOptions.name}".`);
      }

      let active = true;

      context.handlers.set(handleOptions.name, {
        handler: (payload, handlerContext) =>
          handleOptions.handler(payload as TPayload, handlerContext),
        onError: handleOptions.onError,
      });

      return () => {
        if (!active) {
          return;
        }

        active = false;
        context.handlers.delete(handleOptions.name);
      };
    },

    hasHandler(name) {
      return context.handlers.has(name);
    },

    notify<TPayload = unknown>(notifyOptions: PeerNotifyOptions<TPayload, TSendOptions>) {
      notify<TPayload, TSendOptions>({
        context,
        options: notifyOptions,
      });
    },

    on<TPayload = unknown>(onOptions: PeerOnOptions<TPayload>) {
      assertOpen({ context });

      return context.notifications.add({
        name: onOptions.name,
        listener: (payload, notificationContext) =>
          onOptions.listener(payload as TPayload, notificationContext),
        onError: onOptions.onError,
        once: false,
      });
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      assertOpen({ context });

      return context.notifications.add({
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

      context.pendingRequests.rejectAll(createPeerClosedError());
      context.handlers.clear();
      context.notifications.clear();
      unsubscribe();
      context.channel.close();
    },
  };
}
