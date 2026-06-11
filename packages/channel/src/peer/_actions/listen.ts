import { assertOpen, type PeerContext } from "../_runtime/context";
import type { PeerDispose, PeerOnOptions, PeerOnceOptions } from "../types";

interface ListenArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerOnOptions<TPayload>;
}

interface ListenOnceArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerOnceOptions<TPayload>;
}

interface AddListenerArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerOnOptions<TPayload> | PeerOnceOptions<TPayload>;
  once: boolean;
}

function addListener<TPayload = unknown, TSendOptions = void>({
  context,
  options,
  once,
}: AddListenerArgs<TPayload, TSendOptions>): PeerDispose {
  assertOpen({ context });

  return context.notifications.add({
    name: options.name,
    listener: (payload, notificationContext) =>
      options.listener(payload as TPayload, notificationContext),
    onError: options.onError,
    once,
  });
}

export function listen<TPayload = unknown, TSendOptions = void>({
  context,
  options,
}: ListenArgs<TPayload, TSendOptions>): PeerDispose {
  return addListener({
    context,
    options,
    once: false,
  });
}

export function listenOnce<TPayload = unknown, TSendOptions = void>({
  context,
  options,
}: ListenOnceArgs<TPayload, TSendOptions>): PeerDispose {
  return addListener({
    context,
    options,
    once: true,
  });
}
