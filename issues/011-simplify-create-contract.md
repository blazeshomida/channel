# Simplify contract creation

Type: AFK

## What to build

Simplify `createContract` so callers pass the operation map directly instead of wrapping the package's
only contract option in an `operations` property.

The resulting Contract may retain an internal `operations` boundary if useful, but consumer code
should use `createContract({ name: request(), event: event(), stream: stream() })`. Update package
examples, tests, inferred types, and exports without changing operation behavior.

## Acceptance criteria

- [ ] `createContract` accepts a direct operation map.
- [ ] Request, stream, and event names and values retain their current inference.
- [ ] Contract-bound Peer runtime behavior remains unchanged.
- [ ] All package tests and examples use the simplified API.
- [ ] Generated declarations expose the simplified signature without private implementation types.
- [ ] A changeset records the public API change.
- [ ] `vpr ready` passes.

## Blocked by

None - can start immediately.
