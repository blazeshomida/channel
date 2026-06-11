import type { Transport } from "../transport";
import type { WorkerClientTarget, WorkerSendOptions } from "./types";

import { createWorkerTransport } from "./_runtime/transport";

/**
 * Creates a transport for communicating with a worker from the main thread.
 *
 * Closing the transport terminates the worker.
 *
 * @example
 * ```ts
 * import { createChannel } from "@blazeshomida/channel";
 * import { createTransport } from "@blazeshomida/channel/worker/client";
 *
 * const worker = new Worker(new URL("./worker.ts", import.meta.url), {
 *   type: "module",
 * });
 *
 * const channel = createChannel(createTransport(worker));
 * ```
 */
export function createTransport<TInbound = unknown, TOutbound = TInbound>(
  worker: WorkerClientTarget<TInbound, TOutbound>,
): Transport<TInbound, TOutbound, WorkerSendOptions> {
  return createWorkerTransport({
    target: worker,
    close: () => worker.terminate(),
  });
}
