# Workers

Worker transports adapt Web Worker messaging to the channel transport interface.

Use the client transport on the main thread. Use the host transport inside the worker.

## Main Thread

```ts
import { createChannel } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/client";

type InboundMessage = { type: "ready" };
type OutboundMessage = { type: "ping" };

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

const transport = createTransport<InboundMessage, OutboundMessage>(worker);
const channel = createChannel(transport);

channel.subscribe((message) => {
  if (message.type === "ready") {
    console.log("Worker ready.");
  }
});

channel.send({
  type: "ping",
});
```

## Worker Thread

```ts
import { createChannel } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/host";

type InboundMessage = { type: "ping" };
type OutboundMessage = { type: "ready" };

const transport = createTransport<InboundMessage, OutboundMessage>(self);
const channel = createChannel(transport);

channel.subscribe((message) => {
  if (message.type === "ping") {
    channel.send({
      type: "ready",
    });
  }
});
```

## Transfer Lists

Worker transports support transfer lists through the second `send` argument.

```ts
type OutboundMessage = {
  type: "buffer";
  buffer: ArrayBuffer;
};

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
```

## Closing

Client worker transports call `worker.terminate()` when closed.

```ts
channel.close();
```

Host worker transports call `self.close?.()` when closed.

Closing a channel also unsubscribes listeners registered through that channel.

## Runtime Boundaries

Worker messages are boundary values.

The worker transports forward `event.data` as the inbound message. They do not validate message payloads at runtime.

Validate or narrow untrusted messages before relying on their shape in application code.
