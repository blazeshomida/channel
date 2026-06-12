import type { ProtocolOnOptions, ProtocolOnceOptions } from "../_runtime/types";
import type { PeerDispose } from "../types";

import { assertOpen, type PeerContext } from "../_runtime/context";

interface ListenArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: ProtocolOnOptions<TPayload>;
}

interface ListenOnceArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: ProtocolOnceOptions<TPayload>;
}

interface AddListenerArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: ProtocolOnOptions<TPayload> | ProtocolOnceOptions<TPayload>;
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
    listener: (payload, notificationContext) => {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Peer payload types are compile-time contracts; runtime schemas belong in a future contract layer.
      options.listener(payload as TPayload, notificationContext);
    },
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
