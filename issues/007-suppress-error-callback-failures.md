# Suppress error callback failures

Type: AFK

## What to build

Ensure user-provided error callbacks cannot interrupt Peer protocol settlement.

Local and root error callbacks should both be attempted in that order. Exceptions thrown by either
callback should be suppressed without recursively reporting them, while the original request,
handler, stream, or event lifecycle continues normally.

## Acceptance criteria

- [ ] Throwing request error callbacks do not prevent the request promise from rejecting.
- [ ] Throwing request and stream handler error callbacks do not prevent error responses from being sent.
- [ ] Throwing event error callbacks do not escape notification delivery.
- [ ] Local callbacks still run before root callbacks.
- [ ] Callback failures are not recursively reported.
- [ ] Focused Peer tests pass.

## Blocked by

None - can start immediately.
