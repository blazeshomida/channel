import { expect, test } from "vite-plus/test";

import { createTransport as createClientTransport } from "../src/worker/client";
import { createTransport as createHostTransport } from "../src/worker/host";

class TestWorkerTarget<TInbound, TOutbound> {
  readonly listeners = new Set<(event: MessageEvent<TInbound>) => void>();
  readonly sent: Array<{
    message: TOutbound;
    transfer: Transferable[];
  }> = [];

  closeCount = 0;
  terminateCount = 0;

  postMessage(message: TOutbound, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<TInbound>) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<TInbound>) => void) {
    this.listeners.delete(listener);
  }

  emit(message: TInbound) {
    const event = new MessageEvent<TInbound>("message", {
      data: message,
    });

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  close() {
    this.closeCount += 1;
  }

  terminate() {
    this.terminateCount += 1;
  }
}

test("client transport sends messages to a worker", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createClientTransport(target);

  transport.send("hello");

  expect(target.sent).toEqual([
    {
      message: "hello",
      transfer: [],
    },
  ]);
});

test("client transport forwards transfer lists", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createClientTransport(target);
  const buffer = new ArrayBuffer(8);

  transport.send("hello", {
    transfer: [buffer],
  });

  expect(target.sent).toEqual([
    {
      message: "hello",
      transfer: [buffer],
    },
  ]);
});

test("client transport subscribes to worker messages", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createClientTransport(target);
  const received: string[] = [];

  transport.subscribe((message) => {
    received.push(message);
  });

  target.emit("hello");

  expect(received).toEqual(["hello"]);
});

test("client transport unsubscribes from worker messages", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createClientTransport(target);
  const received: string[] = [];

  const unsubscribe = transport.subscribe((message) => {
    received.push(message);
  });

  target.emit("before");
  unsubscribe();
  target.emit("after");

  expect(received).toEqual(["before"]);
});

test("client transport terminates workers when closed", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createClientTransport(target);

  transport.close?.();

  expect(target.terminateCount).toBe(1);
});

test("host transport sends messages from a worker", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createHostTransport(target);

  transport.send("hello");

  expect(target.sent).toEqual([
    {
      message: "hello",
      transfer: [],
    },
  ]);
});

test("host transport forwards transfer lists", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createHostTransport(target);
  const buffer = new ArrayBuffer(8);

  transport.send("hello", {
    transfer: [buffer],
  });

  expect(target.sent).toEqual([
    {
      message: "hello",
      transfer: [buffer],
    },
  ]);
});

test("host transport subscribes to worker messages", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createHostTransport(target);
  const received: string[] = [];

  transport.subscribe((message) => {
    received.push(message);
  });

  target.emit("hello");

  expect(received).toEqual(["hello"]);
});

test("host transport unsubscribes from worker messages", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createHostTransport(target);
  const received: string[] = [];

  const unsubscribe = transport.subscribe((message) => {
    received.push(message);
  });

  target.emit("before");
  unsubscribe();
  target.emit("after");

  expect(received).toEqual(["before"]);
});

test("host transport closes worker scope when supported", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createHostTransport(target);

  transport.close?.();

  expect(target.closeCount).toBe(1);
});
