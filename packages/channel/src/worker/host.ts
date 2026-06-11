import type { Transport } from "../transport";
import { createWorkerTransport } from "./_runtime/transport";
import type { WorkerHostTarget, WorkerSendOptions } from "./types";

/**
 * Creates a transport for communicating from inside a worker.
 *
 * Closing the transport closes the worker scope when the runtime supports it.
 *
 * @example
 * ```ts
 * import { createChannel } from "@blazeshomida/channel";
 * import { createTransport } from "@blazeshomida/channel/worker/host";
 *
 * const channel = createChannel(createTransport(self));
 * ```
 */
export function createTransport<TInbound = unknown, TOutbound = TInbound>(
  target: WorkerHostTarget<TInbound, TOutbound>,
): Transport<TInbound, TOutbound, WorkerSendOptions> {
  return createWorkerTransport({
    target,
    close: () => target.close?.(),
  });
}