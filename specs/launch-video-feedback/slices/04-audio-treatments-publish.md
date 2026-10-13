# 04 Audio treatments publish their best result (decision B)

**Decision B, revised by the product owner (2026-10-12).** There is no opt-in
flag. Normalization and limiting always publish their best result, with issues
attached.

**When gain-only targets conflict, the peak ceiling wins.** The gain is
`min(target − integrated, ceiling − truePeak)`, and the loudness target is
reported as unmet.
- Applying the full requested gain would ship clipped audio. Receipt 05 asked
  for +6.4 dB on a +0.3 dBTP input, about +6.7 dBTP, and the encode would
  hard-clip it.
- A ceiling is a limit by definition. Loudness is the softer target.
- Rejected: apply the requested gain and report the peak excess. That
  publishes damaged audio.

| Today (refuses) | After |
| --- | --- |
| `NORMALIZATION_NOT_FEASIBLE` (`packages/core/src/audio-measurement.ts:87–91`) | Apply the ceiling-limited gain. Issue `normalization-target-unmet` with the requested and achieved values, the excess per target, `peakToLoudnessDb` (true peak − integrated) and `maximumFeasibleTargetLufs` (ceiling − true peak + integrated). |
| `NORMALIZATION_TARGETS_UNMET` (`audio-measurement.ts:110–116`; `apps/service/src/audio-processing.ts:474–495`) | Publish the best candidate. Every candidate is already rendered and measured today, then thrown away. "Best" is the smallest total excess, ties broken by candidate index. Same issue code, plus `attempts` and `stopReason`. |
| `LIMITER_CEILING_UNMET` (`audio-processing.ts:370–374`) | Publish the limited signal. Issue `limiter-ceiling-unmet` with the measured peak and the ceiling. |
| `NORMALIZATION_UNMEASURABLE` (L73–78, L314–317) | Pass the audio through at unity gain. Issue `normalization-unmeasurable` with the reason. |
| **Read- and import-time re-admission:** `checkProjectAudioResult` (`packages/core/src/audio-inspection.ts:945–946`), reached from `prepared-audio.ts:282` and package import `:443` | It no longer re-runs the refusing gates. It checks that the stored issues equal those derived from the stored evidence; a mismatch is `ARTIFACT_CHANGED` or `INVALID_PACKAGE` (class A). Without this, every read would keep refusing even after the producer is fixed. |
| `SourceChannelPCM` `UNAVAILABLE_SUPPORT` (`helpers/mac/Sources/YapAudio/SourceChannelPCM.swift:45`), which refuses unless the whole range has support | Publish the supported samples, with `unavailable` ranges (never silence) and an issue. This matches every other audio read. |

**Consequences:**
- A missed target no longer blocks a movie export. The export receipt carries
  the issue.
- `audio.measure` on any tap or range no longer fails because of the output
  stack. Whole-domain state semantics don't change, and the issues travel to
  every read of that domain.

**Seam.**
- `audio-measurement.ts` `normalizationGain` and `admitNormalization` return
  `{ result, issues }` instead of throwing.
- The correction loop returns its best attempt.
- The movie-export audio postconditions consume issues.
- Issues are stored in `output_issues` (slice 01). Retained evidence objects
  don't change.
- **Identity bumps (rule from slice 02):**
  - `bounded-offset-normalization` → `bounded-offset-normalization-v2`;
  - `linked-mono-max-limiter-v1` → `linked-mono-max-limiter-v2`;

  both at `audio-processing.ts` ~L48. Failed 0.1.33 jobs then re-run instead
  of answering "failed".
- Tolerance literals don't change. They decide whether an issue is raised.
- Remove these codes from the ledger's `pendingConversion` (slice 01):
  `NORMALIZATION_NOT_FEASIBLE`, `NORMALIZATION_TARGETS_UNMET`,
  `LIMITER_CEILING_UNMET`, `NORMALIZATION_UNMEASURABLE`.

**Probe (for the record).** Use an output normalization that can't meet its
target, and measure four reads:
- a track tap;
- the output `dry` tap;
- the output tap after the step before normalization;
- a ranged processed output.

All four succeed after this slice. Record what the FEEDBACK track-tap claim
turned out to be.

**Red tests first.**
- `apps/service/src/audio-processing.test.ts`: the refusal assertions near
  L331, L405, L433, L618, L660, L674, L708, L747, L1013 and L1091 become
  "published with issues". Each asserts the issue evidence and the measured
  values of the published PCM. The gain-only case asserts the ceiling won.
- `packages/core` prepared-audio read and import tests: retained 0.1.33
  evidence still reads; a tampered issue fails.
- `project-audio.test.ts` (~L270): the four-read probe.
- Slice 02's failed-job test turns green.
- A movie export with an unmet target completes, and its receipt carries the
  issue.

**What a human can see.** Replay the session's mastering stack. It delivers on
the first try, and the issues name the excess and the maximum feasible target.

**Docs:**
- `apps/service/README.md` L221–238: "measured postconditions become issues on
  the published audio". Keep L217–219 (descriptor exhaustion): that's a
  resource bound.
- `packages/core/README.md` ~L34–36: publishes the selected candidate with an
  issue per missed target.
- `helpers/mac/Sources/YapAudio/README.md:45`: a coverage gap becomes
  `unavailable` plus an issue. L56 (non-finite output) stays.

**Must stay green.** Descriptor-exhaustion refusals and all class-A tests.

**Delegated.** Field names inside `evidence`.
