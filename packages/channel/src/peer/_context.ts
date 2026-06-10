import type { Channel } from "../channel";
import { createHandlerRegistry } from "./_handlers";
import { createNotificationRegistry } from "./_notifications";
import { createPendingRequestRegistry, createRequestIdFactory } from "./_requests";
import type { PeerMessage } from "./messages";
import type { CreatePeerOptions, PeerErrorContext, PeerErrorHandler } from "./types";

interface CreateContextArgs<TSendOptions> {
  options: CreatePeerOptions<TSendOptions>;
}

export interface PeerContext<TSendOptions = void> {
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>;
  getRequestId: () => number;
  pendingRequests: ReturnType<typeof createPendingRequestRegistry>;
  handlers: ReturnType<typeof createHandlerRegistry>;
  notifications: ReturnType<typeof createNotificationRegistry>;
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
    handlers: createHandlerRegistry(),
    notifications: createNotificationRegistry(),
    closed: false,
  };

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
