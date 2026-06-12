# Concentrate stream lifecycle transitions

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/16

## What to build

Concentrate stream lifecycle transitions so stream actions no longer coordinate pending and active
stream Maps directly.

The resulting module should own lazy startup, pull ordering, item delivery, completion, failure,
cancellation, producer iterator cleanup, and close behavior while preserving the pull-based
protocol.

## Acceptance criteria

- [ ] Creating a stream remains lazy.
- [ ] Pull-based backpressure and message ordering remain unchanged.
- [ ] Pending consumer and active producer streams have cohesive lifecycle ownership.
- [ ] Cancellation closes the consumer and aborts and returns the producer iterator.
- [ ] Invalid transformed items still fail and cancel the stream.
- [ ] Closing rejects pending streams and aborts active producers.
- [ ] Pass-through stream registries are absorbed where they no longer provide depth.
- [ ] Public and focused protocol stream tests pass.

## Blocked by

- `001-private-protocol-runtime.md`
