import type { PeerContext } from "../_runtime/context";
import type { PeerDispose } from "../types";

import { createPeerClosedError } from "../_runtime/errors";

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
  context.pendingStreams.rejectAll(createPeerClosedError());
  context.cancelledRequests.clear();
  context.activeRequests.abortAll(createPeerClosedError());
  context.activeStreams.abortAll(createPeerClosedError());
  context.handlers.clear();
  context.streamHandlers.clear();
  context.notifications.clear();
  unsubscribe();
  context.channel.close();
}
