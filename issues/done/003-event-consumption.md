# Consolidate event consumption ownership

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/17

## What to build

Give event consumption one authoritative owner for validation, transformed delivery, listener
registration, `once`, disposal, and error reporting.

Protocol notification delivery should remain minimal and should not duplicate the contract event
module's listener lifecycle behavior.

## Acceptance criteria

- [x] Event input is validated and transformed once at the listening Peer.
- [x] Type-only events pass values through without runtime validation.
- [x] One module owns listeners, `once`, disposal, transformed delivery, and listener errors.
- [x] Invalid events invoke no listeners and report through configured error handlers.
- [x] Multiple listeners share the appropriate protocol subscription without duplicate validation.
- [x] Public event behavior remains unchanged.
- [x] Event runtime and compile-time tests pass.

## Blocked by

- `001-private-protocol-runtime.md`
