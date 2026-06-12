# Deepen singular request and stream registration

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/19

## What to build

Deepen operation registration behind the singular public `peer.handle(...)` interface.

One internal module should own Contract operation lookup, request or stream selection, input
validation and transformation, cancellation checks before user code, duplicate registration rules,
and disposal. Request and stream protocol mechanics remain distinct where behavior differs.

## Acceptance criteria

- [ ] `peer.handle(...)` remains the only public request and stream registration interface.
- [ ] Contract operation kind selects the internal protocol path.
- [ ] Handler input validation and transformation remain consuming-side and occur once.
- [ ] Type-only operations bypass runtime validation.
- [ ] Duplicate registration, disposal, missing-handler errors, and cancellation remain unchanged.
- [ ] Handler inference remains covered by compile-time tests.
- [ ] Public request and stream tests pass.

## Blocked by

- `001-private-protocol-runtime.md`
