# Refusal audit (2026-10-12)

**Question** (from the product owner): does the product follow "if an
operation can produce an output, produce it and report the issues"? Refusal
would be reserved for malformed or ambiguous input, identity or revision
conflicts, resource bounds, missing prerequisites, and destructive or
irreversible actions.

A read-only code audit of `packages/{core,composition,protocol}/src`,
`apps/service/src`, `helpers/mac/Sources` and `skills/yap` at commit `ce2182e3`.

**Classes:**
- **A:** a correct refusal.
- **B:** a quality or target gate that could publish with issues.
- **C:** unclear.

**Output existed** means the work had already produced output when it
refused.

## Refusals where an output could still have been produced

| # | Site | Code / message | Trigger | Output existed | Class |
| --- | --- | --- | --- | --- | --- |
| 1 | `packages/core/src/audio-measurement.ts:87-91` (from `apps/service/src/audio-processing.ts:273`) | `NORMALIZATION_NOT_FEASIBLE` | The gain-only range or peak over the target plus tolerance | No (a trivial gain) | B |
| 2 | `audio-measurement.ts:110-116`; rethrown at `audio-processing.ts:474-495` | `NORMALIZATION_TARGETS_UNMET` | No dynamic candidate within tolerance after the bounded correction loop | **Yes**: every candidate was rendered and measured | B |
| 3 | `apps/service/src/audio-processing.ts:370-374` | `LIMITER_CEILING_UNMET` | Limiter sample peak over the ceiling by more than 1e-6 | **Yes** | B |
| 4 | `audio-measurement.ts:73-78`; `audio-processing.ts:314-317` | `NORMALIZATION_UNMEASURABLE` | Silence or non-finite stats | No gain is computable | A/C |
| 5 | `helpers/mac/Sources/YapSpeech/SpeechWindows.swift:122-146` | `TRANSCRIPT_BOUNDARY_DISAGREEMENT` | Adjacent windows disagree within ±1 s of a seam | **Yes**; `SourceTranscript.swift:82` `defer { destination.discard() }` discards it | B |
| 6 | `SourceTranscript.swift:205-215`; `WordTimingMerger.swift:59-63`; `SourceTranscript.swift:98` | `INVALID_SPEECH_TIMING` | One token or word is non-finite, out of window, or has confidence outside 0–1 | **Yes** (the other words) | B/C |
| 7 | `helpers/mac/Sources/YapFrames/TextRaster.swift:162,166,177` | `UNSUPPORTED_MEDIA` `FONT_SUBSTITUTED` / `FONT_GLYPH_MISSING` / `FONT_GLYPH_BOUNDS_UNAVAILABLE` | CoreText fell back from the pinned face | **Yes** | C |
| 8 | `helpers/mac/Sources/YapMedia/FontFile.swift:28,33` | `FONT_CHANGED`, `FONT_UNAVAILABLE` | Hash mismatch, or a PostScript name isn't unique | No | A |
| 9 | `packages/core/src/project-window.ts:82-115` | `NOT_READY` "State processing requires complete verified mono or stereo input", with an `issues[]` list | A stateful processor's inputs have gaps or an unverified layout | Partly | B/C |
| 10 | `packages/composition/src/model.ts:289-290` | "Angle group requires accepted synchronization evidence" | The caller's angle group has a refused sync receipt | Yes (the offsets are explicit) | B/C |
| 11 | `packages/composition/src/caption-sidecars.ts:80-92` | `UNSUPPORTED_FORMAT` "SRT cannot reliably preserve literal subtitle syntax; choose VTT" | Markup-like text | Yes | C |
| 12 | `apps/service/src/hdr-conversion.ts:37-72`; `helpers/mac/Sources/YapMedia/DecodedAudioInspection.swift:82` | `UNSUPPORTED_MEDIA` "…unqualified…" | Outside the qualified envelope | No | C |
| 13 | `packages/core/src/prepared-audio.ts:216-226` | `AMBIGUOUS_PREPARED_AUDIO` | Several retained policies match | Yes, several | A |
| 14 | `packages/core/src/speaker-continuity.ts:114-163`; `apps/service/src/project-service.ts:1477-1531` | Receipt `status:"refused"`, `failedGates[]`; labels never promoted, even when accepted | DER, confusion, recall, inference, RSS or control gates | Receipt only | B (labels) |
| 15 | `packages/composition/src/subject-framing.ts:89-216` | `status:"refused"` with `violations[]`; geometry still returned | Zoom, target, margin or landmark limits; null geometry when the subject is missing or ambiguous | Yes / no | B / A |
| 16 | `skills/yap/scripts/dialogue-proposals.mjs:93-113` | `PEAK_CEILING` / `GAIN_BOUNDS` / `GAIN_UNREPRESENTABLE` under `peakPolicy:"refuse"` | Predicted peak over the ceiling | Yes | B |
| 17 | `packages/core/src/frame-inspection.ts:776-781` | `SOURCE_PICTURE_UNAVAILABLE` | No picture at that time | No | A |
| 18 | Many `LIMIT_EXCEEDED` / `EVIDENCE_LIMIT` sites | Budgets | Resource bounds | — | A |
| 19 | Capture, deletion and publication guards; `MODEL_HASH_MISMATCH`, `STALE_REVISION`, `REQUEST_CONFLICT`, `PUBLICATION_CONFLICT`, `ARTIFACT_CHANGED`, `SOURCE_CHANGED`, `INVALID_*` | Identity, revision, malformed or destructive | — | — | A |

