import { expect, test } from "vite-plus/test";

import { createTransport } from "../../src/worker/host";
import { TestWorkerTarget, testSharedWorkerTransportBehavior } from "./helpers";

testSharedWorkerTransportBehavior({
  label: "host transport",
  createTransport,
});

test("host transport closes worker scope when supported", () => {
  const target = new TestWorkerTarget<string, string>();
  const transport = createTransport(target);

  transport.close?.();

  expect(target.closeCount).toBe(1);
});
