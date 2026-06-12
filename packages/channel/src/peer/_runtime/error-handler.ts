import type { PeerErrorContext, PeerErrorHandler } from "../types";

export function invokeErrorHandler(
  handler: PeerErrorHandler | undefined,
  error: unknown,
  context: PeerErrorContext,
): void {
  try {
    handler?.(error, context);
  } catch {
    // Error reporting must not interrupt protocol settlement.
  }
}
