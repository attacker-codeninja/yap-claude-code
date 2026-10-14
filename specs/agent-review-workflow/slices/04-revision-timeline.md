# 04 — revision timeline

## Contract unlocked

The Library/inspector presents the current head and historical revisions as a
clickable timeline. The user starts at head and clicking a revision immediately
switches the selected preview, like a browser tab.

## API seam

Use `revision.history` with its cursor pinned to the initial revision ordinal,
plus `revision.get`/`project.get` for current-head facts. The shared selection
model contains project identity, selected revision, head revision, ordinal,
operation/time label, readiness and unavailable/error state. The selected revision
is the input to every preview, frame, transcript, diagnostics and export request.

History browsing never calls `edit.restore`, never changes the project head and
never silently follows a later head refresh while an older revision is selected.
Concurrent edits, deletion and service restart fence late responses.

## Tests and checkpoint

Use a three-revision fixture to switch head → older → head while preview/readiness
polls are in flight. Assert returned media and evidence identities, cursor
continuations and no mutation. Verify an unavailable historical preview remains a
visible state instead of selecting another revision.

Playable checkpoint: the native timeline shows three revisions and swaps the
player/content when each is clicked.

## Visual gates

Run `compare-screenshots` against the current Library baseline for changed layout,
then `screenshot-critique` last, and open shots with `preview-shots`.

## Delegated freedom

The implementer may choose timeline spacing and labels, but must show head status,
selected state and historical identity without hard-coded appearance colors.
