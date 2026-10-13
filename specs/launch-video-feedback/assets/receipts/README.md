# Retained failure receipts

Raw `yap` 0.1.33 output saved during the launch-video session (2026-10-12).
Each file is the operation's actual stdout, unedited. They prove only what each
one shows: the refusal, its code, and its wording at that release.

| File | Feedback item | What it shows |
| --- | --- | --- |
| `01-review-seam-disagreement.json` | Transcription seams | `transcript.review` on the full 3:52 narration fails with `TRANSCRIPT_BOUNDARY_DISAGREEMENT` at the 120 s internal seam (word "I"), not retryable. |
| `02-end-of-media-overrun.json` | End-of-media overrun | `transcript.prepare` with an exact fractional end (`695104000/3`) still fails with `INVALID_SPEECH_TIMING`. The last token's estimate runs ~20 ms past physical end. |
| `03-ranged-seam-disagreement.json` | Ranged windowing | An explicit `executionRange` of 119–230 s is split into internal windows and fails at the 219 s seam. |
| `04-chunk-window-overrun.json` | End-of-window overrun | A caller window ending at 231.5 s refuses on an estimate of 231.56 s. |
| `05-measure-normalization-infeasible.json` | Mastering | `audio.measure` (default output tap, an 11 s range) fails with `NORMALIZATION_NOT_FEASIBLE` because the output stack holds a gain-only normalization that's infeasible over the whole program. The leading `audio.measure: failed` line is stderr: the session captured with `2>&1`. The CLI keeps them separate. |
| `07-clip-curve-clock-error.json` | Curve clock error | Integer `at` keys on a clip opacity curve give `Processing curve must match its clock…`, with no hint that clip curves take fractions of clip duration. |
| `08-place-exceeds-source.json` | Place bounds error | Placing an 11.46 s slot from an 11.444 s movie gives `Selected range exceeds source bounds`, with no asset end in the message. |
| `09-render-range-past-end.json` | Render range admission | `transcript.render.prepare` past the project end is admitted as a job, then fails with `Rendering requires a nonempty range within the pinned project`. |

Not retained:
- The dynamic-mode normalization miss (−14.1 LUFS / −1.8 dBTP against a −14 / −2 request); its receipt was overwritten by a later successful measurement. FEEDBACK.md records the figures.
- The rnnoise word-loss measurements; those were RMS readings taken outside Yap. FEEDBACK.md records the numbers.
