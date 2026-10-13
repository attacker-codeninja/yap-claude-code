# 03 Long-media transcription always publishes

**Unlocks.** `transcript.prepare` and `transcript.review` publish a complete
transcript for any readable media. No local problem fails the job; each
becomes an issue on the affected word, using slice 01's contract.

| Today (refuses the whole job) | After |
| --- | --- |
| A seam disagreement (`TRANSCRIPT_BOUNDARY_DISAGREEMENT`) | Words go to the window whose core holds their start; unpaired observations get `boundary-unresolved` (decision A). |
| An estimate past the decoded edge (`INVALID_SPEECH_TIMING` "exceeds interval"), whether at the physical end of media or a caller's window end | The estimate is clamped to the edge, with `timing-clamped` and the original seconds in `details`. |
| A malformed token or word (non-finite or reversed time, confidence outside 0–1) | The word is dropped, with `word-dropped` and the raw observation in `details`. Its neighbours publish. |

- **Raw evidence keeps every candidate and the original engine values.** Today
  a throw discards the whole `raw.jsonl` (`SourceTranscript.swift`
  `defer { destination.discard() }`).
- **Still refused (class A):**
  - the request range exceeds the source (`transcript-processing.ts:230–237`);
  - the 256 MiB evidence budget;
  - a missing model.

**Seam.**
- `helpers/mac/Sources/YapSpeech/SpeechWindows.swift`:
  - `SpeechBoundaryMerge.resolve` (L100–154) returns a resolution
    (`agreed` | `start-owned` plus unpaired observations).
  - Delete `refuse()` and the `TRANSCRIPT_BOUNDARY_DISAGREEMENT` path.
- `SourceTranscript.swift`:
  - `sourceSpan` (L202–218) clamps instead of throwing;
  - malformed words are dropped and recorded;
  - the 28 s decode bound stays.
- `WordTimingMerger.swift:59–63`: same rule.
- **Identity bump, once** (the rule from slice 02): recipe `source-windows-20s-context4s-guard1s-v3`
  (`SpeechWindows.swift` L5, `packages/core/src/transcript.ts:32`) and policy
  `transcript-v4`. Slice 02 turns the bump into regeneration.
- **Core:** per-word issues are stored in `output_issues` (slice 01), with
  `at` holding the word ordinal. They're derived from the raw file at index
  time, so the package format doesn't change. Words returned by
  `transcript.get`, `transcript.review` and `transcript.render.get` carry
  their issues.
- **Ledger:** remove `TRANSCRIPT_BOUNDARY_DISAGREEMENT` and the overrun use of
  `INVALID_SPEECH_TIMING` from `pendingConversion`. Malformed input that
  can't even be read stays classified `malformed`.

**Probes first. They choose the method; whether to publish is already decided.**
1. **Seam replay and determinism.** On `fixtures/launch-video/narration.mov`,
   use the test-only SpeechLab target, not production `transcript.prepare`.
   Production discards the raw file on failure, and a ranged capture of the
   219 s right window would hit the end-of-media overrun first.
   - Dump each window's observations for the decoded windows
     `SpeechWindows.plan` computes (100–120/120–140 and 199–219/219–230,
     each with 4 s context), plus the final window that runs past the end.
   - Run inference twice and compare the raw SHA-256s. If they differ, seam
     acceptance uses retained observations only.
   - retain each `raw.jsonl` as a boundary case;
   - `main.swift --boundary-cases` reproduces both disagreements twice;
   - also decode each seam shifted ±0.25 s and ±0.5 s. If a fixed shift set
     resolves the seams, try it before falling back to start-owned, and record
     the shift in the word's details.
2. **Overruns.** Read the raw token timings for 215 s to the end and for
   219–231.5 s. The observed overruns were 19 ms and 60 ms. Record the
   engine's frame duration in this slice. Clamping is unconditional; this is
   only context for the issue's `details`.

**Probe results (2026-10-13, yap-native at 37a3e487, real inference on
`narration.mov`).** Each window was decoded alone through `speech.transcribe`
with an `executionRange` that reproduces the plan's decoded window, so no seam
or overrun could discard its `raw.jsonl`. The four seam windows (two runs each)
are retained in [`assets/03-seams`](../assets/03-seams/boundary-cases.json).

