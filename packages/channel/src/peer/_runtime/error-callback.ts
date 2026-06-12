import type { PeerErrorCallback, PeerErrorContext } from "../types";

export function invokeErrorCallback(
  callback: PeerErrorCallback | undefined,
  error: unknown,
  context: PeerErrorContext,
): void {
  try {
    callback?.(error, context);
  } catch {
    // Error reporting must not interrupt protocol settlement.
  }
}
