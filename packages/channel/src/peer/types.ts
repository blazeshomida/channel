/// <reference lib="dom" />

export type PeerErrorCode =
  | "INVALID_MESSAGE"
  | "HANDLER_NOT_FOUND"
  | "OPERATION_CANCELLED"
  | "REQUEST_FAILED"
  | "STREAM_FAILED"
  | "PEER_CLOSED"
  | "VALIDATION_FAILED";

export interface PeerError {
  code: PeerErrorCode;
  message: string;
  data?: unknown;
}

export type PeerErrorContext =
  | { type: "message"; message: unknown }
  | { type: "request"; id: number; name: string }
  | { type: "request-handler"; id: number; name: string }
  | { type: "event"; name: string }
  | { type: "response"; id: number }
  | { type: "stream"; id: number; name: string }
  | { type: "stream-handler"; id: number; name: string }
  | { type: "stream-message"; id: number };

export type PeerErrorCallback = (error: unknown, context: PeerErrorContext) => void;

export interface PeerHandleContext {
  id: number;
  name: string;
  signal: AbortSignal;
}

export interface PeerEventContext {
  name: string;
}

export type DisposePeerRegistration = () => void;

export interface PeerStream<TItem> extends AsyncIterableIterator<TItem> {
  return(): Promise<IteratorResult<TItem>>;
}

export type PeerValidationBoundary = "input" | "output" | "item";

export interface PeerValidationIssue {
  message: string;
  path?: readonly (string | number)[];
}

export interface PeerValidationFailureData {
  operation: string;
  boundary: PeerValidationBoundary;
  issues: readonly PeerValidationIssue[];
}
