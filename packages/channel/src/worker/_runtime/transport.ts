import type { Transport } from "../../transport";
import type {
  WorkerMessageEventTarget,
  WorkerPostMessageTarget,
  WorkerSendOptions,
} from "../types";

interface CreateWorkerTransportArgs<TInbound, TOutbound> {
  target: WorkerMessageEventTarget<TInbound> & WorkerPostMessageTarget<TOutbound>;
  close?: (() => void) | undefined;
}

export function createWorkerTransport<TInbound, TOutbound>({
  target,
  close,
}: CreateWorkerTransportArgs<TInbound, TOutbound>): Transport<
  TInbound,
  TOutbound,
  WorkerSendOptions
> {
  const transport: Transport<TInbound, TOutbound, WorkerSendOptions> = {
    send(message, sendOptions) {
      target.postMessage(message, [...(sendOptions?.transfer ?? [])]);
    },

    subscribe(listener) {
      const handleMessage = (event: MessageEvent<TInbound>) => {
        listener(event.data);
      };

      target.addEventListener("message", handleMessage);

      return () => {
        target.removeEventListener("message", handleMessage);
      };
    },
  };

  if (close !== undefined) {
    transport.close = close;
  }

  return transport;
}
