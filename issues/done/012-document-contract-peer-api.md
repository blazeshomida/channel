# Document the Contract and Peer APIs

Type: AFK

## What to build

Document the package's public Contract and Peer workflow for consumers.

The package README should show a minimal end-to-end contract shared by two peers and explain request,
stream, event, handler, listener, validation, cancellation, error reporting, disposal, and close
behavior at the level needed to adopt the API. Keep the existing Channel and worker guidance intact.

## Acceptance criteria

- [x] The README includes a minimal `createContract` and `createPeer` example using the current public API.
- [x] Requests, handlers, streams, events, and listeners have concise usage examples or API guidance.
- [x] Standard Schema validation and type-only operations are distinguished.
- [x] Abort signals, error callbacks, disposer functions, and Peer closure behavior are described.
- [x] Examples use only public package exports and package-realistic import paths.
- [x] Documentation examples pass the workspace checks.

## Blocked by

- `011-simplify-create-contract.md`
