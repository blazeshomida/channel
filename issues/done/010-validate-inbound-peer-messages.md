# Validate inbound Peer messages

Type: AFK

## What to build

Treat messages received from a Channel as untrusted input before dispatching them through the private
Peer protocol.

The public Peer should accept an unknown inbound Channel value, narrow complete request, response,
notification, cancellation, and stream message shapes at runtime, and handle malformed input without
throwing from protocol dispatch or corrupting lifecycle state.

## Acceptance criteria

- [x] The private protocol no longer relies on casting an unknown inbound Channel to typed Peer messages.
- [x] Every protocol message variant is narrowed before lifecycle dispatch.
- [x] Null, primitive, unknown-type, and incomplete messages do not throw from Channel delivery.
- [x] Malformed messages do not settle, cancel, or create request or stream lifecycle state.
- [x] Invalid inbound messages are reported through the configured root error callback with useful context.
- [x] Valid request, event, stream, cancellation, and close behavior remains unchanged.
- [x] Focused malformed-message and public Peer tests pass.

## Blocked by

None - can start immediately.
