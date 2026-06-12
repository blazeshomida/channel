import type { PeerMessage } from "../../src/peer/messages";

import { expect, test } from "vite-plus/test";

import { createChannel, type TransportListener } from "../../src";
import { createProtocolRuntime } from "../../src/peer/_runtime/create-protocol-runtime";
import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("starts streams lazily and pulls one item at a time", async () => {
  const { peer, transport } = createTestPeer();
  const stream = peer.stream<{ count: number }, number>({
    name: "numbers",
    payload: {
      count: 1,
    },
  });

  expect(transport.sent).toEqual([]);

  const first = stream.next();

  expect(transport.sent).toEqual([
    {
      type: "stream-request",
      id: 1,
      name: "numbers",
      payload: {
        count: 1,
      },
    },
    {
      type: "stream-pull",
      id: 1,
    },
  ]);

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: 1,
  });

  await expect(first).resolves.toEqual({
    done: false,
    value: 1,
  });

  const end = stream.next();

  expect(transport.sent.at(-1)).toEqual({
    type: "stream-pull",
    id: 1,
  });

  transport.emit({
    type: "stream-end",
    id: 1,
  });

  await expect(end).resolves.toEqual({
    done: true,
    value: undefined,
  });
});

test("serializes concurrent next calls for pull-based backpressure", async () => {
  const { peer, transport } = createTestPeer();
  const stream = peer.stream<null, string>({
    name: "letters",
    payload: null,
  });

  const first = stream.next();
  const second = stream.next();

  expect(transport.sent).toEqual([
    {
      type: "stream-request",
      id: 1,
      name: "letters",
      payload: null,
    },
    {
      type: "stream-pull",
      id: 1,
    },
  ]);

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: "a",
  });

  await expect(first).resolves.toEqual({
    done: false,
    value: "a",
  });
  await flushAsyncWork();

  expect(transport.sent.at(-1)).toEqual({
    type: "stream-pull",
    id: 1,
  });

  transport.emit({
    type: "stream-item",
    id: 1,
    payload: "b",
  });

  await expect(second).resolves.toEqual({
    done: false,
    value: "b",
  });
});

test("remote stream errors reject the pending pull", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`root:${context.type}:${getErrorMessage(error)}`);
    },
  });
  const stream = peer.stream({
    name: "broken",
    payload: null,
    onError(error, context) {
      errors.push(`local:${context.type}:${getErrorMessage(error)}`);
    },
  });
  const next = stream.next();

  transport.emit({
    type: "stream-error",
    id: 1,
    error: {
      code: "STREAM_FAILED",
      message: "Remote stream failed.",
    },
  });

  await expect(next).rejects.toMatchObject({
    code: "STREAM_FAILED",
    message: "Remote stream failed.",
  });
  expect(errors).toEqual([
    "local:stream:Remote stream failed.",
    "root:stream:Remote stream failed.",
  ]);
});

test("handles stream errors delivered synchronously during the initial send", async () => {
  const sent: PeerMessage[] = [];
  let listener: TransportListener<PeerMessage> | undefined;

  const channel = createChannel<PeerMessage>({
    send(message) {
      sent.push(message);

      if (message.type === "stream-request") {
        listener?.({
          type: "stream-error",
          id: message.id,
          error: {
            code: "STREAM_FAILED",
            message: "Immediate failure.",
          },
        });
      }
    },
    subscribe(nextListener) {
      listener = nextListener;

      return () => {
        listener = undefined;
      };
    },
  });
  const peer = createProtocolRuntime({ channel });
  const stream = peer.stream({
    name: "broken",
    payload: null,
  });

  await expect(stream.next()).rejects.toMatchObject({
    code: "STREAM_FAILED",
    message: "Immediate failure.",
  });
  expect(sent).toEqual([
    {
      type: "stream-request",
      id: 1,
      name: "broken",
      payload: null,
    },
  ]);
});

test("unknown stream message ids report through root onError", () => {
  const errors: string[] = [];
  const { transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });

  transport.emit({
    type: "stream-item",
    id: 999,
    payload: 1,
  });

  expect(errors).toEqual(['stream-message:No pending stream for message "999".']);
});
