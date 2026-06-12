import { expect, test } from "vite-plus/test";

import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

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

test("calls handler onError before root onError for handler failures", async () => {
  const errors: string[] = [];

  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${getErrorMessage(error)}`);
    },
  });

  peer.handle({
    name: "task.fail",
    handler() {
      throw new Error("Handler failed.");
    },
    onError(error, context) {
      errors.push(`local:${context.type}:${getErrorMessage(error)}`);
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

test("throwing handler onError callbacks do not prevent error responses", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(_error, context) {
      errors.push(`root:${context.type}`);
      throw new Error("Root error handler failed.");
    },
  });

  peer.handle({
    name: "task.fail",
    handler() {
      throw new Error("Handler failed.");
    },
    onError(_error, context) {
      errors.push(`local:${context.type}`);
      throw new Error("Local error handler failed.");
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "task.fail",
    payload: null,
  });

  await Promise.resolve();

  expect(errors).toEqual(["local:handler", "root:handler"]);
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
