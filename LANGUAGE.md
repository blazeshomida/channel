# Ubiquitous Language

This glossary defines the canonical language for public APIs, JSDoc, guides, examples, tests, and
issues in `@blazeshomida/channel`.

## Messaging Layers

| Term          | Definition                                                                                                                                            | Aliases to avoid                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Transport** | An environment-specific adapter that sends messages, subscribes to messages, and optionally releases its underlying resource.                         | Connection, adapter, channel       |
| **Channel**   | A typed lifecycle boundary over one transport that sends outbound messages, delivers inbound messages, tracks closure, and owns subscription cleanup. | Transport, connection, message bus |
| **Peer**      | One endpoint of the package protocol that performs contract operations over a channel.                                                                | Client, server, endpoint           |
| **Contract**  | The shared set of named operations and their compile-time or runtime schemas.                                                                         | API, protocol, service definition  |
| **Operation** | A named request, stream, or event declared by a contract.                                                                                             | Method, endpoint, action           |
| **Message**   | A protocol value sent through a channel between peers.                                                                                                | Event, operation, payload          |
| **Payload**   | The untyped value carried by a private protocol message before contract validation.                                                                   | Input, message                     |

## Operations

| Term                | Definition                                                                                | Aliases to avoid                           |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Request**         | An operation that accepts one input and settles with one output or one peer error.        | Call, command, query, method               |
| **Request handler** | The registration that receives request input and produces its output.                     | Server, responder, callback                |
| **Stream**          | An operation that accepts one input and asynchronously produces zero or more items.       | Streaming request, sequence, iterator      |
| **Stream handler**  | The registration that receives stream input and produces an async iterable of items.      | Producer, generator, server                |
| **Event**           | A one-way operation that delivers one input to zero or more listeners without a response. | Notification, message, signal              |
| **Event listener**  | A registration that receives event input emitted by the other peer.                       | Handler, subscriber, notification listener |
| **Emit**            | To send an event to the other peer.                                                       | Notify, publish, dispatch, fire            |
| **Handle**          | To register the request handler or stream handler for an operation.                       | Listen, subscribe, serve                   |
| **Listen**          | To register an event listener with `on` or `once`.                                        | Handle, subscribe                          |

## Values And Validation

| Term                    | Definition                                                                                                  | Aliases to avoid                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Input**               | The value supplied when invoking an operation, before any input-schema transformation.                      | Payload, argument, request                          |
| **Handler input**       | The value delivered to a request or stream handler after input validation and transformation.               | Input when transformation matters                   |
| **Listener input**      | The value delivered to an event listener after input validation and transformation.                         | Notification, payload                               |
| **Output**              | The value returned to a request caller after output validation and transformation.                          | Response, result when discussing the protocol shape |
| **Handler output**      | The value produced by a request handler before output validation and transformation.                        | Output when transformation matters                  |
| **Item**                | One value delivered to a stream consumer after item validation and transformation.                          | Output, result, chunk                               |
| **Handler item**        | One value yielded by a stream handler before item validation and transformation.                            | Item when transformation matters                    |
| **Schema**              | A Standard Schema implementation that validates and may transform a contract boundary value.                | Validator, parser                                   |
| **Type-only operation** | An operation declared with generic types that provides compile-time constraints without runtime validation. | Unvalidated operation, unsafe operation             |
| **Validated operation** | An operation declared with schemas that validates relevant boundary values at runtime.                      | Schema operation, runtime-safe operation            |
| **Validation issue**    | One schema-reported problem with a boundary value.                                                          | Validation error                                    |
| **Validation failure**  | The peer error produced when a schema reports one or more validation issues.                                | Invalid message, parse error                        |

## Roles

| Term               | Definition                                                                                         | Aliases to avoid           |
| ------------------ | -------------------------------------------------------------------------------------------------- | -------------------------- |
| **Calling peer**   | The peer that starts a request or stream.                                                          | Client, requester          |
| **Handling peer**  | The peer that owns the matching request or stream handler.                                         | Server, host               |
| **Emitting peer**  | The peer that emits an event.                                                                      | Publisher, notifier        |
| **Listening peer** | The peer that owns an event listener.                                                              | Subscriber, receiver       |
| **Worker client**  | The main-thread side of a worker transport, whose closure terminates the worker.                   | Calling peer, client peer  |
| **Worker host**    | The worker-scope side of a worker transport, whose closure closes the worker scope when supported. | Handling peer, server peer |

