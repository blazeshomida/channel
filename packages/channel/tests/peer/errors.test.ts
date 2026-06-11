import { expect, test } from "vite-plus/test";

import { createTestPeerWithOptions } from "./helpers";

test("routes unknown response ids to root onError", () => {
  const errors: Array<{
    error: unknown;
    context: unknown;
  }> = [];

  const { transport } = createTestPeerWithOptions({
    onError(error, context) {
      errors.push({ error, context });
    },
  });

  transport.emit({
    type: "response",
    id: 999,
    ok: true,
    payload: "late",
  });

  expect(errors).toEqual([
    {
      error: {
        code: "REQUEST_FAILED",
        message: 'No pending request for response "999".',
      },
      context: {
        type: "response",
        id: 999,
      },
    },
  ]);
});
