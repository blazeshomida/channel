# Concentrate request lifecycle transitions

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/18

## What to build

Concentrate request lifecycle transitions so request actions no longer coordinate pending, active,
and cancelled request Maps directly.

The resulting module should own request identifiers, pending response settlement, inbound handler
cancellation, late cancelled responses, and cleanup while preserving the existing protocol.

## Acceptance criteria

- [ ] Request identifiers and pending response settlement have one lifecycle owner.
- [ ] Active request cancellation and cleanup have one lifecycle owner.
- [ ] Late responses for locally cancelled requests remain ignored.
- [ ] Abort reasons and serializable request errors retain their current behavior.
- [ ] Closing rejects pending requests and aborts active handlers.
- [ ] Pass-through request registries are absorbed where they no longer provide depth.
- [ ] Public and focused protocol request tests pass.

## Blocked by

- `001-private-protocol-runtime.md`
