import type { PeerError, PeerErrorCode } from "../types";

export function createPeerError(code: PeerErrorCode, message: string, data?: unknown): PeerError {
  return data === undefined ? { code, message } : { code, message, data };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPeerError(error: unknown): error is PeerError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export function createRequestFailedError(error: unknown): PeerError {
  return isPeerError(error) ? error : createPeerError("REQUEST_FAILED", getErrorMessage(error));
}

export function createOperationCancelledError(reason?: unknown): PeerError {
  return createPeerError("OPERATION_CANCELLED", "Operation was cancelled.", reason);
}

export function createStreamFailedError(error: unknown): PeerError {
  return isPeerError(error) ? error : createPeerError("STREAM_FAILED", getErrorMessage(error));
}

export function createPeerClosedError(): PeerError {
  return createPeerError("PEER_CLOSED", "Peer is closed.");
}

export function createHandlerNotFoundError(name: string): PeerError {
  return createPeerError("HANDLER_NOT_FOUND", `No handler registered for "${name}".`);
}
