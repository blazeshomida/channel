import { expect, test } from "vite-plus/test";

import { createChannel, createPeer, type PeerMessage } from "../../src";
import { TestPeerTransport, createTestPeer, createTestPeerWithOptions } from "./helpers";

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
