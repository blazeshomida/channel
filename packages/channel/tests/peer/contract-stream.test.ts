import { expect, test } from "vite-plus/test";

import { createChannel, createContract, createPeer, stream } from "../../src";
import { createLinkedTransports, createSchema } from "./contract-helpers";

test("type-only stream operations work through the contract peer", async () => {
  const contract = createContract({
    operations: {
      count: stream<{ count: number }, number>(),
    },
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });
  const handler = createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });

  handler.handle({
    name: "count",
    async *handler({ count }) {
      for (let index = 0; index < count; index++) {
        yield index;
      }
    },
  });

  const values: number[] = [];

  for await (const value of caller.stream({
    name: "count",
    input: {
      count: 3,
    },
  })) {
    values.push(value);
  }

  expect(values).toEqual([0, 1, 2]);
});

test("schema-backed streams transform input at the handler and items at the caller", async () => {
  const input = createSchema<{ count: string }, { count: number }>((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("count" in value) ||
      typeof value.count !== "string"
    ) {
      return {
        issues: [{ message: "Expected a string count." }],
      };
    }

    return {
      value: {
        count: Number(value.count),
      },
    };
  });
  const item = createSchema<number, string>((value) => {
    return typeof value === "number"
      ? { value: String(value) }
      : { issues: [{ message: "Expected a number." }] };
  });
  const contract = createContract({
    operations: {
      count: stream({
        input,
        item,
      }),
    },
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });
  const handler = createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });

  handler.handle({
    name: "count",
    async *handler({ count }) {
      for (let index = 0; index < count; index++) {
        yield index;
      }
    },
  });

  const values: string[] = [];

  for await (const value of caller.stream({
    name: "count",
    input: {
      count: "3",
    },
  })) {
    values.push(value);
  }

  expect(values).toEqual(["0", "1", "2"]);
});

test("invalid stream input fails before the handler runs", async () => {
  const input = createSchema<number, number>((value) => {
    if (typeof value !== "number" || value < 0) {
      return {
        issues: [{ message: "Expected a positive count." }],
      };
    }

    return { value };
  });
  const item = createSchema<number, number>((value) => {
    return typeof value === "number" ? { value } : { issues: [{ message: "Expected a number." }] };
  });
  const contract = createContract({
    operations: {
      count: stream({
        input,
        item,
      }),
    },
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });
  const handler = createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });
  let handled = false;

  handler.handle({
    name: "count",
    async *handler() {
      handled = true;
      yield 1;
    },
  });

  const values = caller.stream({
    name: "count",
    input: -1,
  });

  await expect(values.next()).rejects.toMatchObject({
    code: "VALIDATION_FAILED",
    data: {
      operation: "count",
      direction: "input",
      issues: [{ message: "Expected a positive count." }],
    },
  });
  expect(handled).toBe(false);
});

test("invalid stream items fail the caller and cancel the producer", async () => {
  const input = createSchema<null, null>((value) => {
    return value === null ? { value } : { issues: [{ message: "Expected null." }] };
  });
  const item = createSchema<number, number>((value) => {
    if (typeof value !== "number" || value < 0) {
      return {
        issues: [{ message: "Expected a positive item." }],
      };
    }

    return { value };
  });
  const contract = createContract({
    operations: {
      values: stream({
        input,
        item,
      }),
    },
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });
  const handler = createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });
  let signal: AbortSignal | undefined;

  handler.handle({
    name: "values",
    async *handler(_input, context) {
      signal = context.signal;
      yield -1;
    },
  });

  const values = caller.stream({
    name: "values",
    input: null,
  });

  await expect(values.next()).rejects.toMatchObject({
    code: "VALIDATION_FAILED",
    data: {
      operation: "values",
      direction: "item",
      issues: [{ message: "Expected a positive item." }],
    },
  });
  expect(signal?.aborted).toBe(true);
});

test("closing a contract peer rejects pending stream pulls", async () => {
  const contract = createContract({
    operations: {
      values: stream<null, number>(),
    },
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });
  const handler = createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });
  let startedResolve: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    startedResolve = resolve;
  });

  handler.handle({
    name: "values",
    handler() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              startedResolve?.();

              return new Promise<IteratorResult<number>>(() => {});
            },
          };
        },
      };
    },
  });

  const values = caller.stream({
    name: "values",
    input: null,
  });
  const next = values.next();

  await started;
  caller.close();

  await expect(next).rejects.toMatchObject({
    code: "PEER_CLOSED",
  });
});
