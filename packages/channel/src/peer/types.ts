/// <reference lib="dom" />

import type { Channel } from "../channel";
import type { PeerMessage } from "./messages";

export type PeerErrorCode =
  | "METHOD_NOT_FOUND"
  | "REQUEST_FAILED"
  | "REQUEST_CANCELLED"
  | "PEER_CLOSED";

export interface PeerErrorPayload {
  code: PeerErrorCode;
  message: string;
  data?: unknown;
}

export type PeerErrorContext =
  | { type: "request"; id: number; name: string }
  | { type: "handler"; id: number; name: string }
  | { type: "notification"; name: string }
  | { type: "response"; id: number };

export type PeerErrorHandler = (error: unknown, context: PeerErrorContext) => void;

export interface PeerRequestOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorHandler;
}

export interface PeerNotifyOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
  onError?: PeerErrorHandler;
}

export interface PeerHandleContext {
  id: number;
  name: string;
  signal: AbortSignal;
}

export interface PeerNotificationContext {
  name: string;
}

export type PeerHandler<TPayload, TResult> = (
  payload: TPayload,
  context: PeerHandleContext,
) => TResult | Promise<TResult>;

export type PeerNotificationListener<TPayload> = (
  payload: TPayload,
  context: PeerNotificationContext,
) => void;

export interface PeerHandleOptions<TPayload, TResult> {
  name: string;
  handler: PeerHandler<TPayload, TResult>;
  onError?: PeerErrorHandler;
}

export interface PeerOnOptions<TPayload> {
  name: string;
  listener: PeerNotificationListener<TPayload>;
  onError?: PeerErrorHandler;
}

export interface PeerOnceOptions<TPayload> {
  name: string;
  listener: PeerNotificationListener<TPayload>;
  onError?: PeerErrorHandler;
}

export interface CreatePeerOptions<TSendOptions = void> {
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>;
  onError?: PeerErrorHandler;
}

export type PeerDispose = () => void;

export interface Peer<TSendOptions = void> {
  request<TPayload = unknown, TResult = unknown>(
    options: PeerRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;

  handle<TPayload = unknown, TResult = unknown>(
    options: PeerHandleOptions<TPayload, TResult>,
  ): PeerDispose;

  hasHandler(name: string): boolean;

  notify<TPayload = unknown>(options: PeerNotifyOptions<TPayload, TSendOptions>): void;

  on<TPayload = unknown>(options: PeerOnOptions<TPayload>): PeerDispose;

  once<TPayload = unknown>(options: PeerOnceOptions<TPayload>): PeerDispose;

  close(): void;
}
