# 03 Normalization refusals answer the question

**Unlocks.** A refused normalization tells the caller how to fix it in one
step instead of four. Both refusals gain detail:

- **`NORMALIZATION_NOT_FEASIBLE`** reports:
  - `peakToLoudnessDb`, which is true peak minus integrated loudness;
  - `maximumFeasibleTargetLufs`, which is integrated + ceiling − true peak,
    plus the true-peak tolerance.

  Receipt 05 would have said 20.7 dB, about −21.55 LUFS. The reason text
  names the taps that stay readable: the output `dry` tap and `after-step`.
- **`NORMALIZATION_TARGETS_UNMET`** reports the excess per target. The
  session's dynamic miss was +0.2 dB true peak against a 0.15 dB allowance.

**Seam.**
- `packages/core/src/audio-measurement.ts`: `normalizationGain` (L72–93) and
  `admitNormalization` (L110–117) add the details.
- Rename the implementation id to `bounded-offset-normalization-v2`
  (`apps/service/src/audio-processing.ts` ~L48). Slice 01 makes it part of
  the job key, so prepared normalization evidence and failed jobs from 0.1.33
  re-key and re-run.
- Tolerances don't change.

**Probe first: does a track tap survive?** The feedback's claim is unverified.
Use an output stack with an infeasible gain-only normalization, extending the
fixture at `apps/service/src/audio-processing.test.ts` ~L618, and measure:
1. a track tap (processed);
2. the output `dry` tap;
3. the output tap after the step before normalization;
4. a ranged read of the processed output.

Expected: 1–3 succeed, because `compiler.ts:296–331` selects only the steps on
the tap's path. 4 refuses, because state domains cover the whole program
(`packages/core/README.md` ~L37).
- If 1–3 succeed, record the result here and don't touch pruning.
- If 1, 2 or 3 fails, fixing the pruning becomes part of this slice.

**Red tests first.**
- `audio-processing.test.ts`: the refusal details for the L618 and L674 /
  L708 cases.
- The four-tap probe, in `project-audio.test.ts` or `audio-processing.test.ts`.

**What a human can see.** Replay receipt 05: the refusal reports the maximum
feasible target and points at the readable taps.

**Docs.**
- `apps/service/README.md` L221–238: the feasibility arithmetic, and which
  taps stay readable.
- `packages/core/README.md` ~L37: unchanged, plus a pointer.

**Must stay green.**
- Every `normalizationTolerance` literal.
- The existing refusal tests (L405, L618, L674, L1013).

**Delegated.** Field names, and whether to round the maximum target.
