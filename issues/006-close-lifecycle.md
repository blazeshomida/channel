# Centralize Peer close lifecycle

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/20

## What to build

Centralize final Peer shutdown through the cohesive operation, event, request, and stream lifecycle
modules produced by the preceding issues.

Remove obsolete cleanup coordination, confirm the private protocol runtime does not leak, and
verify the complete repository.

## Acceptance criteria

- [ ] `peer.close()` is idempotent and delegates cleanup to cohesive lifecycle owners.
- [ ] Pending requests and streams reject with the existing closed error.
- [ ] Active handlers and producers are aborted and cleaned up.
- [ ] Handler and event registrations dispose without duplicate lifecycle ownership.
- [ ] Channel subscription and transport closure retain their ordering and behavior.
- [ ] Obsolete RawPeer and pass-through lifecycle modules are removed.
- [ ] Generated declarations contain no private runtime or message types.
- [ ] `vpr ready` passes.

## Blocked by

- `002-stream-lifecycle.md`
- `003-event-consumption.md`
- `004-request-lifecycle.md`
- `005-operation-registration.md`
