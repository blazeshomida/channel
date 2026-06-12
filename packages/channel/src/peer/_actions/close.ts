import type { PeerContext } from "../_runtime/context";
import type { StreamLifecycle } from "../_runtime/stream-lifecycle";
import type { PeerDispose } from "../types";

import { createPeerClosedError } from "../_runtime/errors";

interface CloseArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  streams: StreamLifecycle<TSendOptions>;
  unsubscribe: PeerDispose;
}

export function close<TSendOptions = void>({
  context,
  streams,
  unsubscribe,
}: CloseArgs<TSendOptions>): void {
  if (context.closed) {
    return;
  }

  context.closed = true;

  context.pendingRequests.rejectAll(createPeerClosedError());
  context.cancelledRequests.clear();
  context.activeRequests.abortAll(createPeerClosedError());
  streams.close(createPeerClosedError());
  context.handlers.clear();
  context.streamHandlers.clear();
  context.notifications.clear();
  unsubscribe();
  context.channel.close();
}
