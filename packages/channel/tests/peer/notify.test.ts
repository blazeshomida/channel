import { expect, test } from "vite-plus/test";

import { createTestPeer, createTestPeerWithOptions, getErrorMessage } from "./helpers";

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
      errors.push(`local:${context.type}:${getErrorMessage(error)}`);
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
