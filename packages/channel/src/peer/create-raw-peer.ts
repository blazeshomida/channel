import type {
  CreatePeerOptions,
  Peer,
  PeerHandleOptions,
  PeerHandleStreamOptions,
  PeerNotifyOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
  PeerStream,
  PeerStreamOptions,
} from "./types";

import { close } from "./_actions/close";
import { handle, hasHandler } from "./_actions/handle";
import { handleStream, hasStreamHandler } from "./_actions/handle-stream";
import { listen, listenOnce } from "./_actions/listen";
import { notify } from "./_actions/notify";
import { receive } from "./_actions/receive";
import { request } from "./_actions/request";
import { stream } from "./_actions/stream";
import { createContext } from "./_runtime/context";

export function createRawPeer<TSendOptions = void>(
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

    stream<TPayload = unknown, TResult = unknown>(
      streamOptions: PeerStreamOptions<TPayload, TSendOptions>,
    ): PeerStream<TResult> {
      return stream<TResult, TPayload, TSendOptions>({
        context,
        options: streamOptions,
      });
    },

    handleStream<TPayload = unknown, TResult = unknown>(
      handleStreamOptions: PeerHandleStreamOptions<TPayload, TResult>,
    ) {
      return handleStream<TPayload, TResult, TSendOptions>({
        context,
        options: handleStreamOptions,
      });
    },

    hasStreamHandler(name: string): boolean {
      return hasStreamHandler({
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
