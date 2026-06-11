import type { TransportSendArgs } from "../../transport";
import type { PeerContext } from "../_runtime/context";
import type { PeerMessage } from "../messages";

interface SendArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerMessage;
  options?: TSendOptions | undefined;
}

function createTransportSendArgs<TSendOptions>(
  options: TSendOptions | undefined,
): TransportSendArgs<TSendOptions> {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Transport options are represented as a conditional rest tuple at the channel boundary.
  return (options === undefined ? [] : [options]) as TransportSendArgs<TSendOptions>;
}

export function send<TSendOptions>({ context, message, options }: SendArgs<TSendOptions>): void {
  const args = createTransportSendArgs(options);

  context.channel.send(message, ...args);
}
