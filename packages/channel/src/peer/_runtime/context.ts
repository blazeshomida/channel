import type { Channel } from "../../channel";
import type { PeerMessage } from "../messages";
import type { PeerErrorContext, PeerErrorHandler } from "../types";
import type { CreateProtocolRuntimeOptions, ProtocolNotificationListener } from "./types";

import { invokeErrorHandler } from "./error-handler";

interface CreateContextArgs<TSendOptions> {
  options: CreateProtocolRuntimeOptions<TSendOptions>;
}

export interface PeerContext<TSendOptions = void> {
  channel: Channel<unknown, PeerMessage, TSendOptions>;
  onNotification?: ProtocolNotificationListener<unknown>;
  closed: boolean;
  onError?: PeerErrorHandler;
}

export function createContext<TSendOptions>({
  options,
}: CreateContextArgs<TSendOptions>): PeerContext<TSendOptions> {
  const context: PeerContext<TSendOptions> = {
    channel: options.channel,
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
  invokeErrorHandler(onError, error, errorContext);
  invokeErrorHandler(context.onError, error, errorContext);
}

interface AssertOpenArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
}

export function assertOpen<TSendOptions>({ context }: AssertOpenArgs<TSendOptions>): void {
  if (context.closed) {
    throw new Error("Peer is closed.");
  }
}
