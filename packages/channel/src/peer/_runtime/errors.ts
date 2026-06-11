import type { PeerErrorCode, PeerErrorPayload } from "../types";

export function createPeerError(
  code: PeerErrorCode,
  message: string,
  data?: unknown,
): PeerErrorPayload {
  return data === undefined ? { code, message } : { code, message, data };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPeerErrorPayload(error: unknown): error is PeerErrorPayload {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export function createRequestFailedError(error: unknown): PeerErrorPayload {
  return isPeerErrorPayload(error)
    ? error
    : createPeerError("REQUEST_FAILED", getErrorMessage(error));
}

export function createRequestCancelledError(reason?: unknown): PeerErrorPayload {
  return createPeerError("REQUEST_CANCELLED", "Request was cancelled.", reason);
}

export function createStreamFailedError(error: unknown): PeerErrorPayload {
  return isPeerErrorPayload(error)
    ? error
    : createPeerError("STREAM_FAILED", getErrorMessage(error));
}

export function createPeerClosedError(): PeerErrorPayload {
  return createPeerError("PEER_CLOSED", "Peer is closed.");
}

export function createMethodNotFoundError(name: string): PeerErrorPayload {
  return createPeerError("METHOD_NOT_FOUND", `No handler registered for "${name}".`);
}