The launch-video session found two more, at the range seams:
- **`validateSourceSelection`** (`packages/composition/src/model.ts:202-222`):
  "Selected range exceeds source bounds".
- **`project-window.ts:224-229`**: "Rendering requires a nonempty range within
  the pinned project".

Both are partly valid ranges that could be clamped.

## Output-with-diagnostics patterns that already exist

There is no shared diagnostics type. The protocol has only
`operationErrorSchema` (`packages/protocol/src/index.ts:25`). The ad hoc
patterns:
- **`unavailable: SelectionRange[]`** across audio, acoustic, projection and
  processing-state results.
- **`ArtifactStatus`** `{state, reason, retryable}` (`packages/core/src/jobs.ts:110-116`),
  plus `ok:true` with `state:"refused"`:
  - `face.trajectory.get` (`project-service.ts:1209-1217`);
  - scenes (`scene-processing.ts:137-140`).
- **Receipts with `status` and gate lists:**
  - speaker continuity, `failedGates` (`speaker-continuity.ts:88-104`);
  - `synchronizationEvidenceSchema` (`composition/src/schema.ts:611-620`);
  - alignment, `conditionalStatus`.
- **Per-item reasons inside successful results:**
  - alignment `timingReason`;
  - face `prediction.state`;
  - transcript segments `skipped/too_short`.
- **The caption sidecar** returns `omitted[]`, `addedOverlaps[]` and
  `discardedStyling[]` with its content (`caption-sidecars.ts:158-165`). This
  is the closest existing match to the principle.
- **Draft `violations[]`:**
  - `subject-framing.ts`;
  - `skills/yap/scripts/caption-proposals.mjs`.
- **Opt-in degradation:** `dialogue-proposals.mjs` `peakPolicy:"cap-gain"`.

## Docs that state the opposite principle

- `specs/done/video-editing-feedback/README.md:43-46`: "A failed quality gate
  is a product boundary, not a reason to loosen a tolerance…"
- `packages/core/README.md:34-36`: "…refuses infeasible or missed requested
  targets."
- `apps/service/README.md:222-223`: "…a dynamic request also refuses a missed
  target."
- `apps/service/README.md:217-219`: "descriptor exhaustion refuses work
  without publishing a partial signal." (This is a resource bound, so it's
  correct.)
- `packages/composition/README.md:51-52`: "Format-specific refusal protects
  literal text…"
- `packages/composition/README.md:93-94`: "unavailable requirements refuse
  rather than silently selecting another result."
- `packages/composition/README.md:106`.
- `skills/yap/references/media-workflows.md`:
  - L50-52: "when a seam is refused";
  - L118: "Missing source support is a refusal";
  - L156: "An unsupported source remains a refusal";
  - L167-168.
- `skills/yap/references/dialogue-finishing.md:43`: "Strict refusal requires
  investigation…"
- `helpers/mac/README.md:107`.

Nothing written states "produce output by default".
