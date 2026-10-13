# 04 Audio treatments publish their best result (decision B)

**Decision B, revised by the product owner (2026-10-12).** There is no opt-in
flag. Normalization and limiting always deliver their best result, and attach
issues when the target isn't met. The caller sees exactly how far off it is and
decides; undo is one revision away.

**Unlocks.**

| Today (refuses) | After |
| --- | --- |
| `NORMALIZATION_NOT_FEASIBLE`: gain-only can't meet the range or peak ceiling (`packages/core/src/audio-measurement.ts:87–91`) | Apply the closest feasible gain. Attach `targets-unmet` with `details`: the requested targets, the achieved values, the excess per target, `peakToLoudnessDb` (true peak minus integrated) and `maximumFeasibleTargetLufs` (integrated + ceiling − true peak). |
| `NORMALIZATION_TARGETS_UNMET`: dynamic misses after the bounded correction loop (`audio-measurement.ts:110–116`, `apps/service/src/audio-processing.ts:474–495`) | Publish the best candidate already rendered and measured; today the `attempts` array is computed and thrown away. Same `targets-unmet` issue, plus `attempts` and `stopReason`. |
| `LIMITER_CEILING_UNMET` (`audio-processing.ts:370–374`) | Publish the limited signal. Attach `ceiling-unmet` with the measured excess. |
| `NORMALIZATION_UNMEASURABLE` on silence or non-finite statistics (L73–78, L314–317) | Pass the audio through unchanged. Attach `unmeasurable` with the reason. |

**Consequences that fix the session's pain.**
- A missed target no longer blocks a movie export. The export carries the
  issues in its receipt.
- `audio.measure` on any tap or range no longer fails because of the output
  stack. The measurement itself reports the issues it inherited.
- **The probe still runs, for evidence.** With an output normalization that
  can't meet its targets, measure four taps: a track tap, the output `dry` tap,
  the output tap after the step before normalization, and a ranged read of the
  processed output. All four now succeed. Record what the track-tap claim in
  FEEDBACK turned out to be.

**Seam.**
- `audio-measurement.ts` `normalizationGain` and `admitNormalization` return a
  result with issues instead of throwing.
- The correction loop returns its best attempt, chosen by smallest total
  excess.
- The movie-export audio postconditions consume issues instead of refusing.
- Tolerances don't change. They now decide whether an issue is emitted.
- Rename the implementation id to `bounded-offset-normalization-v2`
  (`audio-processing.ts` ~L48). Slice 01 makes it part of the job key, so
  0.1.33 failures re-run.
- The evidence schema (`audioProcessingEvidenceSchema`) gains `issues` from
  slice 02.

**Red tests first (`apps/service/src/audio-processing.test.ts`).** The existing
refusal tests (L405, L618, L674, L1013) become publish-with-issues tests, each
asserting:
- the issue codes and the excess figures;
- the published PCM's measured values;
- for the dynamic case, that the chosen attempt is the best of `attempts`.

Plus:
- the four-tap probe;
- a movie export with an unmet target completes, with the issue in its receipt.

**What a human can see.** Replay the session's mastering stack. It delivers on
the first try, and the issues name the true-peak excess and the maximum
feasible target.

**Docs:**
- `apps/service/README.md` L217–238: the feasibility arithmetic, best-attempt
  selection, and issues.
- `packages/core/README.md` ~L34–36: rewritten by slice 02.

**Must stay green.**
- The tolerance literals.
- The measurement fields.
- Descriptor-exhaustion refusals. Those are resource bounds, class A.

**Delegated.**
- The best-attempt tie-break.
- Whether the limiter issue reports sample peak and true peak, or sample peak
  only.
