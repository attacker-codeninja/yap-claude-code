# 05 — rendered layout diagnostics

## Contract unlocked

An agent and the native inspector can see evidence about rendered text/layout:
clipping, off-canvas bounds, overlap candidates, missing glyphs, substitutions,
safe-area violations and unavailable support.

## API seam

Add one read-only diagnostics owner over pinned native `frame.get`/`frame.batch`
receipts and the existing `TextLayout`/`textFallbacks` records. Return selected
revision/time, clip/text IDs, canvas and geometry bounds, line/ink/visible/
decoration bounds, fallback issues and bounded diagnostic statuses. Reuse the
central issue vocabulary. Keep sampled coverage and unknown support explicit.

Do not add a browser renderer, scan every frame, infer taste or auto-fix a layout.
An overlap is a measured candidate at a sampled frame, not a universal failure.

## Tests and checkpoint

Deterministic fixtures cover clean text, clipping, off-canvas geometry, overlap,
missing glyph/substitution, unavailable support and empty observations. Assert
diagnostics and frame receipts share the same revision/time pins and budgets.

Playable checkpoint: the inspector's diagnostics pane and CLI JSON show a bounded
issue list for a rendered sample.

## Visual gates

Use `compare-screenshots` if the pane changes an existing baseline, run
`screenshot-critique` last and open shots with `preview-shots`.

## Delegated freedom

The implementer may choose the internal geometry intersection algorithm, but must
label uncertainty, preserve existing issue codes where applicable and avoid
turning diagnostics into mutation permission.
