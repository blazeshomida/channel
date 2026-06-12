import { expect, test } from "vite-plus/test";

import { createChannel, createContract, createPeer, event } from "../../src";
import { createLinkedTransports, createSchema } from "./contract-helpers";

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

test("type-only events work through the contract peer", () => {
  const contract = createContract({
    operations: {
      log: event<{ message: string }>(),
    },
  });
  const [senderTransport, listenerTransport] = createLinkedTransports<unknown>();
  const sender = createPeer({
    contract,
    channel: createChannel(senderTransport),
  });
  const receiver = createPeer({
    contract,
    channel: createChannel(listenerTransport),
  });
  const messages: string[] = [];

  receiver.on({
    name: "log",
    listener({ message }) {
      messages.push(message);
    },
  });

  sender.emit({
    name: "log",
    input: {
      message: "hello",
    },
  });

  expect(messages).toEqual(["hello"]);
});

test("schema-backed events validate once and deliver transformed input to every listener", async () => {
  let validations = 0;
  const input = createSchema<{ message: string }, { message: string }>((value) => {
    validations += 1;

    if (
      typeof value !== "object" ||
      value === null ||
      !("message" in value) ||
      typeof value.message !== "string"
    ) {
      return {
        issues: [{ message: "Expected a message." }],
      };
    }

    return {
      value: {
        message: value.message.toUpperCase(),
      },
    };
  });
  const contract = createContract({
    operations: {
      log: event({
        input,
      }),
    },
  });
  const [senderTransport, listenerTransport] = createLinkedTransports<unknown>();
  const sender = createPeer({
    contract,
    channel: createChannel(senderTransport),
  });
  const receiver = createPeer({
    contract,
    channel: createChannel(listenerTransport),
  });
  const messages: string[] = [];

  receiver.on({
    name: "log",
    listener({ message }) {
      messages.push(`first:${message}`);
    },
  });
  receiver.on({
    name: "log",
    listener({ message }) {
      messages.push(`second:${message}`);
    },
  });

  sender.emit({
    name: "log",
    input: {
      message: "hello",
    },
  });

  await flushAsyncWork();

  expect(validations).toBe(1);
  expect(messages).toEqual(["first:HELLO", "second:HELLO"]);
});

test("schema-backed events validate and deliver in arrival order", async () => {
  const validations: Array<(result: { value: number }) => void> = [];
  const input = createSchema<number, number>(() => {
    return new Promise((resolve) => {
      validations.push(resolve);
    });
  });
  const contract = createContract({
    operations: {
      progress: event({
        input,
      }),
    },
  });
  const [senderTransport, listenerTransport] = createLinkedTransports<unknown>();
  const sender = createPeer({
    contract,
    channel: createChannel(senderTransport),
  });
  const receiver = createPeer({
    contract,
    channel: createChannel(listenerTransport),
  });
  const values: number[] = [];

  receiver.on({
    name: "progress",
    listener(value) {
      values.push(value);
    },
  });

  sender.emit({ name: "progress", input: 1 });
  sender.emit({ name: "progress", input: 2 });

  await flushAsyncWork();
  expect(validations).toHaveLength(1);

  validations[0]?.({ value: 1 });
  await flushAsyncWork();
  expect(values).toEqual([1]);
  expect(validations).toHaveLength(2);

  validations[1]?.({ value: 2 });
  await flushAsyncWork();
  expect(values).toEqual([1, 2]);
});

test("invalid events skip listeners and report through root onError", async () => {
  const input = createSchema<{ message: string }, { message: string }>((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("message" in value) ||
      typeof value.message !== "string" ||
      value.message.length === 0
    ) {
      return {
        issues: [{ message: "Expected a non-empty message." }],
      };
    }

    return { value: { message: value.message } };
  });
  const contract = createContract({
    operations: {
      log: event({
        input,
      }),
    },
  });
  const [senderTransport, listenerTransport] = createLinkedTransports<unknown>();
  const sender = createPeer({
    contract,
    channel: createChannel(senderTransport),
  });
  const errors: unknown[] = [];
  const receiver = createPeer({
    contract,
    channel: createChannel(listenerTransport),
    onError(error) {
      errors.push(error);
    },
  });
  const messages: string[] = [];

  receiver.on({
    name: "log",
    listener({ message }) {
      messages.push(message);
    },
  });

  sender.emit({
    name: "log",
    input: {
      message: "",
    },
  });

  await flushAsyncWork();

  expect(messages).toEqual([]);
  expect(errors).toEqual([
    {
      code: "VALIDATION_FAILED",
      message: 'Validation failed for "log" input.',
      data: {
        operation: "log",
        direction: "input",
        issues: [{ message: "Expected a non-empty message." }],
      },
    },
  ]);
});

test("once waits for the first valid event", async () => {
  const input = createSchema<number, number>((value) => {
    return typeof value === "number" && value >= 0
      ? { value }
      : { issues: [{ message: "Expected a positive number." }] };
  });
  const contract = createContract({
    operations: {
      progress: event({
        input,
      }),
    },
  });
  const [senderTransport, listenerTransport] = createLinkedTransports<unknown>();
  const sender = createPeer({
    contract,
    channel: createChannel(senderTransport),
  });
  const receiver = createPeer({
    contract,
    channel: createChannel(listenerTransport),
  });
  const values: number[] = [];

  receiver.once({
    name: "progress",
    listener(value) {
      values.push(value);
    },
  });

  sender.emit({ name: "progress", input: -1 });
  sender.emit({ name: "progress", input: 1 });
  sender.emit({ name: "progress", input: 2 });

  await flushAsyncWork();

  expect(values).toEqual([1]);
});