1. **Seams.** `YapSpeechTests --boundary-cases` on the retained windows
   reproduces both disagreements twice with the old matcher, and resolves both
   twice with the new one.
   - **Determinism.** The raw SHA-256s differ between runs, but only in
     `result.processingTime`. Observations, tokens and text are identical, so
     seam acceptance uses retained observations only.
   - **120 s.** The right window (decoded from 116 s) hears nothing before
     "We" at 119.28 s. The left window's "I" [119.12, 119.20] and "mean,"
     [119.20, 119.28] have no peer; the agreeing run "we could just go now. It's"
     pairs. Both unresolved words start in the left core, so the left publishes
     them once, flagged.
   - **219 s** (ranged plan from 119 s). The left hears "video" [218.60, 219.00],
     the right "videos" [218.52, 218.92]: a lexical disagreement, not a timing
     one. Both start in the left core, so the left's "video" publishes, flagged;
     the right's "videos" stays in raw evidence with an unpublished
     `boundary-unresolved` issue.
   - **Shifts (±0.25 s, ±0.5 s, each window kept at 20 s).** 120 s resolves at
     −0.25, +0.25 and +0.5 but not −0.5. 219 s resolves only at −0.25; −0.5 and
     +0.25 still disagree, and +0.5 overran the decoded edge. A shift changes the
     recognized text itself (the left window says "videos" at −0.25 and "video"
     unshifted), so it re-rolls the evidence rather than settling it. **No fixed
     shift set resolves both seams in a way worth trusting, so there is no shift:
     unresolved words fall back to start ownership directly.**
2. **Overruns.** Token timings sit on the engine's **80 ms encoder frame** (every
   token start is a multiple of 0.08 s). Every overrun was the frame-rounded end
   of the last token, at most one frame:

   | Window | Decoded | Overrunning token | Past the edge |
   | --- | --- | --- | --- |
   | Full plan, last | [216, 231.701333) | `.` [15.60, 15.76] | 58.7 ms |
   | Ranged from 119 s, last (receipt 02) | [215, 231.701333) | `.` [16.56, 16.72] | 18.7 ms |
   | Caller window to 231.5 s (receipt 04) | [219, 231.5) | `.` [12.40, 12.56] | 60.0 ms |
   | 219 s seam shifted +0.5 s, left | [195.5, 223.5) | ` a` [27.84, 28.08] | 80.0 ms |

   At the end of media and at the caller's window end, the overrunning token is
   the sentence's trailing `.`. The published word "down." is timed by its
   speech-bearing tokens, which end 181–221 ms inside the window, so **nothing
   published is clamped there**: the old refusal came from validating every raw
   token, and the raw token stays in evidence as reported. A speech-bearing
   overrun (the last row) is clamped; that one was context-only, so it published
   nothing. The full end-to-end run therefore shows no `timing-clamped` issue
   on the final word.

**Red tests first (`helpers/mac/Tests/YapSpeechTests/main.swift`).**
- The refusal loop (~L190–203) becomes "the disagreement publishes, marked
  `boundary-unresolved`".
- A one-letter "I" seam case, from probe 1.
- The invalid-timing cases (L113–147) become three tests:
  - an overrun clamps;
  - a malformed word is dropped with an issue;
  - neighbours still publish.

**Core tests:** `asset-transcript.test.ts` and `source-transcript-read.test.ts`:
- issues round-trip;
- an old-recipe generation regenerates.

**One expensive run at the end:** `transcript.review` over the full
`narration.mov` publishes 3:52, with issues near 119.1 s and 218.6 s and a
clamped final word. Also the 119 s → `695104000/3` range.

**End-to-end result (2026-10-13,
[`assets/03-seams/end-to-end.json`](../assets/03-seams/end-to-end.json)).** A
fresh library, the built service and the new `yap-native`:
- `transcript.review` over full support publishes in 24 s: 524 words, the last
  "down." ending at 231.52 s of 231.70 s. Its issues are `boundary-unresolved`
  on "I" (119.12 s) and "mean," (119.20 s) at the 120 s seam, and on "video"
  (218.64 s) at the 220 s seam. Each reaches its `transcript.get` row.
- `transcript.prepare` from 119 s to `695104000/3` publishes 354 words. Its
  issues are `boundary-unresolved` on the published "video" (218.60 s) and an
  unpublished one on the right window's "videos" (218.52 s), at the 219 s seam.
- No `timing-clamped` issue: as probe 2 found, the overrunning end token is
  punctuation, and the published final word lies inside the window.

**Docs:**
- `packages/protocol/src/operations.ts:1049`: explicit ranges are windowed in
  20 s chunks too; describe the issue codes.
- `helpers/mac/Sources/YapSpeech/README.md` L9–17 and L31–34: "local problems
  become issues; raw evidence is kept."

**Must stay green.**
- The repeat, shifted-estimate and exact-point seam tests (`main.swift`
  L165–219), apart from the refusal assertions.
- The range-exceeds-source refusal.

**Delegated.** Issue code spellings, table and field names, and the exact shift
set (within ±0.5 s).