Peers are symmetric. Either peer may call, handle, emit, or listen. Use role terms for the operation
being described, and reserve **worker client** and **worker host** for transport import paths.

## Lifecycle And Failures

| Term               | Definition                                                                                | Aliases to avoid                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Subscription**   | A channel registration that receives inbound messages from its transport.                 | Listener registration, handler                                    |
| **Unsubscribe**    | To remove a channel or transport subscription.                                            | Dispose, close                                                    |
| **Registration**   | A peer handler or listener installed for a contract operation.                            | Subscription                                                      |
| **Dispose**        | To remove one peer registration without closing the peer.                                 | Unsubscribe, close, destroy                                       |
| **Close**          | To permanently end a channel or peer lifecycle and release resources it owns.             | Dispose, disconnect, stop                                         |
| **Cancellation**   | Protocol settlement that stops one pending request or stream without closing either peer. | Closure, disposal, abort                                          |
| **Abort signal**   | The local mechanism used to request cancellation and notify the matching handler.         | Cancellation, cancel token                                        |
| **Peer error**     | A structured failure with a stable code, message, and optional data.                      | Exception, error payload                                          |
| **Error callback** | A reporting hook for peer failures associated with protocol activity.                     | Error handler when it could be confused with an operation handler |
| **Error context**  | The discriminated description of the protocol activity associated with a reported error.  | Metadata, details                                                 |

## Relationships

- A **Transport** carries **Messages** for exactly one **Channel**.
- A **Peer** uses exactly one **Channel** and exactly one **Contract**.
- A **Contract** contains named **Operations**.
- An **Operation** is exactly one **Request**, **Stream**, or **Event**.
- A **Request** has at most one active **Request handler** on a peer.
- A **Stream** has at most one active **Stream handler** on a peer.
- An **Event** may have zero or more **Event listeners** on a peer.
- **Close** ends all owned **Subscriptions** and **Registrations**.
- **Cancellation** affects one request or stream; **Close** affects the entire peer.

## Documentation Rules

- Use **event** in public APIs and documentation; use **notification** only for the private wire
  message.
- Use **operation** for the contract-level union. Do not use **method** as a synonym.
- Use **calling peer** and **handling peer** instead of client and server unless discussing worker
  transports.
- Use **unsubscribe** for channel subscriptions, **dispose** for peer registrations, and **close**
  for terminal lifecycle cleanup.
- Use **input**, **output**, and **item** for public contract values. Use **payload** only inside the
  private protocol layer.
- State whether an operation is **type-only** or **validated**; do not imply that TypeScript types
  validate runtime messages.
- Use **abort signal** for the mechanism and **cancellation** for the resulting protocol behavior.
- Use `PeerErrorCallback` for error reporting hooks and reserve **handler** for request and stream
  handlers.
- Use `PeerValidationBoundary` and the `boundary` property for the `input`, `output`, or `item`
  boundary being validated.
- Name private files after the concept they own, such as `error-callback.ts` for error callback
  invocation.

## Example Dialogue

> **Developer:** "Is the worker always the handling peer?"
>
> **Domain expert:** "No. Peers are symmetric. The worker is the worker host at the transport
> layer, but it can be the calling peer for one request and the handling peer for another."
>
> **Developer:** "When the calling peer aborts a stream, does that close the channel?"
>
> **Domain expert:** "No. The abort signal requests cancellation of that stream. Closing the peer is
> terminal and also closes its channel."
>
> **Developer:** "Should an emitted event be called a notification?"
>
> **Domain expert:** "Not in the public API. Call it an event; notification is reserved for the
> private protocol message."

## Resolved Ambiguities

- **Event** is the public one-way operation; **notification** is its private wire representation.
- **Worker client** and **worker host** identify transport sides; calling, handling, emitting, and
  listening identify peer roles for a specific operation.
- **Subscribe** installs channel subscriptions, **listen** describes event registration,
  **handle** installs request or stream handlers, and **register** is the generic peer term.
- **Unsubscribe** removes a channel subscription, **dispose** removes one peer registration, and
  **close** ends the whole channel or peer lifecycle.
- **Input** means the value supplied by the invoking peer. Use **handler input** or **listener input**
  for values after schema transformation.
- `HANDLER_NOT_FOUND` reports a request or stream without a registered handler.
- `OPERATION_CANCELLED` reports cancellation of either a request or stream.
