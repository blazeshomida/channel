import type {
  CreateProtocolRuntimeOptions,
  ProtocolHandleOptions,
  ProtocolHandleStreamOptions,
  ProtocolNotifyOptions,
  ProtocolOnOptions,
  ProtocolOnceOptions,
  ProtocolRequestOptions,
  ProtocolRuntime,
  ProtocolStreamOptions,
} from "./types";

import { close } from "../_actions/close";
import { handle, hasHandler } from "../_actions/handle";
import { handleStream, hasStreamHandler } from "../_actions/handle-stream";
import { listen, listenOnce } from "../_actions/listen";
import { notify } from "../_actions/notify";
import { receive } from "../_actions/receive";
import { request } from "../_actions/request";
import { stream } from "../_actions/stream";
import { createContext } from "./context";

export function createProtocolRuntime<TSendOptions = void>(
  options: CreateProtocolRuntimeOptions<TSendOptions>,
): ProtocolRuntime<TSendOptions> {
  const context = createContext({ options });

  const unsubscribe = context.channel.subscribe((message) => {
    receive({ context, message });
  });

  return {
    request<TPayload = unknown, TResult = unknown>(
      requestOptions: ProtocolRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      return request<TPayload, TResult, TSendOptions>({
        context,
        options: requestOptions,
      });
    },

    handle<TPayload = unknown, TResult = unknown>(
      handleOptions: ProtocolHandleOptions<TPayload, TResult>,
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
      streamOptions: ProtocolStreamOptions<TPayload, TSendOptions>,
    ) {
      return stream<TResult, TPayload, TSendOptions>({
        context,
        options: streamOptions,
      });
    },

    handleStream<TPayload = unknown, TResult = unknown>(
      handleStreamOptions: ProtocolHandleStreamOptions<TPayload, TResult>,
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

    notify<TPayload = unknown>(notifyOptions: ProtocolNotifyOptions<TPayload, TSendOptions>): void {
      notify<TPayload, TSendOptions>({
        context,
        options: notifyOptions,
      });
    },

    on<TPayload = unknown>(onOptions: ProtocolOnOptions<TPayload>) {
      return listen<TPayload, TSendOptions>({
        context,
        options: onOptions,
      });
    },

    once<TPayload = unknown>(onceOptions: ProtocolOnceOptions<TPayload>) {
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
