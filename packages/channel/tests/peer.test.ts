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

function createTestPeerWithOptions(options: Omit<Parameters<typeof createPeer>[0], "channel">) {
  const transport = new TestPeerTransport();
  const channel = createChannel(transport);
  const peer = createPeer({
    channel,
    ...options,
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

test("sends notification messages", () => {
  const { peer, transport } = createTestPeer();

  peer.notify({
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(transport.sent).toEqual([
    {
      type: "notification",
      name: "log.info",
      payload: {
        message: "hello",
      },
    },
  ]);
});

test("calls notification listeners", () => {
  const { peer, transport } = createTestPeer();
  const received: string[] = [];

  peer.on<{ message: string }>({
    name: "log.info",
    listener(payload, context) {
      received.push(`${context.name}: ${payload.message}`);
    },
  });

  transport.emit({
    type: "notification",
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(received).toEqual(["log.info: hello"]);
});

test("supports multiple notification listeners", () => {
  const { peer, transport } = createTestPeer();
  const received: string[] = [];

  peer.on<{ message: string }>({
    name: "log.info",
    listener(payload) {
      received.push(`first: ${payload.message}`);
    },
  });

  peer.on<{ message: string }>({
    name: "log.info",
    listener(payload) {
      received.push(`second: ${payload.message}`);
    },
  });

  transport.emit({
    type: "notification",
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(received).toEqual(["first: hello", "second: hello"]);
});

test("supports once notification listeners", () => {
  const { peer, transport } = createTestPeer();
  const received: string[] = [];

  peer.once<{ message: string }>({
    name: "ready",
    listener(payload) {
      received.push(payload.message);
    },
  });

  transport.emit({
    type: "notification",
    name: "ready",
    payload: {
      message: "first",
    },
  });

  transport.emit({
    type: "notification",
    name: "ready",
    payload: {
      message: "second",
    },
  });

  expect(received).toEqual(["first"]);
});

test("listener dispose functions are idempotent", () => {
  const { peer, transport } = createTestPeer();
  const received: string[] = [];

  const dispose = peer.on<{ message: string }>({
    name: "log.info",
    listener(payload) {
      received.push(payload.message);
    },
  });

  dispose();
  dispose();

  transport.emit({
    type: "notification",
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(received).toEqual([]);
});

test("calls listener onError before root onError", () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${String(error)}`);
    },
  });

  peer.on({
    name: "log.info",
    listener() {
      throw new Error("Listener failed.");
    },
    onError(error, context) {
      errors.push(`local:${context.type}:${(error as Error).message}`);
    },
  });

  transport.emit({
    type: "notification",
    name: "log.info",
    payload: null,
  });

  expect(errors).toEqual([
    "local:notification:Listener failed.",
    "root:notification:Error: Listener failed.",
  ]);
});

test("routes unknown response ids to root onError", () => {
  const errors: Array<{
    error: unknown;
    context: unknown;
  }> = [];

  const { transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push({ error, context });
    },
  });

  transport.emit({
    type: "response",
    id: 999,
    ok: true,
    payload: "late",
  });

  expect(errors).toEqual([
    {
      error: {
        code: "REQUEST_FAILED",
        message: 'No pending request for response "999".',
      },
      context: {
        type: "response",
        id: 999,
      },
    },
  ]);
});

test("calls request onError before root onError for error responses", async () => {
  const errors: string[] = [];

  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${(error as { message: string }).message}`);
    },
  });

  const promise = peer.request<null, string>({
    name: "task.fail",
    payload: null,
    onError(error, context) {
      errors.push(`local:${context.type}:${(error as { message: string }).message}`);
    },
  });

  transport.emit({
    type: "response",
    id: 1,
    ok: false,
    error: {
      code: "REQUEST_FAILED",
      message: "Remote failed.",
    },
  });

  await expect(promise).rejects.toMatchObject({
    code: "REQUEST_FAILED",
    message: "Remote failed.",
  });

  expect(errors).toEqual(["local:request:Remote failed.", "root:request:Remote failed."]);
});

test("calls handler onError before root onError for handler failures", async () => {
  const errors: string[] = [];

  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${(error as { message: string }).message}`);
    },
  });

  peer.handle({
    name: "task.fail",
    handler() {
      throw new Error("Handler failed.");
    },
    onError(error, context) {
      errors.push(`local:${context.type}:${(error as { message: string }).message}`);
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "task.fail",
    payload: null,
  });

  await Promise.resolve();

  expect(errors).toEqual(["local:handler:Handler failed.", "root:handler:Handler failed."]);

  expect(transport.sent).toEqual([
    {
      type: "response",
      id: 1,
      ok: false,
      error: {
        code: "REQUEST_FAILED",
        message: "Handler failed.",
      },
    },
  ]);
});
