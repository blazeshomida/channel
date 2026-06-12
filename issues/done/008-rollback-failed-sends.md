# Roll back failed sends

Type: AFK

## What to build

Keep request and stream lifecycle state consistent when the underlying Channel send throws.

A failed initial request or stream send should settle the caller with the original send error and
remove all pending state, abort listeners, and stream registrations created for that operation.
Subsequent messages for the unused identifier should retain the existing unknown-message behavior.

## Acceptance criteria

- [x] A failed request send rejects with the original send error.
- [x] Failed request sends leave no pending request or abort listener behind.
- [x] A failed stream request or first pull rejects with the original send error.
- [x] Failed stream sends leave no consumer registration or abort listener behind.
- [x] Later requests and streams continue to work after a send failure.
- [x] Focused request and stream lifecycle tests pass.

## Blocked by

None - can start immediately.
