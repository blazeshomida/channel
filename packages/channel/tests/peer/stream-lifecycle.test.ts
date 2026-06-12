/// <reference lib="dom" />

import type { PeerMessage } from "../../src/peer/messages";

import { expect, test } from "vite-plus/test";

import { createChannel, type TransportListener } from "../../src";
import { createProtocolRuntime } from "../../src/peer/_runtime/create-protocol-runtime";
import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("already-aborted stream signals reject without sending messages", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();

  controller.abort("not needed");

  const stream = peer.stream({
    name: "numbers",
    payload: null,
    signal: controller.signal,
  });

  await expect(stream.next()).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
    message: "Request was cancelled.",
    data: "not needed",
  });

  expect(transport.sent).toEqual([]);
});

test("failed stream request sends roll back consumer state", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const controller = new AbortController();
  const sendError = new Error("Stream request send failed.");

  transport.sendError = sendError;
  transport.sendErrorType = "stream-request";

  const stream = peer.stream({
    name: "numbers",
    payload: null,
    signal: controller.signal,
  });

  await expect(stream.next()).rejects.toBe(sendError);

  controller.abort("too late");

  expect(transport.sent).toEqual([]);

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: 1,
  });

  expect(errors).toEqual(['stream-message:No pending stream for message "1".']);
});

test("failed first stream pulls roll back state without affecting later streams", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const controller = new AbortController();
  const sendError = new Error("Stream pull send failed.");

  transport.sendError = sendError;
  transport.sendErrorType = "stream-pull";

  const failedStream = peer.stream({
    name: "numbers",
    payload: null,
    signal: controller.signal,
  });

  await expect(failedStream.next()).rejects.toBe(sendError);

  controller.abort("too late");

  expect(transport.sent).toEqual([
    {
      type: "stream-request",
      id: 1,
      name: "numbers",
      payload: null,
    },
    {
      type: "cancel",
      id: 1,
    },
  ]);

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: 1,
  });

  expect(errors).toEqual(['stream-message:No pending stream for message "1".']);

  const nextStream = peer.stream<null, number>({
    name: "numbers",
    payload: null,
  });
  const next = nextStream.next();

  transport.emit({
    type: "stream-item",
    id: 2,
    payload: 2,
  });

  await expect(next).resolves.toEqual({
    done: false,
    value: 2,
  });
});

test("failed first stream pulls cancel the remote producer", async () => {
  let consumerListener: TransportListener<PeerMessage> | undefined;
  let producerListener: TransportListener<PeerMessage> | undefined;
  const sendError = new Error("Stream pull send failed.");
  let producerSignal: AbortSignal | undefined;
  let producerReturned = false;

  const consumer = createProtocolRuntime({
    channel: createChannel<PeerMessage>({
      send(message) {
        if (message.type === "stream-pull") {
          throw sendError;
        }

        producerListener?.(message);
      },
      subscribe(listener) {
        consumerListener = listener;

        return () => {
          consumerListener = undefined;
        };
      },
    }),
  });
  const producer = createProtocolRuntime({
    channel: createChannel<PeerMessage>({
      send(message) {
        consumerListener?.(message);
      },
      subscribe(listener) {
        producerListener = listener;

        return () => {
          producerListener = undefined;
        };
      },
    }),
  });

  producer.handleStream({
    name: "numbers",
    handler(_payload, context) {
      producerSignal = context.signal;

      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return new Promise<IteratorResult<number>>(() => {});
            },
            return() {
              producerReturned = true;

              return Promise.resolve({
                done: true,
                value: undefined,
              });
            },
          };
        },
      };
    },
  });

  const stream = consumer.stream({
    name: "numbers",
    payload: null,
  });

  await expect(stream.next()).rejects.toBe(sendError);
  await flushAsyncWork();

  expect(producerSignal?.aborted).toBe(true);
  expect(producerReturned).toBe(true);
});

test("return cancels an active stream and closes the iterator", async () => {
  const { peer, transport } = createTestPeer();
  const stream = peer.stream<null, string>({
    name: "letters",
    payload: null,
  });

  const first = stream.next();

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: "a",
  });

  await expect(first).resolves.toEqual({
    done: false,
    value: "a",
  });

  await expect(stream.return()).resolves.toEqual({
    done: true,
    value: undefined,
  });

  expect(transport.sent.at(-1)).toEqual({
    type: "cancel",
    id: 1,
  });

  await expect(stream.next()).resolves.toEqual({
    done: true,
    value: undefined,
  });
});

