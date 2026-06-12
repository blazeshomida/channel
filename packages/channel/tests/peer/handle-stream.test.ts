import { expect, test } from "vite-plus/test";

import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("stream handlers produce items only when pulled", async () => {
  const { peer, transport } = createTestPeer();

  peer.handleStream<{ count: number }, number>({
    name: "numbers",
    async *handler(payload) {
      for (let value = 1; value <= payload.count; value += 1) {
        yield value;
      }
    },
  });

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "numbers",
    payload: {
      count: 1,
    },
  });

  await flushAsyncWork();
  expect(transport.sent).toEqual([]);

  transport.emit({
    type: "stream-pull",
    id: 1,
  });

  await flushAsyncWork();
  expect(transport.sent).toEqual([
    {
      type: "stream-item",
      id: 1,
      payload: 1,
    },
  ]);

  transport.emit({
    type: "stream-pull",
    id: 1,
  });

  await flushAsyncWork();
  expect(transport.sent.at(-1)).toEqual({
    type: "stream-end",
    id: 1,
  });
});

test("missing stream handlers send method not found errors", () => {
  const { transport } = createTestPeer();

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "missing",
    payload: null,
  });

  expect(transport.sent).toEqual([
    {
      type: "stream-error",
      id: 1,
      error: {
        code: "METHOD_NOT_FOUND",
        message: 'No handler registered for "missing".',
      },
    },
  ]);
});

test("stream handler failures report and send stream errors", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${getErrorMessage(error)}`);
    },
  });

  peer.handleStream({
    name: "broken",
    handler() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(new Error("Stream failed."));
            },
          };
        },
      };
    },
    onError(error, context) {
      errors.push(`local:${context.type}:${getErrorMessage(error)}`);
    },
  });

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "broken",
    payload: null,
  });

  transport.emit({
    type: "stream-pull",
    id: 1,
  });

  await flushAsyncWork();

  expect(errors).toEqual([
    "local:stream-handler:Stream failed.",
    "root:stream-handler:Stream failed.",
  ]);
  expect(transport.sent).toEqual([
    {
      type: "stream-error",
      id: 1,
      error: {
        code: "STREAM_FAILED",
        message: "Stream failed.",
      },
    },
  ]);
});

test("throwing stream onError callbacks do not prevent stream errors", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(_error, context) {
      errors.push(`root:${context.type}`);
      throw new Error("Root error handler failed.");
    },
  });

  peer.handleStream({
    name: "broken",
    handler() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(new Error("Stream failed."));
            },
          };
        },
      };
    },
    onError(_error, context) {
      errors.push(`local:${context.type}`);
      throw new Error("Local error handler failed.");
    },
  });

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "broken",
    payload: null,
  });
  transport.emit({
    type: "stream-pull",
    id: 1,
  });

  await flushAsyncWork();

  expect(errors).toEqual(["local:stream-handler", "root:stream-handler"]);
  expect(transport.sent).toEqual([
    {
      type: "stream-error",
      id: 1,
      error: {
        code: "STREAM_FAILED",
        message: "Stream failed.",
      },
    },
  ]);
});

test("rejects duplicate stream handlers", () => {
  const { peer } = createTestPeer();

  peer.handleStream({
    name: "numbers",
    handler() {
      return {
        async *[Symbol.asyncIterator]() {
          yield 1;
        },
      };
    },
  });

  expect(() => {
    peer.handleStream({
      name: "numbers",
      handler() {
        return {
          async *[Symbol.asyncIterator]() {
            yield 2;
          },
        };
      },
    });
  }).toThrow('Stream handler already registered for "numbers".');
});

test("reports and disposes registered stream handlers", () => {
  const { peer } = createTestPeer();

  expect(peer.hasStreamHandler("numbers")).toBe(false);

  const dispose = peer.handleStream({
    name: "numbers",
    handler() {
      return {
        async *[Symbol.asyncIterator]() {
          yield 1;
        },
      };
    },
  });

  expect(peer.hasStreamHandler("numbers")).toBe(true);

  dispose();
  dispose();

  expect(peer.hasStreamHandler("numbers")).toBe(false);
});

test("prevents new stream handlers after close", () => {
  const { peer } = createTestPeer();

  peer.close();

  expect(() => {
    peer.handleStream({
      name: "numbers",
      handler() {
        return {
          async *[Symbol.asyncIterator]() {
            yield 1;
          },
        };
      },
    });
  }).toThrow("Peer is closed.");
});
