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

**Probe result (2026-10-13): under the bar; stopped before building.**

Setup: a scratch home, the worktree's service and CLI (and, as a control, the
installed 0.1.33 app). `narration.mov` asset 54.12–61.96 s is placed at
project 0–7.84 s, with clip `rnnoise` at mix 0.85. "okay?" is project
7.40–7.72 s. Levels come from each clip tap's PCM (`audio.get`), so they
are exactly what `rmsDbfs` would report.

| Range (project s) | Dry RMS dBFS | Processed RMS dBFS | Drop |
| --- | --- | --- | --- |
| 7.40–7.72, the whole word | −41.13 | −44.49 | **3.4 dB** |
| 7.40–7.56 | −38.64 | −41.60 | 3.0 dB |
| 7.56–7.72 | −47.58 | −57.30 | 9.7 dB |
| 1.0–1.2, room noise only | −50.82 | −66.65 | 15.8 dB |

- Both channels are identical (a mono source on a stereo tap). The sample
  peak drops 3.5 dB (−23.01 → −26.51).
- A 0.32 s excerpt read and the same window cut from the full clip render
  agree to 0.01 dB, so the processing-state domain isn't the cause.
- 0.1.33's processed PCM is byte-identical to this branch's, so the
  denoiser hasn't changed since the session.
- Mix 0.85 can take at most about 16.5 dB off (15% of the dry signal stays),
  and pure room noise reaches that.

Why one RMS over the word doesn't show the loss: the attenuation isn't
uniform. In 20 ms buckets, the loud middle (7.46–7.56 s) loses 1–4 dB, while
the onset and the soft tail (7.40–7.44 s, 7.60–7.72 s) lose 10–16 dB, the
same as noise. A whole-word RMS is dominated by its loudest 100 ms. So it
reads 3.4 dB, and the session's "14–16 dB" only appears frame by frame.

The existing primitive already gives frame-level evidence. `waveform.get`
over each tap returns linear RMS per channel and bucket for any range. With
`bucketFrames: 960`, it reproduces the table above bucket for bucket: a
10.3/8.4/14.0 dB drop at the onset and 15–16.4 dB across the tail. With one
bucket per half word, it gives the 3.3 and 16.4 dB halves. A whole-range
`rmsDbfs` in `audio.measure` would duplicate that owner, and on this word it
would point away from the loss.

**Resolution (2026-10-13, decided as the product's user): closed with no new
field.** `waveform.get` stays the one owner of short-window level. Slice 10
teaches the dry-vs-processed `waveform.get` comparison next to the
rendered-transcript diff, and slice 11 expects that comparison where the
baseline did RMS arithmetic outside Yap. The red tests below were not written.

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
