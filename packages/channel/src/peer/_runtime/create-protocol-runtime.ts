import type {
  CreateProtocolRuntimeOptions,
  ProtocolHandleOptions,
  ProtocolHandleStreamOptions,
  ProtocolNotifyOptions,
  ProtocolRequestOptions,
  ProtocolRuntime,
  ProtocolStreamOptions,
} from "./types";

import { notify } from "../_actions/notify";
import { receive } from "../_actions/receive";
import { createContext } from "./context";
import { createPeerClosedError } from "./errors";
import { createRequestLifecycle } from "./request-lifecycle";
import { createStreamLifecycle } from "./stream-lifecycle";

export function createProtocolRuntime<TSendOptions = void>(
  options: CreateProtocolRuntimeOptions<TSendOptions>,
): ProtocolRuntime<TSendOptions> {
  const context = createContext({ options });
  const requests = createRequestLifecycle({ context });
  const streams = createStreamLifecycle({
    context,
    getNextId: () => requests.getNextId(),
  });

  const unsubscribe = context.channel.subscribe((message) => {
    receive({ context, message, requests, streams });
  });

  return {
    request<TPayload = unknown, TResult = unknown>(
      requestOptions: ProtocolRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      return requests.create<TPayload, TResult>(requestOptions);
    },

    handle<TPayload = unknown, TResult = unknown>(
      handleOptions: ProtocolHandleOptions<TPayload, TResult>,
    ) {
      return requests.handle(handleOptions);
    },

    hasHandler(name: string): boolean {
      return requests.hasHandler(name);
    },

    stream<TPayload = unknown, TResult = unknown>(
      streamOptions: ProtocolStreamOptions<TPayload, TSendOptions>,
    ) {
      return streams.create<TPayload, TResult>(streamOptions);
    },

    handleStream<TPayload = unknown, TResult = unknown>(
      handleStreamOptions: ProtocolHandleStreamOptions<TPayload, TResult>,
    ) {
      return streams.handle(handleStreamOptions);
    },

    hasStreamHandler(name: string): boolean {
      return streams.hasHandler(name);
    },

    notify<TPayload = unknown>(notifyOptions: ProtocolNotifyOptions<TPayload, TSendOptions>): void {
      notify<TPayload, TSendOptions>({
        context,
        options: notifyOptions,
      });
    },

    close(): void {
      if (context.closed) {
        return;
      }

      context.closed = true;

      const error = createPeerClosedError();

      requests.close(error);
      streams.close(error);
      unsubscribe();
      context.channel.close();
    },
  };
}
