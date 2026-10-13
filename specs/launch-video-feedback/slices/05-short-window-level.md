# 05 Short-window level for word-sized ranges

**Unlocks.** `audio.measure` reports `rmsDbfs` per channel, defined for any
duration. Integrated loudness returns `insufficient-duration` for a 0.32 s
word, which is why the session had to measure RMS outside Yap.

With this field, a caller can compare the dry tap with the processed tap over
one word's range and see what denoise removed. The product sets no threshold
for "lost"; the caller decides (zero editorial decisions).

**Seam.**
- `packages/core/src/audio-measurement.ts`: `loudnessMeasurementSchema` gains
  `rmsDbfs`.
- The meter in `apps/service/src/acoustic-inspection.ts` (~L283 measure path)
  computes it from the same selected PCM.
- Bump the meter's implementation identity so cached measurements regenerate.
  This relies on slice 02's pattern.

**Probe first.** On `fixtures/launch-video/narration.mov`, place a clip of
asset time 54.12–61.96 s with `rnnoise` at mix 0.85. Measure the dry tap and
the processed tap over the "okay?" word: asset time 61.52–61.84 s, mapped to
project time. The session saw about 14–16 dB of loss.
- If `rmsDbfs` shows at least ~10 dB, the field is sufficient.
- If not, record why here and rethink the measure before building more.

**Red tests first.**
- `packages/core` measurement-schema tests: `rmsDbfs` is present for a 0.3 s
  range, where integrated loudness is null with `insufficient-duration`.
- `apps/service/src/project-audio.test.ts`: a synthetic attenuated burst
  between dry and processed taps shows the expected drop.
- The fixture probe above is the one real-media check.

**Must stay green.** The existing loudness, true-peak and LRA fields and their
null reasons.

**Delegated.** Whether to also report peak per channel; field placement within
the measurement object.
