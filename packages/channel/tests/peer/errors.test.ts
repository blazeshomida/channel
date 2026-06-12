import { expect, test } from "vite-plus/test";

import { createChannel, createContract, createPeer, request, stream } from "../../src";
import { createLinkedTransports } from "./contract-helpers";
import { createTestPeerWithOptions } from "./helpers";

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

test("public peers report malformed inbound messages without throwing", () => {
  const contract = createContract({
    task: request<null, string>(),
  });
  const [senderTransport, receiverTransport] = createLinkedTransports<unknown>();
  const sender = createChannel(senderTransport);
  const errors: Array<{
    error: unknown;
    context: unknown;
  }> = [];

  createPeer({
    contract,
    channel: createChannel(receiverTransport),
    onError(error, context) {
      errors.push({ error, context });
    },
  });

  const messages: unknown[] = [
    null,
    "request",
    { type: "unknown" },
    { type: "request", id: 1, name: "task" },
  ];

  expect(() => {
    for (const message of messages) {
      sender.send(message);
    }
  }).not.toThrow();
  expect(errors).toEqual(
    messages.map((message) => ({
      error: {
        code: "INVALID_MESSAGE",
        message: "Invalid peer message.",
      },
      context: {
        type: "message",
        message,
      },
    })),
  );
});

test("malformed messages do not mutate request or handler lifecycle state", async () => {
  const contract = createContract({
    task: request<null, string>(),
    values: stream<null, number>(),
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const callerChannel = createChannel(callerTransport);
  const handlerChannel = createChannel(handlerTransport);
  const caller = createPeer({
    contract,
    channel: callerChannel,
  });
  const handler = createPeer({
    contract,
    channel: handlerChannel,
  });
  let handlerCalls = 0;
  let streamHandlerCalls = 0;

  handler.handle({
    name: "task",
    handler() {
      handlerCalls += 1;
      return "done";
    },
  });
  handler.handle({
    name: "values",
    handler() {
      streamHandlerCalls += 1;

      return {
        async *[Symbol.asyncIterator]() {
          yield 1;
        },
      };
    },
  });

  const response = caller.request({
    name: "task",
    input: null,
  });

  handlerChannel.send({
    type: "response",
    id: 1,
    ok: true,
  });
  callerChannel.send({
    type: "request",
    id: 2,
    name: "task",
  });
  callerChannel.send({
    type: "stream-request",
    id: 3,
    name: "values",
  });

  await expect(response).resolves.toBe("done");
  const values: number[] = [];

  for await (const value of caller.stream({
    name: "values",
    input: null,
  })) {
    values.push(value);
  }

  expect(handlerCalls).toBe(1);
  expect(streamHandlerCalls).toBe(1);
  expect(values).toEqual([1]);
});
