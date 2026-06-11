import { expect, test } from "vite-plus/test";

import { createTransport } from "../../src/worker/client";
import { TestWorkerTarget, testSharedWorkerTransportBehavior } from "./helpers";

testSharedWorkerTransportBehavior({
  label: "client transport",
  createTransport,
});

test("client transport terminates workers when closed", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createTransport(target);

  transport.close?.();

  expect(target.terminateCount).toBe(1);
});
