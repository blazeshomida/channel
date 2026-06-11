/// <reference lib="dom" />

import { expect, test } from "vite-plus/test";

import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

test("already-aborted request signal rejects and sends nothing", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();

  controller.abort("not needed");

  await expect(
    peer.request({
      name: "task.run",
      payload: null,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
    message: "Request was cancelled.",
    data: "not needed",
  });

  expect(transport.sent).toEqual([]);
});

test("aborting a pending request rejects and sends a cancel message", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();

  const promise = peer.request({
    name: "task.run",
    payload: null,
    signal: controller.signal,
  });

  controller.abort("not needed");

  await expect(promise).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
    message: "Request was cancelled.",
    data: "not needed",
  });

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "task.run",
      payload: null,
    },
    {
      type: "cancel",
      id: 1,
      reason: "not needed",
    },
  ]);
});

test("successful responses remove abort cleanup", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();

  const promise = peer.request<null, string>({
    name: "task.run",
    payload: null,
    signal: controller.signal,
  });

  transport.emit({
    type: "response",
    id: 1,
    ok: true,
    payload: "done",
  });

  await expect(promise).resolves.toBe("done");

  controller.abort("too late");

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "task.run",
      payload: null,
    },
  ]);
});

test("late responses after local cancellation are ignored", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const controller = new AbortController();

  const promise = peer.request({
    name: "task.run",
    payload: null,
    signal: controller.signal,
  });

  controller.abort("not needed");

  await expect(promise).rejects.toMatchObject({
    code: "REQUEST_CANCELLED",
  });

  transport.emit({
    type: "response",
    id: 1,
    ok: true,
    payload: "done",
  });

  expect(errors).toEqual([]);
});

test("cancelled request tracking is bounded", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  const cancellations: Array<Promise<void>> = [];

  for (let index = 0; index < 1_025; index += 1) {
    const controller = new AbortController();
    const promise = peer.request({
      name: "task.run",
      payload: index,
      signal: controller.signal,
    });

    controller.abort("not needed");

    cancellations.push(
      expect(promise).rejects.toMatchObject({
        code: "REQUEST_CANCELLED",
      }),
    );
  }

  await Promise.all(cancellations);

  transport.emit({
    type: "response",
    id: 1,
    ok: true,
    payload: "done",
  });

  transport.emit({
    type: "response",
    id: 1_025,
    ok: true,
    payload: "done",
  });

  expect(errors).toEqual(['response:No pending request for response "1".']);
});

test("unknown response ids still report errors", () => {
  const errors: string[] = [];
  const { transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });

  transport.emit({
    type: "response",
    id: 999,
    ok: true,
    payload: "done",
  });

  expect(errors).toEqual(['response:No pending request for response "999".']);
});

test("cancel messages abort handler context signals", async () => {
  const { peer, transport } = createTestPeer();
  let handlerSignal: AbortSignal | undefined;
  let resolveHandler: ((value: string) => void) | undefined;

  peer.handle({
    name: "task.run",
    handler(_payload, context) {
      handlerSignal = context.signal;

      return new Promise<string>((resolve) => {
        resolveHandler = resolve;
      });
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "task.run",
    payload: null,
  });

  expect(handlerSignal?.aborted).toBe(false);

  transport.emit({
    type: "cancel",
    id: 1,
    reason: "not needed",
  });

  expect(handlerSignal?.aborted).toBe(true);
  expect(handlerSignal?.reason).toBe("not needed");

  resolveHandler?.("done");
  await Promise.resolve();

  expect(transport.sent).toEqual([]);
});

test("handler rejections after cancellation do not report or respond", async () => {
  const errors: string[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push(`${context.type}:${getErrorMessage(error)}`);
    },
  });
  let rejectHandler: ((reason: unknown) => void) | undefined;

  peer.handle({
    name: "task.run",
    handler() {
      return new Promise<string>((_resolve, reject) => {
        rejectHandler = reject;
      });
    },
  });

  transport.emit({
    type: "request",
    id: 1,
    name: "task.run",
    payload: null,
  });

  transport.emit({
    type: "cancel",
    id: 1,
    reason: "not needed",
  });

  rejectHandler?.(new Error("Too late."));
  await Promise.resolve();

  expect(errors).toEqual([]);
  expect(transport.sent).toEqual([]);
});

test("closing a peer cleans pending request abort listeners", async () => {
  const { peer, transport } = createTestPeer();
  const controller = new AbortController();

  const promise = peer.request({
    name: "task.run",
    payload: null,
    signal: controller.signal,
  });

  peer.close();

  await expect(promise).rejects.toMatchObject({
    code: "PEER_CLOSED",
    message: "Peer is closed.",
  });

  controller.abort("too late");

  expect(transport.sent).toEqual([
    {
      type: "request",
      id: 1,
      name: "task.run",
      payload: null,
    },
  ]);
});
