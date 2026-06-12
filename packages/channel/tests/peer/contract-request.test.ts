import { expect, test } from "vite-plus/test";

import { createChannel, createContract, createPeer, request } from "../../src";
import { createLinkedTransports, createSchema } from "./contract-helpers";

test("type-only request operations work through the contract peer", async () => {
  const contract = createContract({
    double: request<{ value: number }, number>(),
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
    name: "double",
    handler({ value }) {
      return value * 2;
    },
  });

  await expect(
    caller.request({
      name: "double",
      input: {
        value: 21,
      },
    }),
  ).resolves.toBe(42);
});

test("schema-backed requests transform input at the handler and output at the caller", async () => {
  let inputValidations = 0;
  const input = createSchema<{ value: string }, { value: number }>(async (value) => {
    inputValidations += 1;

    if (
      typeof value !== "object" ||
      value === null ||
      !("value" in value) ||
      typeof value.value !== "string"
    ) {
      return {
        issues: [{ message: "Expected a string value." }],
      };
    }

    return {
      value: {
        value: Number(value.value),
      },
    };
  });
  const output = createSchema<number, string>(async (value) => {
    if (typeof value !== "number") {
      return {
        issues: [{ message: "Expected a number." }],
      };
    }

    return {
      value: String(value),
    };
  });
  const contract = createContract({
    double: request({
      input,
      output,
    }),
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
    name: "double",
    handler({ value }) {
      return value * 2;
    },
  });

  await expect(
    caller.request({
      name: "double",
      input: {
        value: "21",
      },
    }),
  ).resolves.toBe("42");
  expect(inputValidations).toBe(1);
});

test("invalid request input rejects before the handler runs", async () => {
  const input = createSchema<{ value: number }, { value: number }>((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("value" in value) ||
      typeof value.value !== "number" ||
      value.value < 0
    ) {
      return {
        issues: [{ message: "Expected a positive value." }],
      };
    }

    return {
      value: {
        value: value.value,
      },
    };
  });
  const output = createSchema<number, number>((value) => {
    return typeof value === "number" ? { value } : { issues: [{ message: "Expected a number." }] };
  });
  const contract = createContract({
    double: request({
      input,
      output,
    }),
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
    name: "double",
    handler({ value }) {
      handled = true;
      return value * 2;
    },
  });

  await expect(
    caller.request({
      name: "double",
      input: {
        value: -1,
      },
    }),
  ).rejects.toMatchObject({
    code: "VALIDATION_FAILED",
    data: {
      operation: "double",
      boundary: "input",
      issues: [{ message: "Expected a positive value." }],
    },
  });
  expect(handled).toBe(false);
});

test("invalid request output rejects at the caller", async () => {
  const input = createSchema<number, number>((value) => {
    return typeof value === "number" ? { value } : { issues: [{ message: "Expected a number." }] };
  });
  const output = createSchema<number, number>((value) => {
    if (typeof value !== "number" || value < 0) {
      return {
        issues: [{ message: "Expected a positive result." }],
      };
    }

    return { value };
  });
  const contract = createContract({
    calculate: request({
      input,
      output,
    }),
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
    name: "calculate",
    handler() {
      return -1;
    },
  });

  await expect(
    caller.request({
      name: "calculate",
      input: 1,
    }),
  ).rejects.toMatchObject({
    code: "VALIDATION_FAILED",
    data: {
      operation: "calculate",
      boundary: "output",
      issues: [{ message: "Expected a positive result." }],
    },
  });
});

test("missing request handlers reject through the contract peer", async () => {
  const contract = createContract({
    missing: request<null, null>(),
  });
  const [callerTransport, handlerTransport] = createLinkedTransports<unknown>();
  const caller = createPeer({
    contract,
    channel: createChannel(callerTransport),
  });

  createPeer({
    contract,
    channel: createChannel(handlerTransport),
  });

  await expect(
    caller.request({
      name: "missing",
      input: null,
    }),
  ).rejects.toMatchObject({
    code: "HANDLER_NOT_FOUND",
  });
});

test("disposed request handlers can be registered again", async () => {
  const contract = createContract({
    value: request<null, number>(),
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
  const dispose = handler.handle({
    name: "value",
    handler() {
      return 1;
    },
  });

  expect(() => {
    handler.handle({
      name: "value",
      handler() {
        return 2;
      },
    });
  }).toThrow('Handler already registered for "value".');

  dispose();

  handler.handle({
    name: "value",
    handler() {
      return 2;
    },
  });

  await expect(
    caller.request({
      name: "value",
      input: null,
    }),
  ).resolves.toBe(2);
});

test("request cancellation still aborts contract handlers", async () => {
  const contract = createContract({
    wait: request<null, never>(),
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
  const controller = new AbortController();
  let startedResolve: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    startedResolve = resolve;
  });
  let handlerSignal: AbortSignal | undefined;

  handler.handle({
    name: "wait",
    handler(_input, context) {
      handlerSignal = context.signal;
      startedResolve?.();

      return new Promise<never>(() => {});
    },
  });

  const result = caller.request({
    name: "wait",
    input: null,
    signal: controller.signal,
  });

  await started;
  controller.abort("not needed");

  await expect(result).rejects.toMatchObject({
    code: "OPERATION_CANCELLED",
    data: "not needed",
  });
  expect(handlerSignal?.aborted).toBe(true);
});

test("closing a contract peer rejects pending requests", async () => {
  const contract = createContract({
    wait: request<null, never>(),
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
    name: "wait",
    handler() {
      startedResolve?.();

      return new Promise<never>(() => {});
    },
  });

  const result = caller.request({
    name: "wait",
    input: null,
  });

  await started;
  caller.close();

  await expect(result).rejects.toMatchObject({
    code: "PEER_CLOSED",
  });
});
