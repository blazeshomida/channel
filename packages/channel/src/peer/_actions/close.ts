import type { PeerContext } from "../_runtime/context";
import type { RequestLifecycle } from "../_runtime/request-lifecycle";
import type { StreamLifecycle } from "../_runtime/stream-lifecycle";
import type { PeerDispose } from "../types";

import { createPeerClosedError } from "../_runtime/errors";

interface CloseArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  requests: RequestLifecycle<TSendOptions>;
  streams: StreamLifecycle<TSendOptions>;
  unsubscribe: PeerDispose;
}

export function close<TSendOptions = void>({
  context,
  requests,
  streams,
  unsubscribe,
}: CloseArgs<TSendOptions>): void {
  if (context.closed) {
    return;
  }

  context.closed = true;

  const error = createPeerClosedError();

  requests.close(error);
  streams.close(error);
  context.handlers.clear();
  context.streamHandlers.clear();
  unsubscribe();
  context.channel.close();
}
