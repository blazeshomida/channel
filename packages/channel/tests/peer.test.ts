import { expect, test } from "vite-plus/test";

import {
  createChannel,
  createPeer,
  type PeerMessage,
  type TransportListener,
  type Unsubscribe,
} from "../src";

class TestPeerTransport {
  readonly listeners = new Set<TransportListener<PeerMessage>>();
  readonly sent: PeerMessage[] = [];

  closed = false;

  send(message: PeerMessage) {
    this.sent.push(message);
  }

  subscribe(listener: TransportListener<PeerMessage>): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  close() {
    this.closed = true;
  }

  emit(message: PeerMessage) {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

function createTestPeer() {
  const transport = new TestPeerTransport();
  const channel = createChannel(transport);
  const peer = createPeer({
    channel,
  });

  return {
    channel,
    peer,
    transport,
  };
}

test("sends request messages with default numeric ids", () => {
  const { peer, transport } = createTestPeer();

  void peer.request({
    name: "math.add",
    payload: {
      a: 1,
      b: 2,
    },
  });

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "math.add",
      payload: {
        a: 1,
        b: 2,
      },
    },
  ]);
});

test("forwards send options through request messages", () => {
  interface SendOptions {
    transfer?: readonly ArrayBuffer[];
  }

  const transport = new TestPeerTransport();

  const channel = createChannel<PeerMessage, PeerMessage, SendOptions>(transport);
  const peer = createPeer({ channel });
  const buffer = new ArrayBuffer(8);

  void peer.request({
    name: "buffer.process",
    payload: { buffer },
    send: {
      transfer: [buffer],
    },
  });

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "buffer.process",
      payload: { buffer },
    },
  ]);
});

test("resolves successful responses", async () => {
  const { peer, transport } = createTestPeer();

  const promise = peer.request<{ a: number; b: number }, number>({
    name: "math.add",
    payload: {
      a: 1,
      b: 2,
    },
  });

  transport.emit({
    type: "response",
    id: 1,
    ok: true,
    payload: 3,
  });

  await expect(promise).resolves.toBe(3);
});

test("rejects error responses", async () => {
  const { peer, transport } = createTestPeer();

  const promise = peer.request<{ a: number; b: number }, number>({
    name: "math.add",
    payload: {
      a: 1,
      b: 2,
    },
  });

  transport.emit({
    type: "response",
    id: 1,
    ok: false,
    error: {
      code: "REQUEST_FAILED",
      message: "Math failed.",
    },
  });

  await expect(promise).rejects.toMatchObject({
    code: "REQUEST_FAILED",
    message: "Math failed.",
  });
});

test("sends method not found response for missing handlers", () => {
  const { transport } = createTestPeer();

  transport.emit({
    type: "request",
    id: 1,
    name: "missing",
    payload: null,
  });

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 1,
      ok: false,
      error: {
        code: "METHOD_NOT_FOUND",
        message: 'No handler registered for "missing".',
      },
    },
  ]);
});

test("handles requests and sends successful responses", async () => {
  const { peer, transport } = createTestPeer();

  peer.handle<{ a: number; b: number }, number>({
    name: "math.add",
    handler(payload) {
      return payload.a + payload.b;
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "math.add",
    payload: {
      a: 1,
      b: 2,
    },
  });

  await Promise.resolve();

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 1,
      ok: true,
      payload: 3,
    },
  ]);
});

test("supports async handlers", async () => {
  const { peer, transport } = createTestPeer();

  peer.handle<{ a: number; b: number }, number>({
    name: "math.add",
    async handler(payload) {
      return payload.a + payload.b;
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "math.add",
    payload: {
      a: 1,
      b: 2,
    },
  });

  await Promise.resolve();

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 1,
      ok: true,
      payload: 3,
    },
  ]);
});

test("normalizes handler errors into error responses", async () => {
  const { peer, transport } = createTestPeer();

  peer.handle({
    name: "math.add",
    handler() {
      throw new Error("Boom.");
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "math.add",
    payload: null,
  });

  await Promise.resolve();

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 1,
      ok: false,
      error: {
        code: "REQUEST_FAILED",
        message: "Boom.",
      },
    },
  ]);
});

test("rejects duplicate handlers", () => {
  const { peer } = createTestPeer();

  peer.handle({
    name: "math.add",
    handler() {
      return 1;
    },
  });

  expect(() => {
    peer.handle({
      name: "math.add",
      handler() {
        return 2;
      },
    });
  }).toThrow('Handler already registered for "math.add".');
});

test("reports whether a handler exists", () => {
  const { peer } = createTestPeer();

  expect(peer.hasHandler("math.add")).toBe(false);

  const dispose = peer.handle({
    name: "math.add",
    handler() {
      return 1;
    },
  });

  expect(peer.hasHandler("math.add")).toBe(true);

  dispose();

  expect(peer.hasHandler("math.add")).toBe(false);
});

test("handler dispose functions are idempotent", () => {
  const { peer } = createTestPeer();

  const dispose = peer.handle({
    name: "math.add",
    handler() {
      return 1;
    },
  });

  dispose();
  dispose();

  expect(peer.hasHandler("math.add")).toBe(false);
});

test("runs handlers concurrently", async () => {
  const { peer, transport } = createTestPeer();

  const resolvers: Array<(value: string) => void> = [];

  peer.handle({
    name: "task",
    handler() {
      return new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "task",
    payload: null,
  });

  transport.emit({
    type: "request",
    id: 2,
    name: "task",
    payload: null,
  });

  expect(resolvers).toHaveLength(2);

  resolvers[1]?.("second");
  await Promise.resolve();

  resolvers[0]?.("first");
  await Promise.resolve();

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 2,
      ok: true,
      payload: "second",
    },
    {
      type: "response",
      id: 1,
      ok: true,
      payload: "first",
    },
  ]);
});

test("rejects pending requests when closed", async () => {
  const { peer, transport } = createTestPeer();

  const promise = peer.request({
    name: "math.add",
    payload: null,
  });

  peer.close();

  await expect(promise).rejects.toMatchObject({
    code: "PEER_CLOSED",
    message: "Peer is closed.",
  });

  expect(transport.closed).toBe(true);
});

test("prevents new requests after close", async () => {
  const { peer } = createTestPeer();

  peer.close();

  await expect(
    peer.request({
      name: "math.add",
      payload: null,
    }),
  ).rejects.toMatchObject({
    code: "PEER_CLOSED",
    message: "Peer is closed.",
  });
});

test("prevents new handlers after close", () => {
  const { peer } = createTestPeer();

  peer.close();

  expect(() => {
    peer.handle({
      name: "math.add",
      handler() {
        return 1;
      },
    });
  }).toThrow("Peer is closed.");
});

test("close is idempotent", () => {
  const { peer, transport } = createTestPeer();

  peer.close();
  peer.close();

  expect(transport.closed).toBe(true);
});
