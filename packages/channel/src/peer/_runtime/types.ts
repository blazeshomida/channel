/// <reference lib="dom" />

import type { Channel } from "../../channel";
import type { PeerMessage } from "../messages";
import type {
  DisposePeerRegistration,
  PeerEventContext,
  PeerErrorCallback,
  PeerHandleContext,
  PeerStream,
} from "../types";

export interface ProtocolRequestOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorCallback;
}

export interface ProtocolNotifyOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  onError?: PeerErrorCallback;
}

export interface ProtocolStreamOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorCallback;
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
  context: PeerEventContext,
) => void;

export interface ProtocolHandleOptions<TPayload, TResult> {
  name: string;
  handler: ProtocolHandler<TPayload, TResult>;
  onError?: PeerErrorCallback;
}

export interface ProtocolHandleStreamOptions<TPayload, TResult> {
  name: string;
  handler: ProtocolStreamHandler<TPayload, TResult>;
  onError?: PeerErrorCallback;
}

export interface CreateProtocolRuntimeOptions<TSendOptions = void> {
  channel: Channel<unknown, PeerMessage, TSendOptions>;
  onNotification?: ProtocolNotificationListener<unknown>;
  onError?: PeerErrorCallback;
}

export interface ProtocolRuntime<TSendOptions = void> {
  request<TPayload = unknown, TResult = unknown>(
    options: ProtocolRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;
  handle<TPayload = unknown, TResult = unknown>(
    options: ProtocolHandleOptions<TPayload, TResult>,
  ): DisposePeerRegistration;
  hasHandler(name: string): boolean;
  stream<TPayload = unknown, TResult = unknown>(
    options: ProtocolStreamOptions<TPayload, TSendOptions>,
  ): PeerStream<TResult>;
  handleStream<TPayload = unknown, TResult = unknown>(
    options: ProtocolHandleStreamOptions<TPayload, TResult>,
  ): DisposePeerRegistration;
  hasStreamHandler(name: string): boolean;
  notify<TPayload = unknown>(options: ProtocolNotifyOptions<TPayload, TSendOptions>): void;
  close(): void;
}
