import type { PeerMessage } from "../../src/peer/messages";

import { createChannel, type TransportListener, type Unsubscribe } from "../../src";
import { createProtocolRuntime } from "../../src/peer/_runtime/create-protocol-runtime";

export class TestPeerTransport {
  readonly listeners = new Set<TransportListener<PeerMessage>>();
  readonly sent: PeerMessage[] = [];

  closed = false;

  send(message: PeerMessage): void {
    this.sent.push(message);
  }

  subscribe(listener: TransportListener<PeerMessage>): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.closed = true;
  }

  emit(message: PeerMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

export function createTestPeer() {
  const transport = new TestPeerTransport();
  const channel = createChannel(transport);
  const peer = createProtocolRuntime({
    channel,
  });

  return {
    channel,
    peer,
    transport,
  };
}

export function createTestPeerWithOptions(
  options: Omit<Parameters<typeof createProtocolRuntime>[0], "channel">,
) {
  const transport = new TestPeerTransport();
  const channel = createChannel(transport);
  const peer = createProtocolRuntime({
    channel,
    ...options,
  });

  return {
    channel,
    peer,
    transport,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;

    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
}
