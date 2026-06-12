import type { Channel } from "../../channel";
import type { PeerMessage } from "../messages";
import type { PeerErrorContext, PeerErrorHandler } from "../types";
import type { CreateProtocolRuntimeOptions, ProtocolNotificationListener } from "./types";

import {
  createActiveRequestRegistry,
  type ActiveRequestRegistry,
} from "../_registries/active-requests";
import {
  createCancelledRequestRegistry,
  type CancelledRequestRegistry,
} from "../_registries/cancelled-requests";
import { createHandlerRegistry, type HandlerRegistry } from "../_registries/handlers";
import {
  createPendingRequestRegistry,
  createRequestIdFactory,
  type PendingRequestRegistry,
  type RequestIdFactory,
} from "../_registries/pending-requests";
import {
  createStreamHandlerRegistry,
  type StreamHandlerRegistry,
} from "../_registries/stream-handlers";

interface CreateContextArgs<TSendOptions> {
  options: CreateProtocolRuntimeOptions<TSendOptions>;
}

export interface PeerContext<TSendOptions = void> {
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>;
  getRequestId: RequestIdFactory;
  pendingRequests: PendingRequestRegistry;
  cancelledRequests: CancelledRequestRegistry;
  activeRequests: ActiveRequestRegistry;
  handlers: HandlerRegistry;
  streamHandlers: StreamHandlerRegistry;
  onNotification?: ProtocolNotificationListener<unknown>;
  closed: boolean;
  onError?: PeerErrorHandler;
}

export function createContext<TSendOptions>({
  options,
}: CreateContextArgs<TSendOptions>): PeerContext<TSendOptions> {
  const context: PeerContext<TSendOptions> = {
    channel: options.channel,
    getRequestId: createRequestIdFactory(),
    pendingRequests: createPendingRequestRegistry(),
    cancelledRequests: createCancelledRequestRegistry(),
    activeRequests: createActiveRequestRegistry(),
    handlers: createHandlerRegistry(),
    streamHandlers: createStreamHandlerRegistry(),
    closed: false,
  };

  if (options.onNotification !== undefined) {
    context.onNotification = options.onNotification;
  }

  if (options.onError !== undefined) {
    context.onError = options.onError;
  }

  return context;
}

interface ReportErrorArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  error: unknown;
  errorContext: PeerErrorContext;
  onError?: PeerErrorHandler | undefined;
}

export function reportError<TSendOptions>({
  context,
  error,
  errorContext,
  onError,
}: ReportErrorArgs<TSendOptions>): void {
  onError?.(error, errorContext);
  context.onError?.(error, errorContext);
}

interface AssertOpenArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export function assertOpen<TSendOptions>({ context }: AssertOpenArgs<TSendOptions>): void {
  if (context.closed) {
    throw new Error("Peer is closed.");
  }
}
