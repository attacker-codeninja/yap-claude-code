# 04 Explicit normalization miss policy

**Open decision B.** Default, applied if the user hasn't answered: the
`normalization` processor gains an explicit
`onMiss: "refuse" | "publish"`, defaulting to `"refuse"`.
- With `"publish"`, the best attempt within the bounded correction policy is
  delivered.
- Its evidence carries `normalization.unmet: ["truePeak" | "integrated" |
  "range", …]`, with the excess from slice 03.

Nothing is loosened silently. The caller chose to accept a miss, and the miss
is recorded.

**Why.** In the session, a −14.1 LUFS / −1.8 dBTP result against −14 / −2 was
refused: the true peak was 0.2 dB over the ceiling, which is 0.05 dB beyond the
0.15 dB allowance. That blocked every render and
measurement path. A best-effort mode keeps the honesty without the deadlock.

**Seam.**
- `packages/composition/src/schema.ts`: the normalization processor schema
  adds `onMiss`.
- `packages/core/src/audio-measurement.ts` `admitNormalization`: publish with
  unmet targets instead of throwing, when `onMiss` is `"publish"`.
- The correction loop in `apps/service/src/audio-processing.ts` (L434–497)
  returns its best attempt.
- The strict schema (`audioProcessingEvidenceSchema`) gains `unmet`. Old
  evidence regenerates through slice 03's implementation id.

**Red tests first (`apps/service/src/audio-processing.test.ts`).**
- `onMiss: "publish"` with a +0.2 dB true-peak miss publishes, with `unmet`.
- The default still refuses exactly as before.

**Must stay green.** Every existing refusal test; tolerances.

**Delegated.** The exact names (`onMiss`, `unmet`).

**Would change this slice.** If the user picks the alternative ("keep
refusing, report more"), this slice reduces to slice 03 and is closed as not
needed. Record that here.
