# Preserve late cancelled message handling

Type: AFK

## What to build

Bound cancellation bookkeeping without reclassifying legitimate late responses or stream messages
as unknown protocol traffic.

The lifecycle should continue ignoring messages for locally cancelled operations even after many
newer cancellations, while retaining bounded memory use and preserving error reporting for
identifiers that were never issued locally.

## Acceptance criteria

- [ ] Late responses for locally cancelled requests remain ignored after more than 1,024 cancellations.
- [ ] Late items and terminal messages for locally cancelled streams remain ignored after more than 1,024 cancellations.
- [ ] Cancellation bookkeeping remains bounded.
- [ ] Messages for identifiers that were never issued locally still report protocol errors.
- [ ] Request and stream identifiers remain unique across their shared protocol space.
- [ ] Focused cancellation lifecycle tests pass.

## Blocked by

None - can start immediately.
