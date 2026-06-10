import { assertOpen, type PeerContext } from "./_context";
import { send } from "./_send";
import type { PeerNotifyOptions } from "./types";

interface NotifyArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerNotifyOptions<TPayload, TSendOptions>;
}

export function notify<TPayload = unknown, TSendOptions = void>({
  context,
  options,
}: NotifyArgs<TPayload, TSendOptions>): void {
  assertOpen({ context });

  send({
    context,
    message: {
      type: "notification",
      name: options.name,
      payload: options.payload,
    },
    options: options.send,
  });
}
