# 08 — appearance and closeout

## Contract unlocked

The complete workflow remains legible in both light and dark mode. The catalog
migration and 0.1.33 compatibility contracts from slices 00–01 are replayed here
as release gates.

## API and fixture seam

Use `NSColor` semantic roles and `viewDidChangeEffectiveAppearance`/window
appearance propagation already established by the recent Library dark-mode fix.
Keep synthetic shot labels and control identifiers stable.

## Tests and gates

- Replay the slice 00–01 migration/compatibility reads, preview, timeline and
  export against 0.1.33 data; this is a gate, not a second compatibility owner.
- Run Library/inspector light and dark offscreen shots and switching tests.
- Run `library-view-shots.mjs`, relevant native controller/service tests and the
  complete repository suite once at feature end.
- Run `compare-screenshots` against current Library baselines and
  `screenshot-critique` last on every changed visual shot; open with
  `preview-shots` for the non-blocking human checkpoint.

## Delegated freedom

Only cosmetic spacing and wording may remain flexible. Compatibility behavior,
semantic colors, fixture provenance and full-run closeout are fixed.
