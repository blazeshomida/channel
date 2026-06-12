import type {
  CreateProtocolRuntimeOptions,
  ProtocolHandleOptions,
  ProtocolHandleStreamOptions,
  ProtocolNotifyOptions,
  ProtocolRequestOptions,
  ProtocolRuntime,
  ProtocolStreamOptions,
} from "./types";

import { close } from "../_actions/close";
import { handle, hasHandler } from "../_actions/handle";
import { handleStream, hasStreamHandler } from "../_actions/handle-stream";
import { notify } from "../_actions/notify";
import { receive } from "../_actions/receive";
import { request } from "../_actions/request";
import { createContext } from "./context";
import { createStreamLifecycle } from "./stream-lifecycle";

export function createProtocolRuntime<TSendOptions = void>(
  options: CreateProtocolRuntimeOptions<TSendOptions>,
): ProtocolRuntime<TSendOptions> {
  const context = createContext({ options });
  const streams = createStreamLifecycle({ context });

  const unsubscribe = context.channel.subscribe((message) => {
    receive({ context, message, streams });
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
      return streams.create<TPayload, TResult>(streamOptions);
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

    close(): void {
      close({
        context,
        streams,
        unsubscribe,
      });
    },
  };
}
