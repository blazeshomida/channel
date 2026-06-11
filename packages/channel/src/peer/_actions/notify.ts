import { assertOpen, type PeerContext } from "../_runtime/context";
import type { PeerNotifyOptions } from "../types";
import { send } from "./send";

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
