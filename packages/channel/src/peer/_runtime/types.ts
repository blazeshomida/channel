/// <reference lib="dom" />

import type { Channel } from "../../channel";
import type { PeerMessage } from "../messages";
import type {
  PeerDispose,
  PeerErrorHandler,
  PeerHandleContext,
  PeerNotificationContext,
  PeerStream,
} from "../types";

export interface ProtocolRequestOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorHandler;
}

export interface ProtocolNotifyOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  onError?: PeerErrorHandler;
}

export interface ProtocolStreamOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorHandler;
}

export type ProtocolStreamHandler<TPayload, TResult> = (
  payload: TPayload,
  context: PeerHandleContext,
) => AsyncIterable<TResult>;

export type ProtocolHandler<TPayload, TResult> = (
  payload: TPayload,
  context: PeerHandleContext,
) => TResult | Promise<TResult>;

export type ProtocolNotificationListener<TPayload> = (
  payload: TPayload,
  context: PeerNotificationContext,
) => void;

export interface ProtocolHandleOptions<TPayload, TResult> {
  name: string;
  handler: ProtocolHandler<TPayload, TResult>;
  onError?: PeerErrorHandler;
}

export interface ProtocolHandleStreamOptions<TPayload, TResult> {
  name: string;
  handler: ProtocolStreamHandler<TPayload, TResult>;
  onError?: PeerErrorHandler;
}

export interface ProtocolOnOptions<TPayload> {
  name: string;
  listener: ProtocolNotificationListener<TPayload>;
  onError?: PeerErrorHandler;
}

export type ProtocolOnceOptions<TPayload> = ProtocolOnOptions<TPayload>;

export interface CreateProtocolRuntimeOptions<TSendOptions = void> {
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>;
  onError?: PeerErrorHandler;
}

export interface ProtocolRuntime<TSendOptions = void> {
  request<TPayload = unknown, TResult = unknown>(
    options: ProtocolRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;
  handle<TPayload = unknown, TResult = unknown>(
    options: ProtocolHandleOptions<TPayload, TResult>,
  ): PeerDispose;
  hasHandler(name: string): boolean;
  stream<TPayload = unknown, TResult = unknown>(
    options: ProtocolStreamOptions<TPayload, TSendOptions>,
  ): PeerStream<TResult>;
  handleStream<TPayload = unknown, TResult = unknown>(
    options: ProtocolHandleStreamOptions<TPayload, TResult>,
  ): PeerDispose;
  hasStreamHandler(name: string): boolean;
  notify<TPayload = unknown>(options: ProtocolNotifyOptions<TPayload, TSendOptions>): void;
  on<TPayload = unknown>(options: ProtocolOnOptions<TPayload>): PeerDispose;
  once<TPayload = unknown>(options: ProtocolOnceOptions<TPayload>): PeerDispose;
  close(): void;
}