test("stream signal abort rejects pending pulls and ignores late items", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const controller = new AbortController();
  const stream = peer.stream({
    name: "numbers",
    payload: null,
    signal: controller.signal,
  });
  const next = stream.next();

  controller.abort("not needed");

  await expect(next).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
    data: "not needed",
  });

  expect(transport.sent.at(-1)).toEqual({
    type: "cancel",
    id: 1,
    reason: "not needed",
  });

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: 1,
  });

  expect(errors).toEqual([]);
});

test("late messages remain ignored after cancelled stream tracking is bounded", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const cancellations: Array<Promise<void>> = [];

  for (let index = 0; index < 1_027; index += 1) {
    const stream = peer.stream({
      name: "numbers",
      payload: index,
    });
    const next = stream.next();

    void stream.return();
    cancellations.push(
      expect(next).resolves.toEqual({
        done: true,
        value: undefined,
      }),
    );
  }

  await Promise.all(cancellations);

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: 1,
  });

  transport.emit({
    type: "stream-end",
    id: 2,
  });

  transport.emit({
    type: "stream-error",
    id: 3,
    error: {
      code: "STREAM_FAILED",
      message: "Too late.",
    },
  });

  transport.emit({
    type: "stream-item",
    id: 1_028,
    payload: 1,
  });

  expect(errors).toEqual(['stream-message:No pending stream for message "1028".']);
});

test("request and stream ids share one sequence", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();
  const request = peer.request({
    name: "task.run",
    payload: null,
    signal: controller.signal,
  });
  const stream = peer.stream({
    name: "numbers",
    payload: null,
  });
  const next = stream.next();

  controller.abort("not needed");
  void stream.return();

  await expect(request).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
  });
  await expect(next).resolves.toEqual({
    done: true,
    value: undefined,
  });

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "task.run",
      payload: null,
    },
    {
      type: "stream-request",
      id: 2,
      name: "numbers",
      payload: null,
    },
    {
      type: "stream-pull",
      id: 2,
    },
    {
      type: "cancel",
      id: 1,
      reason: "not needed",
    },
    {
      type: "cancel",
      id: 2,
    },
  ]);
});

test("cancel messages abort stream handlers and close their iterators", async () => {
  const { peer, transport } = createTestPeer();
  let handlerSignal: AbortSignal | undefined;
  let returned = false;

  peer.handleStream({
    name: "numbers",
    handler(_payload, context) {
      handlerSignal = context.signal;

      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return new Promise<IteratorResult<number>>(() => {});
            },
            async return() {
              returned = true;

              return {
                done: true,
                value: undefined,
              };
            },
          };
        },
      };
    },
  });

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "numbers",
    payload: null,
  });

  transport.emit({
    type: "stream-pull",
    id: 1,
  });

  transport.emit({
    type: "cancel",
    id: 1,
    reason: "not needed",
  });

  await flushAsyncWork();

  expect(handlerSignal?.aborted).toBe(true);
  expect(handlerSignal?.reason).toBe("not needed");
  expect(returned).toBe(true);
  expect(transport.sent).toEqual([]);
});

test("cancel suppresses iterator cleanup failures", () => {
  const { peer, transport } = createTestPeer();

  peer.handleStream({
    name: "numbers",
    handler() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return new Promise<IteratorResult<number>>(() => {});
            },
            return() {
              throw new Error("Cleanup failed.");
            },
          };
        },
      };
    },
  });

  transport.emit({
    type: "stream-request",
    id: 1,
    name: "numbers",
    payload: null,
  });

  expect(() => {
    transport.emit({
      type: "cancel",
      id: 1,
    });
  }).not.toThrow();
});

test("closing peers rejects pending streams and aborts active stream handlers", async () => {
  const { peer, transport } = createTestPeer();
  let handlerSignal: AbortSignal | undefined;
  let returned = false;

  peer.handleStream({
    name: "producer",
    handler(_payload, context) {
      handlerSignal = context.signal;

      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return new Promise<IteratorResult<number>>(() => {});
            },
            async return() {
              returned = true;

              return {
                done: true,
                value: undefined,
              };
            },
          };
        },
      };
    },
  });

  transport.emit({
    type: "stream-request",
    id: 10,
    name: "producer",
    payload: null,
  });

  const stream = peer.stream({
    name: "consumer",
    payload: null,
  });
  const next = stream.next();

  peer.close();

  await expect(next).rejects.toMatchObject({
    code: "PEER_CLOSED",
    message: "Peer is closed.",
  });
  expect(handlerSignal?.aborted).toBe(true);
  expect(returned).toBe(true);
  expect(transport.closed).toBe(true);
});
