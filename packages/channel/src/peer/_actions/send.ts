import type { TransportSendArgs } from "../../transport";
import type { PeerContext } from "../_runtime/context";
import type { PeerMessage } from "../messages";

interface SendArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerMessage;
  options?: TSendOptions | undefined;
}

export function send<TSendOptions>({ context, message, options }: SendArgs<TSendOptions>): void {
  const args = (options === undefined ? [] : [options]) as TransportSendArgs<TSendOptions>;

  context.channel.send(message, ...args);
}
