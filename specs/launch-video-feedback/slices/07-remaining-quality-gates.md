# 07 The remaining quality gates publish with issues

**Why it's here.** The product owner asked whether "output by default" holds
across the product. A refusal audit (2026-10-12) found more quality gates on
cheap, undoable work beyond the ones slices 03, 04 and 06 fix. Each is decided
below as the product's user, then the slice 02 contract applies. These are
independent fixes, one commit each, each with its existing tests flipped red
first.

| # | Gate today | After |
| --- | --- | --- |
| a | `UNSUPPORTED_MEDIA` `FONT_SUBSTITUTED` / `FONT_GLYPH_MISSING` / `FONT_GLYPH_BOUNDS_UNAVAILABLE` (`helpers/mac/Sources/YapFrames/TextRaster.swift:162,166,177`): CoreText fell back from the pinned face | Render with the fallback CoreText already chose. Attach `font-substituted` or `glyph-missing` with the affected characters and the face actually used. A visibly wrong glyph is easy to judge from the frame; a refusal hides it. |
| b | `NOT_READY` "State processing requires complete verified mono or stereo input" (`packages/core/src/project-window.ts:82–115`) throws the `issues[]` it already built | Process the available support. Unavailable ranges stay `unavailable` (never silence). The already-built list becomes the result's `issues`. |
| c | `invalid("Angle group requires accepted synchronization evidence")` (`packages/composition/src/model.ts:289–290`) | Accept the caller's explicit offsets. Attach `sync-evidence-refused` with the receipt reference. The caller authored the relationship; the evidence is information. |
| d | `UNSUPPORTED_FORMAT` "SRT cannot reliably preserve literal subtitle syntax; choose VTT" (`packages/composition/src/caption-sidecars.ts:80–92`) | Write the SRT. Attach `srt-literal-markup` listing the cues a reader may render as markup, suggesting VTT. |
| e | `UNSUPPORTED_MEDIA` "unqualified" HDR declarations or interpretation (`apps/service/src/hdr-conversion.ts:37–72`) and "Decoded audio has unqualified format" (`helpers/mac/Sources/YapMedia/DecodedAudioInspection.swift:82`) | Convert or decode anyway. Attach `unqualified-source` with the declarations seen. The original stays untouched, so a wrong-looking derivative costs nothing. **Exception:** if the decoder can't produce samples at all, that's a missing prerequisite and still refuses. |
| f | Speaker continuity never promotes labels, even for an accepted receipt (`packages/core/src/speaker-continuity.ts:114–163`; `apps/service/src/project-service.ts:1477–1531`) | Publish the continuity labels. Each failed gate (DER, identity confusion, overlap recall, inference factor, peak RSS, controls) becomes an issue on the labels. Labels remain anonymous until the caller binds names. |
| g | Subject framing returns `status: "refused"` with geometry and `violations[]` (`packages/composition/src/subject-framing.ts:89–216`) | It already produces output: rename to issues and drop the "refused" status where geometry exists. When geometry is null (`subject_missing` / `subject_ambiguous` / `subject_out_of_bounds` / `source_bounds`), it stays a refusal (class A). |
| h | `skills/yap/scripts/dialogue-proposals.mjs:93–113` `peakPolicy: "refuse"` (`PEAK_CEILING` / `GAIN_BOUNDS` / `GAIN_UNREPRESENTABLE`) | `cap-gain` becomes the only behaviour: the draft is produced and states the unmet loudness as an issue. Delete the `refuse` option, because one rule beats an opt-in strictness flag. Update `skills/yap/references/dialogue-finishing.md`. |

**Unchanged (class A, confirmed by the audit):**
- identity and revision guards: `STALE_REVISION`, `REQUEST_CONFLICT`,
  `PUBLICATION_CONFLICT`, `ARTIFACT_CHANGED`, `SOURCE_CHANGED`,
  `MODEL_HASH_MISMATCH`;
- malformed `INVALID_*` input;
- resource budgets: `LIMIT_EXCEEDED` / `EVIDENCE_LIMIT`;
- `AMBIGUOUS_PREPARED_AUDIO`;
- font identity: `FONT_CHANGED` / `FONT_UNAVAILABLE`;
- missing picture: `SOURCE_PICTURE_UNAVAILABLE`;
- capture, deletion and publication guards.

**Red tests.** Each row's existing refusal test becomes a "publishes with
issue X" test asserting the output and the issue. Rows (a) and (e) need a
native or real-media check:
- (a) render one frame with a pinned face that lacks a glyph;
- (e) the existing HDR fixture.

**Must stay green.** Every class-A test listed above.

**Delegated.** Issue code spellings, and whether (f)'s labels carry a
per-label or a receipt-level issue list.

**Visual check.** Row (a) changes a rendered frame. Accept it with
[screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on
the fallback frame.
