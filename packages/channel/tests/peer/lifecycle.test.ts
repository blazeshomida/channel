import { expect, test } from "vite-plus/test";

import { createTestPeer } from "./helpers";

test("close is idempotent", () => {
  const { peer, transport } = createTestPeer();

  peer.close();
  peer.close();

  expect(transport.closed).toBe(true);
});
