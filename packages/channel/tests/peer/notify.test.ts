import { expect, test } from "vite-plus/test";

import { createTestPeer, createTestPeerWithOptions } from "./helpers";

test("sends notification messages", () => {
  const { peer, transport } = createTestPeer();

  peer.notify({
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(transport.sent).toEqual([
    {
      type: "notification",
      name: "log.info",
      payload: {
        message: "hello",
      },
    },
  ]);
});

test("forwards notification messages to the configured receiver", () => {
  const received: unknown[] = [];
  const { peer, transport } = createTestPeerWithOptions({
    onNotification(payload, context) {
      received.push({
        name: context.name,
        payload,
      });
    },
  });

  transport.emit({
    type: "notification",
    name: "log.info",
    payload: {
      message: "hello",
    },
  });

  expect(received).toEqual([
    {
      name: "log.info",
      payload: {
        message: "hello",
      },
    },
  ]);

  peer.close();
});
