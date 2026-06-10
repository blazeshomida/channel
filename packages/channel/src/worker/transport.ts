import type { Transport } from "../transport";
import type { WorkerMessageEventTarget, WorkerPostMessageTarget, WorkerSendOptions } from "./types";

export interface CreateWorkerTransportOptions {
  close?: () => void;
}

export function createWorkerTransport<TInbound, TOutbound>(
  target: WorkerMessageEventTarget<TInbound> & WorkerPostMessageTarget<TOutbound>,
  options: CreateWorkerTransportOptions = {},
): Transport<TInbound, TOutbound, WorkerSendOptions> {
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

  if (options.close) {
    transport.close = options.close;
  }

  return transport;
}
