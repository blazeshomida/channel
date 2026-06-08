import { createChannel, type Transport } from "@blazeshomida/channel";

import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element.");
}

interface PlaygroundMessage {
  type: "echo";
  text: string;
}

function createEchoTransport(): Transport<PlaygroundMessage> {
  const listeners = new Set<(message: PlaygroundMessage) => void>();

  return {
    send(message) {
      for (const listener of listeners) {
        listener(message);
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const channel = createChannel(createEchoTransport());

const messages: string[] = [];

channel.subscribe((message) => {
  messages.push(`${message.type}: ${message.text}`);
  app.textContent = messages.join("\n");
});

channel.send({
  type: "echo",
  text: "Channel connected.",
});
