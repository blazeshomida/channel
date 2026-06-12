import type { PeerRequestMessage, PeerResponseMessage } from "../../messages";
import type { DisposePeerRegistration, PeerError } from "../../types";
import type { PeerContext } from "../context";
import type { ProtocolHandleOptions, ProtocolRequestOptions } from "../types";

import { createRequestClient } from "./_client";
import { createRequestHandlers } from "./_handlers";

interface CreateRequestLifecycleArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export interface RequestLifecycle<TSendOptions> {
  create<TPayload, TResult>(
    options: ProtocolRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;
  handle<TPayload, TResult>(
    options: ProtocolHandleOptions<TPayload, TResult>,
  ): DisposePeerRegistration;
  hasHandler(name: string): boolean;
  getNextId: () => number;
  receiveResponse(message: PeerResponseMessage): void;
  receiveRequest(message: PeerRequestMessage): Promise<void>;
  cancelHandler(id: number, reason?: unknown): void;
  close(error: PeerError): void;
}

export function createRequestLifecycle<TSendOptions>({
  context,
}: CreateRequestLifecycleArgs<TSendOptions>): RequestLifecycle<TSendOptions> {
  const client = createRequestClient({ context });
  const handlers = createRequestHandlers({ context });

  return {
    create(options) {
      return client.create(options);
    },
    handle(options) {
      return handlers.handle(options);
    },
    hasHandler(name) {
      return handlers.has(name);
    },
    getNextId() {
      return client.getNextId();
    },
    receiveResponse(message) {
      client.receiveResponse(message);
    },
    receiveRequest(message) {
      return handlers.receive(message);
    },
    cancelHandler(id, reason) {
      handlers.cancel(id, reason);
    },
    close(error) {
      client.close(error);
      handlers.close(error);
    },
  };
}
