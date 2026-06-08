# Channel

`Channel` is a typed wrapper around a message transport.

Use it when you want one consistent API for sending messages, subscribing to messages, and closing message flow across different runtimes.

## Basic Usage

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

## What A Channel Does

A channel:

- sends outbound messages through a transport
- subscribes to inbound messages from a transport
- tracks whether it has been closed
- cleans up active subscriptions when closed
- closes the transport when the transport has a `close` method

A channel does not implement request / response, events, streams, schemas, retries, or cancellation. Those belong in higher-level APIs built on top of channels.

## Transport

A transport connects a channel to a runtime message source.

```ts
interface Transport<TInbound = unknown, TOutbound = TInbound, TOptions = void> {
  send(message: TOutbound, ...args: TransportSendArgs<TOptions>): void;
  subscribe(listener: TransportListener<TInbound>): Unsubscribe;
  close?(): void;
}
```

Transport examples include:

- a Web Worker client
- a Web Worker host
- a `MessagePort`
- an in-memory test transport

The transport owns runtime-specific behavior. The channel owns lifecycle behavior around that transport.

## Sending Messages

For transports without send options, call `send` with one argument.

```ts
channel.send({
  type: "echo",
  text: "Hello",
});
```

Some transports may accept a second options argument. For example, a worker transport may support transfer lists.

```ts
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

## Subscribing To Messages

Use `subscribe` to listen for inbound messages.

```ts
const unsubscribe = channel.subscribe((message) => {
  console.log(message);
});
```

Call the returned function to stop listening.

```ts
unsubscribe();
```

The unsubscribe function can be called more than once.

## Closing A Channel

Use `close` when the channel should stop sending and receiving messages.

```ts
channel.close();
```

Closing a channel:

- marks the channel as closed
- unsubscribes active subscriptions created through the channel
- calls `transport.close?.()`

`close` can be called more than once.

After a channel is closed, `send` and `subscribe` throw.

```ts
channel.close();

channel.send(message); // Throws.
channel.subscribe(listener); // Throws.
```

Use `closed` to check the current state.

```ts
if (!channel.closed) {
  channel.send(message);
}
```

## Inbound And Outbound Messages

Inbound and outbound messages can use the same type.

```ts
type Message = { type: "ping" } | { type: "pong" };

const channel = createChannel<Message>(transport);
```

They can also use different types.

```ts
type InboundMessage = { type: "response"; id: string };
type OutboundMessage = { type: "request"; id: string };

const channel = createChannel<InboundMessage, OutboundMessage>(transport);
```

Use separate inbound and outbound types when each side of the connection sends different message shapes.

## Send Options

Transport options are the third generic parameter.

```ts
interface SendOptions {
  transfer?: readonly Transferable[];
}

const channel = createChannel<InboundMessage, OutboundMessage, SendOptions>(transport);
```

With send options, `send` accepts an optional second argument.

```ts
channel.send(message, {
  transfer: [buffer],
});
```

Without send options, `send` only accepts the message.

```ts
channel.send(message);
```

## Runtime Boundaries

Messages from workers, ports, or other external runtimes are boundary values.

Validate or narrow untrusted runtime messages inside the transport before passing them to channel subscribers. The channel preserves the types supplied by the transport; it does not validate messages at runtime.

## Where Channel Fits

The package is designed in layers.

```txt
Transport
  environment-specific send / subscribe / close adapter

Channel
  typed lifecycle wrapper over a transport

Peer
  request / response, events, streams, errors, and cancellation over a channel

Contract
  shared schemas and inferred types for peer methods, events, and streams
```

Use `Channel` as the small primitive for message flow. Build higher-level protocols on top of it.
