import type { PeerContext } from "../_runtime/context";
import type { ProtocolHandleStreamOptions } from "../_runtime/types";

import { assertOpen } from "../_runtime/context";

interface HandleStreamArgs<TPayload, TResult, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: ProtocolHandleStreamOptions<TPayload, TResult>;
}

interface HasStreamHandlerArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  name: string;
}

export function handleStream<TPayload = unknown, TResult = unknown, TSendOptions = void>({
  context,
  options,
}: HandleStreamArgs<TPayload, TResult, TSendOptions>) {
  assertOpen({ context });

  if (context.streamHandlers.has(options.name)) {
    throw new Error(`Stream handler already registered for "${options.name}".`);
  }

  let active = true;

  context.streamHandlers.set(options.name, {
    handler: (payload, handlerContext) => {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Peer payload types are compile-time contracts; runtime schemas belong in a future contract layer.
      return options.handler(payload as TPayload, handlerContext);
    },
    onError: options.onError,
  });

  return () => {
    if (!active) {
      return;
    }

    active = false;
    context.streamHandlers.delete(options.name);
  };
}

export function hasStreamHandler<TSendOptions = void>({
  context,
  name,
}: HasStreamHandlerArgs<TSendOptions>): boolean {
  return context.streamHandlers.has(name);
}
