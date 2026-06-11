import { expect, test } from "vite-plus/test";

import type { Transport } from "../../src";
import type {
  WorkerClientTarget,
  WorkerHostTarget,
  WorkerSendOptions,
} from "../../src/worker/types";

export class TestWorkerTarget<TInbound, TOutbound>
  implements WorkerClientTarget<TInbound, TOutbound>, WorkerHostTarget<TInbound, TOutbound>
{
  readonly listeners = new Set<(event: MessageEvent<TInbound>) => void>();

  readonly sent: Array<{
    message: TOutbound;
    transfer: Transferable[];
  }> = [];

  closeCount = 0;
  terminateCount = 0;

  postMessage(message: TOutbound, transfer: Transferable[]): void {
    this.sent.push({
      message,
      transfer,
    });
  }

  addEventListener(_type: "message", listener: (event: MessageEvent<TInbound>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<TInbound>) => void): void {
    this.listeners.delete(listener);
  }

  emit(message: TInbound): void {
    const event = new MessageEvent<TInbound>("message", {
      data: message,
    });

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  close(): void {
    this.closeCount += 1;
  }

  terminate(): void {
    this.terminateCount += 1;
  }
}

interface SharedWorkerTransportBehaviorArgs {
  label: string;
  createTransport(
    target: TestWorkerTarget<string, string>,
  ): Transport<string, string, WorkerSendOptions>;
}

export function testSharedWorkerTransportBehavior({
  label,
  createTransport,
}: SharedWorkerTransportBehaviorArgs): void {
  test(`${label} sends messages`, () => {
    const target = new TestWorkerTarget<string, string>();
    const transport = createTransport(target);

    transport.send("hello");

    expect(target.sent).toEqual([
      {
        message: "hello",
        transfer: [],
      },
    ]);
  });

  test(`${label} forwards transfer lists`, () => {
    const target = new TestWorkerTarget<string, string>();
    const transport = createTransport(target);
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

  test(`${label} subscribes to worker messages`, () => {
    const target = new TestWorkerTarget<string, string>();
    const transport = createTransport(target);
    const received: string[] = [];

    transport.subscribe((message) => {
      received.push(message);
    });

    target.emit("hello");

    expect(received).toEqual(["hello"]);
  });

  test(`${label} unsubscribes from worker messages`, () => {
    const target = new TestWorkerTarget<string, string>();
    const transport = createTransport(target);
    const received: string[] = [];

    const unsubscribe = transport.subscribe((message) => {
      received.push(message);
    });

    target.emit("before");
    unsubscribe();
    target.emit("after");

    expect(received).toEqual(["before"]);
  });
}
