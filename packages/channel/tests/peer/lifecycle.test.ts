import { expect, test } from "vite-plus/test";

import { createContract, request } from "../../src";
import { createContractOperations } from "../../src/peer/_contract/operations";
import { createTestPeer } from "./helpers";

test("close is idempotent", () => {
  const { peer, transport } = createTestPeer();

  peer.close();
  peer.close();

  expect(transport.closed).toBe(true);
  expect(transport.closeCalls).toBe(1);
  expect(transport.listeners.size).toBe(0);
});

test("closing contract operations disposes protocol registrations once", () => {
  const contract = createContract({
    run: request<void, void>(),
  });
  const { peer: runtime } = createTestPeer();
  const handle = runtime.handle.bind(runtime);
  let disposals = 0;

  runtime.handle = (options) => {
    const dispose = handle(options);

    return () => {
      disposals += 1;
      dispose();
    };
  };

  const operations = createContractOperations({
    contract,
    runtime,
  });

  operations.handle({
    name: "run",
    handler() {},
  });

  operations.close();
  operations.close();

  expect(disposals).toBe(1);
});
