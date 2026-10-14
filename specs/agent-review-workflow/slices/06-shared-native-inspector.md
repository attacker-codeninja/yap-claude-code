# 06 — shared native inspector

## Contract unlocked

Library project actions and `inspect.open` use one native inspection/preview
window. It shows the selected revision timeline, native video, readable evidence,
diagnostics and explicit actions without opening Safari/Chrome.

## API seam

Extend the existing `PreviewPresenting`/`PreviewController` ownership rather than
creating a second player or controller. The window owns presentation; the
controller owns revision pins, leases, retries, stale-response fences and close.
Library and agent-open dispatch into this same owner. The user-facing window uses
semantic AppKit colors and updates on effective appearance changes.

## Tests and checkpoint

Bridge fixtures prove Library-open and agent-open share identity and lifecycle;
close/delete/service-restart cannot revive a late response or retain a lease.
Preview remains excluded from capture where required. Controls expose stable IDs
for timeline, inspect and export tests.

Playable checkpoint: opening a project from Library and opening it through the
agent show the same native window behavior.

## Visual gates

Render light and dark shots at native Library/inspector sizes. Run
`compare-screenshots` against the fixed Library baseline, then
`screenshot-critique` as the last check, and open shots with `preview-shots`.

## Delegated freedom

The implementer may choose pane arrangement and disclosure affordances. They may
not introduce WebView, browser navigation, hard-coded white/black surfaces or a
second preview owner.
