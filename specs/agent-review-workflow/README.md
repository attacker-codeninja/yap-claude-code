# Agent review workflow

Status: implementation in progress; compatibility floor and catalog boundary are settled.

## Next Agent Prompt

Current status: all implementation slices are landed and committed in
`366dc992`. The
public read-only operations are `inspect.open`/`inspect`, `caption.propose` and
`layout.diagnostics`; the native preview owner now supplies revision selection
and Downloads export. Focused protocol, service, core and native-control checks
are green. The remaining pickup is the whole-repository/native validation pass,
then review and archival. The repository-wide `bun test` gate was attempted once
and stopped after environment failures unrelated to this feature: missing
native/app/Sparkle fixtures and permissions, no Node 24 runtime, Bun/node:test
API mismatches, and a pre-existing transcript model-state expectation. The
focused feature checks remain green.
The supported compatibility floor is the launch build at 7:03 PM PDT on
October 12, 2026 (Yap 0.1.33). Its catalogs already use format 29 and open
unchanged. Pre-launch format-22 fixtures remain refusal/provenance inputs; they
are not silently migrated. Keep the catalog owner ready for a future tested
migration boundary without inventing project history from those rows.

Global TODO:

- [x] 00 — define the guarded catalog compatibility boundary at launch format 29
- [x] 01 — prove 0.1.33 compatibility and the `inspect.open` handoff
- [x] 02 — expose bounded `yap inspect`/`inspect.open`
- [x] 03 — expose read-only `caption.propose`
- [x] 04 — add the revision timeline and historical selection model
- [x] 05 — add rendered text/layout diagnostics
- [x] 06 — share the native inspector between Library and agent-open
- [x] 07 — add revision-pinned Downloads export
- [x] 08 — close light/dark appearance and integration gates

## Goal

Give an agent and a person one native review surface for a project revision.
The agent can request inspection, the user can watch the native rendered
preview, move through historical revisions, read bounded evidence and export
the selected revision to Downloads. Caption proposals reduce orchestration but
never apply an edit; `text.seed` remains the explicit caption mutation.

The browser and GPU ideas from the ManimGX reference are deliberately narrowed
to the useful contract: inspect evidence before delivery. Yap keeps its native
renderer, native AVPlayer preview and native export path.

## Settled contracts

- `PreviewController` and `PreviewWindow` are the sole owners of native preview
  identity, delivery leases, playback and close/reopen behavior.
- Composition remains the sole owner of project clocks, placement and timed
  caption evaluation. No second animation clock or renderer is introduced.
- `revision.history` supplies the revision timeline. The Library opens at the
  current head; clicking an older revision immediately switches the selected
  preview, like a browser tab, without restoring or editing the project.
- Every read, preview and export is pinned to the selected project revision.
  A head refresh never silently changes a historical selection.
- `caption.propose` is read-only and returns bounded transcript-pinned drafts,
  timed-word mappings and issues. `text.seed` is the only operation that adds
  caption clips and creates a new revision.
- Layout diagnostics are evidence. Clipping, overlap, missing glyphs and unsafe
  bounds produce advisory issues or explicit unavailable states; they never
  authorize an edit or certify continuous readability.
- The inspection UI is native macOS. It plays the existing native MP4 preview.
  No WebView, browser renderer, WebGPU path, ergonomic authoring API or GPU
  rewrite is in scope.
- Export uses the existing `export.create`/`export.status` lifecycle and writes
  to `~/Downloads` with a generated collision-safe filename. It never mutates
  source media or silently overwrites an unrelated file.
- Library and inspector surfaces must work in light and dark appearance. Use
  semantic AppKit colors and re-render on effective-appearance changes; recent
  Library dark-mode fixes are a regression baseline.
- Existing recordings and projects back to launch version **0.1.33** remain
  readable. New derived fields are optional and never required in old records.
  Version-aware readers are allowed where the persisted shape genuinely differs;
  duplicate compatibility owners and destructive migrations are not.
