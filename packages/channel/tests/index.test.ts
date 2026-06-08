import { expect, test } from "vite-plus/test";

import { createChannel, type Transport } from "../src/index";

test("sends messages through the transport", () => {
  const sent: string[] = [];

  const transport: Transport<string> = {
    send(message) {
      sent.push(message);
    },

    subscribe() {
      return () => {};
    },
  };

  const channel = createChannel(transport);

  channel.send("hello");

  expect(sent).toEqual(["hello"]);
});

test("subscribes to transport messages", () => {
  let listener: ((message: string) => void) | undefined;
  const received: string[] = [];

  const transport: Transport<string> = {
    send() {},

    subscribe(next) {
      listener = next;

      return () => {
        listener = undefined;
      };
    },
  };

  const channel = createChannel(transport);

  channel.subscribe((message) => {
    received.push(message);
  });

  listener?.("hello");

  expect(received).toEqual(["hello"]);
});

test("forwards transport-specific send options", () => {
  interface TestOptions {
    transfer?: readonly ArrayBuffer[];
  }

  const sent: Array<{
    message: string;
    options: TestOptions | undefined;
  }> = [];

  const transport: Transport<string, string, TestOptions> = {
    send(message, options) {
      sent.push({ message, options });
    },

    subscribe() {
      return () => {};
    },
  };

  const channel = createChannel(transport);
  const buffer = new ArrayBuffer(8);

  channel.send("hello", {
    transfer: [buffer],
  });

  expect(sent).toEqual([
    {
      message: "hello",
      options: {
        transfer: [buffer],
      },
    },
  ]);
});

test("unsubscribes from transport messages", () => {
  let listener: ((message: string) => void) | undefined;
  const received: string[] = [];

  const transport: Transport<string> = {
    send() {},

    subscribe(next) {
      listener = next;

      return () => {
        listener = undefined;
      };
    },
  };

  const channel = createChannel(transport);

  const unsubscribe = channel.subscribe((message) => {
    received.push(message);
  });

  listener?.("before");
  unsubscribe();
  listener?.("after");

  expect(received).toEqual(["before"]);
});

test("closes once and prevents future usage", () => {
  let closeCount = 0;
  let unsubscribeCount = 0;

  const transport: Transport<string> = {
    send() {},

    subscribe() {
      return () => {
        unsubscribeCount += 1;
      };
    },

    close() {
      closeCount += 1;
    },
  };

  const channel = createChannel(transport);

  channel.subscribe(() => {});

  channel.close();
  channel.close();

  expect(channel.closed).toBe(true);
  expect(unsubscribeCount).toBe(1);
  expect(closeCount).toBe(1);
  expect(() => channel.send("hello")).toThrow("Channel is closed.");
  expect(() => channel.subscribe(() => {})).toThrow("Channel is closed.");
});
