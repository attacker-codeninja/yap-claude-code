# 07 — revision-pinned Downloads export

## Contract unlocked

The user can click Export in the native inspector and receive the currently
selected revision in `~/Downloads`; the agent can still perform the same export.

## API seam

Reuse `ExportController`, `export.create`, `export.status`, retry and reveal.
Pin the selected revision before creating the request. Derive a bounded filename
from project identity, revision and kind, reserve a collision-safe leaf in
Downloads and never overwrite an unrelated file. Preserve exportId for uncertain
replies and show queued/running/failed/committed states and issues.

This deterministic Downloads action is separate from the existing explicit save
panel action; both use the same service export owner and publication safeguards.

## Tests and checkpoint

Export current and historical revisions, change the head while the action is in
flight, lose the create reply, poll status, collide with an existing file and
exercise symlink/source-destination refusals. Assert the committed receipt names
the selected revision and source files remain byte-identical.

Playable checkpoint: click Export, watch status, and reveal the committed file in
Downloads.

## Visual gates

Run `screenshot-critique` last for export states; use `compare-screenshots` if the
Library baseline changes; open shots with `preview-shots`.

## Delegated freedom

The implementer may choose filename punctuation and progress copy within the
bounded identity requirements. Export ownership, destination safety and revision
pinning are fixed.
