# Simplify contract creation

Type: AFK

## What to build

Simplify `createContract` so callers pass the operation map directly instead of wrapping the package's
only contract option in an `operations` property.

The resulting Contract may retain an internal `operations` boundary if useful, but consumer code
should use `createContract({ name: request(), event: event(), stream: stream() })`. Update package
examples, tests, inferred types, and exports without changing operation behavior.

## Acceptance criteria

- [x] `createContract` accepts a direct operation map.
- [x] Request, stream, and event names and values retain their current inference.
- [x] Contract-bound Peer runtime behavior remains unchanged.
- [x] All package tests and examples use the simplified API.
- [x] Generated declarations expose the simplified signature without private implementation types.
- [x] A changeset records the public API change.
- [x] `vpr ready` passes.

## Blocked by

None - can start immediately.