- Keep the current `catalogFormat` at **29** unless implementation proves a new
  persisted catalog shape is required. This feature is designed to add no such
  shape. Compatibility for 0.1.33 recordings means admitting their media,
  published members and journals into a current catalog; it does not silently
  promise that an entire old catalog database opens. The catalog owner currently
  refuses a different `PRAGMA user_version` rather than migrating it.

## Catalog evolution rules

The launch-floor compatibility boundary is one-time. The current catalog then evolves
additively:

- preserve the meaning of every existing table and column; never repurpose a
  name or change a stored identity;
- prefer optional fields or new tables keyed by stable identities for new facts;
- create additive tables idempotently and let absent rows mean unavailable or
  not-yet-derived evidence;
- never backfill guessed values to satisfy a new required invariant;
- bump `catalogFormat` only when an existing shape or ownership invariant cannot
  represent the behavior, and provide one tested migration boundary.

Inspection metadata, caption proposals and layout diagnostics are derived and do
not need catalog columns in this feature.

Launch version 0.1.33 already used catalog format 29, so its catalogs need no
migration. The checked-in format-22 fixture predates the launch floor and is
refused unchanged; its recording and legacy revision rows remain frozen
provenance only.

## Reference research

The ManimGX agent instructions at
<https://manimgx.academa.ai/llms.txt> describe an `inspect` command that
produces a storyboard, timeline and sampled layout problems before rendering.
They explicitly limit layout checks to sampled moments. Yap adopts that workflow
idea while retaining native rendering and its evidence caveats. The repository's
existing `skills/yap/scripts/timeline-inspection.mjs` and `review-bundle.mjs`
already provide bounded storyboard/review evidence and are the implementation
starting points.

## Slice graph

```text
00 legacy catalog migration
 └─ 01 compatibility + inspect.open spike
     └─ 02 public inspect
         ├─ 03 caption.propose
         └─ 04 revision timeline
             └─ 05 rendered layout diagnostics
                 └─ 06 shared native inspector (Library + agent)
                     └─ 07 Downloads export
                         └─ 08 appearance + integration closeout
```

Slices 02, 03 and 05 may share service work, but the native window is not built
until 00 and 01 prove catalog/library compatibility and the app handoff.

## Firewalls

- Do not make the browser or a new process a media renderer.
- Do not add arbitrary speech-driven geometry/opacity cues; the first cue scope
  is caption highlighting using existing transcript timing.
- Do not make inspection, diagnostics or caption proposals mutate a project.
- Do not infer word timing from generated voice duration.
- Do not turn sparse frames, low energy or a layout warning into editorial
  permission or a perceptual pass.
- Do not make the Library guess when an agent is finished. Head and historical
  revision identity are explicit.
- Do not weaken old-recording support to simplify new schemas.

## Visual verification

Every visual slice must run `screenshot-critique` as its final acceptance check.
When it changes the existing Library look, use `compare-screenshots` against the
current Library baselines. Open produced shots with `preview-shots`; human review
is non-blocking and should not stall implementation. If no response arrives,
record the evidence-based decision and continue.

## Compatibility and migration

This feature carries backward compatibility for recordings/projects from 0.1.33.
The first slices must locate and identify the retained launch-video fixtures and
legacy catalog formats, exercise their public reads and record any field/version
differences. Migration is explicit and atomic; there is no database reset or
project rewrite. If a fixture cannot be admitted, the slice records the exact
refusal and reslices a version-aware reader before UI work continues.

The expected cost is a fixture-based proof, not a conversion project: the launch
fixture is source media, published members and journals, so current readers may
already admit it unchanged. Only a demonstrated persisted-shape difference earns
one narrow version-aware reader at its existing owner. Do not add legacy models,
duplicate pipelines or rewrite old media speculatively.

The catalog slice owns opening old catalog databases. It preserves unsupported
pre-launch files byte-for-byte and refuses them before owners open or rewrite
their rows. A future migration must be explicit, atomic and recoverable; do not
solve it by changing the format number or weakening refusal.

## Next review

After all slices pass focused checks, run the full repository/native suite once.
Before calling the feature done, run `review` (refactor-clean, code-review and
write-docs in order) and close this spec with `close-spec`.
