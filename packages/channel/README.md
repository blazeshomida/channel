# @blazeshomida/channel

> [!WARNING]
> This package is unstable while the API is being explored. It is currently private and may change without a migration path.

Typed message channel primitives for workers and other transports.

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

## Worker Transports

Worker transports are available as subpath exports.

```ts
import { createTransport } from "@blazeshomida/channel/worker/client";
```

```ts
import { createTransport } from "@blazeshomida/channel/worker/host";
```

Use the client transport on the main thread and the host transport inside the worker.

## Contracts And Peers

A contract defines the requests, streams, and events shared by both sides of a connection. A peer
binds that contract to a channel.

Define the contract in a module that the client and worker can both import:

```ts
import { createContract, event, request, stream } from "@blazeshomida/channel";

export const workerContract = createContract({
  double: request<{ value: number }, number>(),
  count: stream<{ end: number }, number>(),
  progress: event<{ completed: number }>(),
});
```

Register request and stream handlers inside the worker:

```ts
import { createChannel, createPeer } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/host";

import { workerContract } from "./contract";

const peer = createPeer({
  contract: workerContract,
  channel: createChannel(createTransport(self)),
});

peer.handle({
  name: "double",
  handler({ value }) {
    return value * 2;
  },
});

peer.handle({
  name: "count",
  async *handler({ end }) {
    for (let value = 0; value < end; value++) {
      peer.emit({
        name: "progress",
        input: {
          completed: value + 1,
        },
      });

      yield value;
    }
  },
});
```

Call the worker from the main thread using the same contract:

```ts
import { createChannel, createPeer } from "@blazeshomida/channel";
import { createTransport } from "@blazeshomida/channel/worker/client";

import { workerContract } from "./contract";

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
const peer = createPeer({
  contract: workerContract,
  channel: createChannel(createTransport(worker)),
});

const disposeProgress = peer.on({
  name: "progress",
  listener({ completed }) {
    console.log(`Completed ${completed} items.`);
  },
});

const doubled = await peer.request({
  name: "double",
  input: {
    value: 21,
  },
});

for await (const value of peer.stream({
  name: "count",
  input: {
    end: doubled,
  },
})) {
  console.log(value);
}

disposeProgress();
peer.close();
```

### Operations

Use `request<TInput, TOutput>()` for one response, `stream<TInput, TItem>()` for an async sequence,
and `event<TInput>()` for one-way notifications.

- Call requests with `peer.request(...)` and register their handlers with `peer.handle(...)`.
- Consume streams with `for await` or the returned async iterator and register their handlers with
  `peer.handle(...)`.
- Send events with `peer.emit(...)` and receive them with `peer.on(...)` or `peer.once(...)`.

`handle`, `on`, and `once` return idempotent disposer functions. Dispose registrations when they are
no longer needed. Returning early from stream iteration also cancels the remote stream producer.

### Validation

The generic operation forms are type-only. They constrain TypeScript callers but do not validate
messages at runtime.

For runtime validation, pass schemas from any
[Standard Schema](https://standardschema.dev/)-compatible library:

```ts
const validatedContract = createContract({
  double: request({
    input: doubleInputSchema,
    output: doubleOutputSchema,
  }),
  count: stream({
    input: countInputSchema,
    item: countItemSchema,
  }),
  progress: event({
    input: progressInputSchema,
  }),
});
```

Request input is validated before its handler runs, request output is validated before it reaches
the caller, stream input and items are validated at their corresponding boundaries, and event input
is validated before listeners run. Schemas may transform values; handlers and listeners receive
schema output values.

### Cancellation And Errors

Pass an `AbortSignal` to `request` or `stream` to cancel local consumption and abort the matching
handler through its context:

```ts
const controller = new AbortController();

const result = peer.request({
  name: "double",
  input: {
    value: 21,
  },
  signal: controller.signal,
});

controller.abort();
await result;
```

Request and stream handlers receive `{ id, name, signal }` as their second argument. Observe the
signal in long-running handlers and generators so they can stop work promptly.

`createPeer` accepts a root `onError` callback. `request`, `stream`, `handle`, `on`, and `once` also
accept operation-local callbacks. Local callbacks run before the root callback. Exceptions thrown
by error callbacks are suppressed so they cannot interrupt protocol settlement.

Requests reject and stream iteration throws with a `PeerError` for remote failures,
cancellation, validation failures, missing handlers, or peer closure. Event listener and event
validation failures are reported through error callbacks because events do not return a promise.

### Closing

`peer.close()` is idempotent. It disposes handlers and listeners, aborts active handlers, rejects
pending requests and stream pulls with `PEER_CLOSED`, and closes the underlying channel and
transport. Do not reuse the peer or its channel after closing it.

## API

### `createChannel(transport)`

Creates a typed channel over a transport.

A channel can send messages, subscribe to messages, expose closed state, and close the underlying transport when supported.

Calling `send` or `subscribe` after `close` throws.

## Guides

See [Channel](./docs/channel.md) for lifecycle behavior, send options, inbound/outbound typing, and runtime boundary notes.

See [Workers](./docs/workers.md) for worker client and host transport usage.
