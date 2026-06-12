import type {
  PeerStreamEndMessage,
  PeerStreamErrorMessage,
  PeerStreamItemMessage,
  PeerStreamPullMessage,
  PeerStreamRequestMessage,
} from "../../messages";
import type { DisposePeerRegistration, PeerError, PeerStream } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolHandleStreamOptions, ProtocolStreamOptions } from "../types";

import { createStreamConsumers } from "./_consumers";
import { createStreamProducers } from "./_producers";

interface CreateStreamLifecycleArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  getNextId: () => number;
}

export interface StreamLifecycle<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolStreamOptions<TPayload, TSendOptions>,
  ): PeerStream<TResult>;
  handle<TPayload, TResult>(
    options: ProtocolHandleStreamOptions<TPayload, TResult>,
  ): DisposePeerRegistration;
  hasHandler(name: string): boolean;
  receiveRequest(message: PeerStreamRequestMessage): void;
  receivePull(message: PeerStreamPullMessage): Promise<void>;
  receiveItem(message: PeerStreamItemMessage): void;
  receiveEnd(message: PeerStreamEndMessage): void;
  receiveError(message: PeerStreamErrorMessage): void;
  cancelProducer(id: number, reason?: unknown): void;
  close(error: PeerError): void;
}

export function createStreamLifecycle<TSendOptions>({
  context,
  getNextId,
}: CreateStreamLifecycleArgs<TSendOptions>): StreamLifecycle<TSendOptions> {
  const consumers = createStreamConsumers({ context, getNextId });
  const producers = createStreamProducers({ context });

  return {
    create(options) {
      return consumers.create(options);
    },
    handle(options) {
      return producers.handle(options);
    },
    hasHandler(name) {
      return producers.hasHandler(name);
    },
    receiveRequest(message) {
      producers.receiveRequest(message);
    },
    receivePull(message) {
      return producers.receivePull(message);
    },
    receiveItem(message) {
      consumers.receiveItem(message);
    },
    receiveEnd(message) {
      consumers.receiveEnd(message);
    },
    receiveError(message) {
      consumers.receiveError(message);
    },
    cancelProducer(id, reason) {
      producers.cancel(id, reason);
    },
    close(error) {
      consumers.close(error);
      producers.close(error);
    },
  };
}
