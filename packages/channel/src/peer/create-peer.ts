import { close } from "./_actions/close";
import { handle, hasHandler } from "./_actions/handle";
import { listen, listenOnce } from "./_actions/listen";
import { notify } from "./_actions/notify";
import { receive } from "./_actions/receive";
import { request } from "./_actions/request";
import { createContext } from "./_runtime/context";
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

    close(): void {
      close({
        context,
        unsubscribe,
      });
    },
  };
}
