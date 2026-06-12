import { expect, test } from "vite-plus/test";

import { createChannel, createContract, createPeer, event, request, stream } from "../../src";
import { createSchema } from "./contract-helpers";

function assertContractTypes(): void {
  const requestInput = createSchema<{ value: string }, { value: number }>((value) => {
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
  const requestOutput = createSchema<number, string>((value) => {
    return typeof value === "number"
      ? { value: String(value) }
      : { issues: [{ message: "Expected a number." }] };
  });
  const contract = createContract({
    double: request({
      input: requestInput,
      output: requestOutput,
    }),
    count: stream<{ count: number }, number>(),
    log: event<{ message: string }>(),
  });
  const peer = createPeer({
    contract,
    channel: createChannel({
      send() {},
      subscribe() {
        return () => {};
      },
    }),
  });

  const response: Promise<string> = peer.request({
    name: "double",
    input: {
      value: "21",
    },
  });

  peer.handle({
    name: "double",
    handler({ value }) {
      const input: number = value;
      return input * 2;
    },
  });

  peer.handle({
    name: "count",
    async *handler({ count }) {
      yield count;
    },
  });

  peer.on({
    name: "log",
    listener({ message }) {
      const input: string = message;
      expect(input).toBeTypeOf("string");
    },
  });

  // @ts-expect-error Events cannot be requested.
  void peer.request({ name: "log", input: { message: "hello" } });

  // @ts-expect-error Requests cannot be streamed.
  peer.stream({ name: "double", input: { value: "21" } });

  // @ts-expect-error Events cannot be handled.
  peer.handle({ name: "log", handler() {} });

  // @ts-expect-error Streams must return an AsyncIterable.
  peer.handle({ name: "count", handler: ({ count }) => count });

  // @ts-expect-error Request handlers return schema input values.
  peer.handle({ name: "double", handler: () => "42" });

  void response;
}

test("contract operations constrain peer names and values", () => {
  expect(assertContractTypes).toBeTypeOf("function");
});
