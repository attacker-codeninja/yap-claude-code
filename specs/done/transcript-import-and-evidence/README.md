# Transcript import and agent evidence

Yap lets an agent bring in a transcript from a human, another model, or an editor and use it as evidence without turning the import into an editorial decision. The shipped contract preserves the supplied source and lets the caller explicitly choose whether to trust its timing or request audio alignment. It also exposes read-only filler, pause and speaker evidence plus reversible project speaker corrections.

## Why this shape

Caption files often know where a cue begins and ends but do not know where each word occurs. Treating every cue as a speech transcript would manufacture timing that the source never supplied. Imported generations therefore have a cue-owned store and remain distinct from model-generated word transcripts. The ordinary transcript read/search operations still provide the agent-facing access point.

Supplied timing is the default because an explicit import request means the caller chose that source. Alignment is opt-in and reuses the existing alignment owner, so model readiness, bounded audio windows, receipts and retry behavior have one home. Alignment adds measured evidence beside the supplied cue; it does not rewrite the imported text or timing.

A package must remain useful after the original caption path disappears. Imported resources therefore carry the raw source member, digest and size, parser and metadata, cue rows, timing policy, and source dependencies. Adoption verifies those inputs and restores the same generation without rerunning inference.

## Invariants

- Imported bytes, parser identity, cue boundaries, text, supplied timestamps, supplied word timing, speakers and source metadata remain recoverable.
- `timingPolicy: "supplied"` performs no alignment. `"align"` is explicit and retains supplied and derived evidence together.
- Cue-only timing stays cue-level evidence. No operation spreads a cue over words to invent timings.
- Imported speaker labels are caller-authored labels. They do not become acoustic identity and project corrections do not rewrite the imported source.
- Search is read-only, case-folds and ignores outer punctuation, and matches consecutive words within one cue. It never joins cues or manufactures word IDs for cue-only timing.
- Filler and pause observations describe measured evidence, settings and coverage. They never authorize a cut or mutate a revision.
- Speaker corrections use the existing project revision, undo and restore owners. A correction targets the occurrences the caller names.
- Optional model downloads are error-directed. Agents call the requested operation directly; only a `MODEL_NOT_PREPARED` response supplies the details needed to ask a user before calling `model.prepare`.
- CLI and MCP use the shared protocol operation catalog and replay behavior.

## Code map

The parser and durable imported source owner are in [packages/core/src/transcript-import.ts](../../../packages/core/src/transcript-import.ts) and [packages/core/src/imported-transcript.ts](../../../packages/core/src/imported-transcript.ts). The package resource graph and archive member rules live in [packages/core/src/project-package.ts](../../../packages/core/src/project-package.ts), with export/adoption orchestration in [apps/service/src/project-packages.ts](../../../apps/service/src/project-packages.ts). The public operation dispatch, imported reads, search and alignment joining are in [apps/service/src/project-service.ts](../../../apps/service/src/project-service.ts); operation schemas are shared from [packages/protocol/src/operations.ts](../../../packages/protocol/src/operations.ts).

Behavior is pinned by the core import tests in [packages/core/src/transcript-import.test.ts](../../../packages/core/src/transcript-import.test.ts), protocol operation tests, and the existing service/package contract suites. The repository's refusal ledger records every new refusal literal; imported package round trips share the same package validation and adoption owners.

## Decisions that differed from the initial plan

The implementation keeps imported generations in a dedicated source-owned store rather than extending the ASR word tables. Alignment remains per-cue work owned by the existing alignment processor instead of a second imported-alignment engine. Package integration then made imported generations first-class resources so raw bytes, cue data and the alignment recipe survive transfer. Imported search was added during integration because an empty result would make an imported transcript unusable as agent evidence. Project speaker corrections remain project-owned edits; importing a transcript does not silently attach it to a revision.

There are no visual baselines for this feature: it is an agent-facing data and media contract with no UI editor or rendered checkpoint.
