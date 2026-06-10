import { createContext } from "./_context";
import { createPeerClosedError } from "./_errors";
import { handle, hasHandler } from "./_handle";
import { listen, listenOnce } from "./_listen";
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
      return handle<TPayload, TResult, TSendOptions>({
        context,
        options: handleOptions,
      });
    },

    hasHandler(name: string): boolean {
      return hasHandler({
        context,
        name,
      });
    },

    notify<TPayload = unknown>(notifyOptions: PeerNotifyOptions<TPayload, TSendOptions>): void {
      notify<TPayload, TSendOptions>({
        context,
        options: notifyOptions,
      });
    },

    on<TPayload = unknown>(onOptions: PeerOnOptions<TPayload>) {
      return listen<TPayload, TSendOptions>({
        context,
        options: onOptions,
      });
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      return listenOnce<TPayload, TSendOptions>({
        context,
        options: onceOptions,
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
