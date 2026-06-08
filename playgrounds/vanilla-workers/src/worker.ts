/// <reference lib="webworker" />

import { createChannel } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/host";

type WorkerInboundMessage =
  | { type: "echo"; text: string }
  | { type: "buffer"; buffer: ArrayBuffer };

type WorkerOutboundMessage =
  | { type: "ready" }
  | { type: "echo"; text: string }
  | { type: "buffer"; byteLength: number };

const channel = createChannel(createTransport<WorkerInboundMessage, WorkerOutboundMessage>(self));

channel.subscribe((message) => {
  switch (message.type) {
    case "echo": {
      channel.send({
        type: "echo",
        text: message.text,
      });

      break;
    }

    case "buffer": {
      channel.send({
        type: "buffer",
        byteLength: message.buffer.byteLength,
      });

      break;
    }
  }
});

channel.send({
  type: "ready",
});
