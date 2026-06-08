import { createChannel } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/client";

import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app element.");
}

const app = appElement;

type WorkerInboundMessage =
  | { type: "ready" }
  | { type: "echo"; text: string }
  | { type: "buffer"; byteLength: number };

type WorkerOutboundMessage =
  | { type: "echo"; text: string }
  | { type: "buffer"; buffer: ArrayBuffer };

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

const channel = createChannel(createTransport<WorkerInboundMessage, WorkerOutboundMessage>(worker));

const messages: string[] = [];

function render(message: string) {
  messages.push(message);
  app.textContent = messages.join("\n");
}

channel.subscribe((message) => {
  switch (message.type) {
    case "ready": {
      render("worker: ready");
      break;
    }

    case "echo": {
      render(`worker: ${message.text}`);
      break;
    }

    case "buffer": {
      render(`worker: received ${message.byteLength} bytes`);
      break;
    }
  }
});

channel.send({
  type: "echo",
  text: "Channel connected.",
});

const buffer = new ArrayBuffer(8);

channel.send(
  {
    type: "buffer",
    buffer,
  },
  {
    transfer: [buffer],
  },
);
