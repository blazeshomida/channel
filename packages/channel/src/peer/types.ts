/// <reference lib="dom" />

export type PeerErrorCode =
  | "METHOD_NOT_FOUND"
  | "REQUEST_FAILED"
  | "REQUEST_CANCELLED"
  | "STREAM_FAILED"
  | "PEER_CLOSED"
  | "VALIDATION_FAILED";

export interface PeerErrorPayload {
  code: PeerErrorCode;
  message: string;
  data?: unknown;
}

export type PeerErrorContext =
  | { type: "request"; id: number; name: string }
  | { type: "handler"; id: number; name: string }
  | { type: "notification"; name: string }
  | { type: "response"; id: number }
  | { type: "stream"; id: number; name: string }
  | { type: "stream-handler"; id: number; name: string }
  | { type: "stream-message"; id: number };

export type PeerErrorHandler = (error: unknown, context: PeerErrorContext) => void;

export interface PeerHandleContext {
  id: number;
  name: string;
  signal: AbortSignal;
}

export interface PeerNotificationContext {
  name: string;
}

export type PeerDispose = () => void;

export interface PeerStream<TResult> extends AsyncIterableIterator<TResult> {
  return(): Promise<IteratorResult<TResult>>;
}
