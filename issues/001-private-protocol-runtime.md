# Replace RawPeer with a private protocol runtime

Type: AFK

Source: https://github.com/blazeshomida/channel/issues/15

## What to build

Replace the second peer-shaped internal interface with a narrow private protocol runtime owned by
the contract-bound Peer.

Preserve all current public Peer behavior while removing the obsolete RawPeer concept. Existing
focused protocol tests should exercise the new runtime seam through an in-memory Channel adapter,
and public behavior tests should continue to exercise the contract-bound Peer.

## Acceptance criteria

- [ ] The package has one public Peer concept; the private protocol implementation is a runtime.
- [ ] The runtime exposes only capabilities required by the contract-bound Peer and focused tests.
- [ ] Raw protocol messages and runtime types remain absent from public exports and declarations.
- [ ] Existing request, stream, event, cancellation, and close behavior remains unchanged.
- [ ] Tests depending on RawPeer move to the runtime seam or public contract-bound Peer.
- [ ] Focused package tests and type checks pass.

## Blocked by

None.
