# Consolidate event consumption ownership

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/17

## What to build

Give event consumption one authoritative owner for validation, transformed delivery, listener
registration, `once`, disposal, and error reporting.

Protocol notification delivery should remain minimal and should not duplicate the contract event
module's listener lifecycle behavior.

## Acceptance criteria

- [ ] Event input is validated and transformed once at the listening Peer.
- [ ] Type-only events pass values through without runtime validation.
- [ ] One module owns listeners, `once`, disposal, transformed delivery, and listener errors.
- [ ] Invalid events invoke no listeners and report through configured error handlers.
- [ ] Multiple listeners share the appropriate protocol subscription without duplicate validation.
- [ ] Public event behavior remains unchanged.
- [ ] Event runtime and compile-time tests pass.

## Blocked by

- `001-private-protocol-runtime.md`
