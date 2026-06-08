# @blazeshomida/channel

Typed message channel primitives for workers and other transports.

This package is private while the API is being explored.

## Usage

```ts
import { createChannel, type Transport } from "@blazeshomida/channel";

interface Message {
  type: "echo";
  text: string;
}

const listeners = new Set<(message: Message) => void>();

const transport: Transport<Message> = {
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

const channel = createChannel(transport);

const unsubscribe = channel.subscribe((message) => {
  console.log(message.text);
});

channel.send({
  type: "echo",
  text: "Hello",
});

unsubscribe();
channel.close();
```

## API

### `createChannel(transport)`

Creates a typed channel over a transport.

A channel can send messages, subscribe to messages, expose closed state, and close the underlying transport when supported.

Calling `send` or `subscribe` after `close` throws.

## Guide

See [Channel](./docs/channel.md) for lifecycle behavior, send options, inbound/outbound typing, and runtime boundary notes.
