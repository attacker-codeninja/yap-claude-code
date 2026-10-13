# 07 The remaining gates: publish, or justify the refusal

The product owner asked whether output by default holds across the product.
The [refusal audit](../assets/refusal-audit.md), re-verified by the
principle-coverage draft, found the sites below beyond slices 03, 04 and 06.
Each one was decided by the product's user. Where the four drafts disagreed,
the alternative is recorded.

These are independent sub-slices, one commit each. In each one:
- the existing test flips to red first;
- its codes leave the ledger's `pendingConversion`, or are classified `A`
  with a reason;
- its docs line changes in the same commit.

| Sub | Site | Decision | Why / alternative |
| --- | --- | --- | --- |
| a | Font fallback: `FONT_SUBSTITUTED`, `FONT_GLYPH_MISSING` (`helpers/mac/Sources/YapFrames/TextRaster.swift:162,166`; `YapMedia/FontFile.swift:36`, where it hides as message text inside `UNSUPPORTED_MEDIA`) | **Publish** with `font-substituted` / `glyph-missing`, carrying the requested face, the face used and the missing code points. `FONT_GLYPH_BOUNDS_UNAVAILABLE` stays **A**: nothing can be laid out. | A wrong glyph is visible and easy to judge in the frame. The risk-first draft argued for refusing, because the fallback depends on the machine's installed fonts, so renders aren't reproducible. Kept as the alternative; the issue records the face actually used. |
| b | Stateful processing `NOT_READY` (`packages/core/src/project-window.ts:82–115`; native `CompositionState.swift:184`) | **Gaps:** process each available run as its own state domain, with `unavailable` ranges and a `support-gap` issue. **An unverified channel layout** stays **A** (ambiguous). | Never silence. Splitting at gaps changes what a stateful processor sees across a gap; the issue says so. Alternative: keep refusing (fewest-slices draft). |
| c | Angle group with refused sync evidence (`packages/composition/src/model.ts:289–290`) | **Publish** the group with `synchronization-evidence-refused` on the edit result. | The caller wrote the offsets; the evidence is information. All drafts agree. |
| d | SRT literal markup (`caption-sidecars.ts:80–92`) | **Write** the SRT unchanged, with `srt-literal-markup` listing the placements and suggesting VTT. | All drafts agree. |
| e | HDR or decoded-audio "unqualified" (`apps/service/src/hdr-conversion.ts:37–72`; `DecodedAudioInspection.swift:82`; and `YapFrames/VideoColorPolicy.swift:26`) | **Stay A.** Disagreeing declarations are ambiguous input; HDR interpretation is a missing prerequisite the caller supplies. | Three of four drafts. No issue could describe what's wrong in such an output, so it would be silently wrong colour. Improve the message so it names the conflicting declarations. |
| f | Speaker continuity `failedGates` (`speaker-continuity.ts:88–163`) | **Vocabulary only.** `failedGates` becomes `issues` on a `ready` receipt. | The audit said labels are "never promoted". But no label publisher exists, so that's a missing feature, not a refusal. Out of scope. |
| g | Subject framing `status:"refused"` with geometry (`subject-framing.ts:89–216`) | **Migrate** to `ready` plus issues where geometry exists. Null geometry becomes `unavailable` (**A**). | Only `packages/test-harness/editing/subject-observations.mjs` uses it. The principle-coverage draft suggested deleting it; kept because the harness uses it. |
| h | `skills/yap/scripts/dialogue-proposals.mjs:93–113` `peakPolicy:"refuse"` | **Delete the policy.** Always propose the constrained gain, with issues. `GAIN_UNREPRESENTABLE`, `MISSING_SUPPORT`, `TOO_SHORT` and `UNMEASURABLE` become `unavailable` plus an issue. | One rule, no opt-in strictness. Update `skills/yap/references/dialogue-finishing.md:43`. |
| i | Status words: `state:"refused"` (`project-service.ts:1212`) and prediction `"refused"` (`face-trajectory.ts:170`) | Rename to `unavailable` plus an issue. | These are class A in substance, but "refused" in a successful result breaks the ledger's rule 5. |
| j | Alignment `conditionalStatus:"refused"` (`alignment-operands.ts:71`, `alignment-evidence.ts:43`) | Raw evidence keeps the worker's own word. The published view maps it to an issue. | Same rule. |
| k | Caption sidecar `omitted` / `addedOverlaps` / `discardedStyling` (`caption-sidecars.ts:158–165`, projected at `exports.ts:118`) and `caption-proposals.mjs` `violations[]` | **Migrate** to `issues` and delete the old fields. | Already compliant in behaviour; this is one owner for the vocabulary. |

**Stay A, confirmed:**
- identity and conflict guards: `STALE_REVISION`, `REQUEST_CONFLICT`,
  `PUBLICATION_CONFLICT`, `ARTIFACT_CHANGED`, `SOURCE_CHANGED`,
  `MODEL_HASH_MISMATCH`;
- malformed input: `INVALID_*`;
- resource bounds: `LIMIT_EXCEEDED`, `EVIDENCE_LIMIT`;
- ambiguity: `AMBIGUOUS_PREPARED_AUDIO`;
- font identity: `FONT_CHANGED`, `FONT_UNAVAILABLE` (`FontFile.swift:29`,
  which must become a real code, per the ledger's rule 4);
- missing picture: `SOURCE_PICTURE_UNAVAILABLE`;
- manifest validation: `fresh-delivery-check.mjs` (malformed);
- capture, deletion and publication guards.

**Visual check.** Sub (a) changes a rendered frame. Accept it with
[screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on
the fallback frame. Use a pinned face that lacks one glyph.

**Docs:**
- `packages/composition/README.md:51–52`: "SRT keeps the text and reports
  markup a reader could interpret".
- `helpers/mac/Sources/YapAudio/README.md:45`.
- `skills/yap/references/media-workflows.md` L118 and L156 stay as class A.

**Must stay green.** Every class-A test above.

**Delegated.**
- Issue code spellings, which go in the registry.
- Whether (b)'s per-run split happens natively or in the compiler. Use
  whichever already owns state domains (`processing-state.ts`).
