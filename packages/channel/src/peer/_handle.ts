import { assertOpen, type PeerContext } from "./_context";
import type { PeerHandleOptions } from "./types";

interface HandleArgs<TPayload, TResult, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerHandleOptions<TPayload, TResult>;
}

interface HasHandlerArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  name: string;
}

export function handle<TPayload = unknown, TResult = unknown, TSendOptions = void>({
  context,
  options,
}: HandleArgs<TPayload, TResult, TSendOptions>) {
  assertOpen({ context });

  if (context.handlers.has(options.name)) {
    throw new Error(`Handler already registered for "${options.name}".`);
  }

  let active = true;

  context.handlers.set(options.name, {
    handler: (payload, handlerContext) => options.handler(payload as TPayload, handlerContext),
    onError: options.onError,
  });

  return () => {
    if (!active) {
      return;
    }

    active = false;
    context.handlers.delete(options.name);
  };
}

export function hasHandler<TSendOptions = void>({
  context,
  name,
}: HasHandlerArgs<TSendOptions>): boolean {
  return context.handlers.has(name);
}
