import type { PeerContext } from "./_context";
import { createPeerClosedError } from "./_errors";
import type { PeerDispose } from "./types";

interface CloseArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  unsubscribe: PeerDispose;
}

export function close<TSendOptions = void>({
  context,
  unsubscribe,
}: CloseArgs<TSendOptions>): void {
  if (context.closed) {
    return;
  }

  context.closed = true;

  context.pendingRequests.rejectAll(createPeerClosedError());
  context.handlers.clear();
  context.notifications.clear();
  unsubscribe();
  context.channel.close();
}
