# 02 Long-media transcription publishes with diagnostics

**Unlocks.** `transcript.prepare` and `transcript.review` finish on long media.
Two situations no longer refuse the whole job:
- **Seam disagreement:** words go to the window whose core holds their start.
  Each unpaired word gets `boundary-unresolved` (open decision A; that is the
  default).
- **Estimate overrun:** an estimate that runs past the decoded edge by at most
  one engine frame is clamped and gets `end-clamped`. This covers both the
  physical end of media and a caller's window end.

Raw evidence keeps every candidate observation and the original engine
seconds, including for degraded seams. Today a throw discards it
(`SourceTranscript.write` `defer { destination.discard() }`), which
contradicts the YapSpeech README's claim that a failed seam stays inspectable.

Malformed input still refuses: nonfinite, reversed, negative, starting at or
after the interval end, a large overrun, or more than 28 s decoded.

**Seam.**
- `helpers/mac/Sources/YapSpeech/SpeechWindows.swift`:
  - `SpeechBoundaryMerge.resolve` (L100–154) returns a resolution
    (`agreed` | `start-owned` plus the unpaired observations) instead of
    calling `refuse()`.
  - Delete the `TRANSCRIPT_BOUNDARY_DISAGREEMENT` throw path.
- `helpers/mac/Sources/YapSpeech/SourceTranscript.swift`:
  - `sourceSpan` (L202–218) clamps an estimate whose start is inside the
    interval and whose end is past it by at most one engine frame, and
    records the clamp.
- Identity bump, once, for this whole slice:
  - recipe `source-windows-20s-context4s-guard1s-v3` in `SpeechWindows.swift`
    L5 and `packages/core/src/transcript.ts:32`;
  - transcript policy `transcript-v4`.

  Slice 01 turns this bump into regeneration.
- Core: a new additive table (e.g. `transcript_boundaries`) joined into word
  reads as `diagnostics: string[]`, plus `TranscriptWordRecord.diagnostics`.

**Probes (run first; each can reshape the slice).**
1. **Seam replay determinism.** On `fixtures/launch-video/narration.mov`,
   prepare single windows that reproduce the planned decoded windows:
   - seam 120 s: 100–120 s with 4 s context, then 120–140 s;
   - seam 219 s: 199–219 s, then 219–230 s.

   Retain each `raw.jsonl` into the boundary-case inventory. Then:
   - `main.swift --boundary-cases` must reproduce both disagreements twice;
   - also decode each seam shifted by ±0.25 s and ±0.5 s.
2. **Overrun bound.** Read the raw token timings for 215 s → end and
   219–231.5 s. The observed overruns were 19 ms and 60 ms. Confirm the
   engine's frame duration and that both fit within one frame.

**Gates from the probes.**
- If shifted decodes resolve the seams, try a fixed shift set first and record
  the shift used. If they don't, ship the start-owned fallback only.
- If replay isn't deterministic, live fixture runs replace replay as the
  oracle for seams.
- If an overrun is larger than one frame, don't clamp it: it keeps refusing,
  and the bound is recorded here.

**Red tests first (`helpers/mac/Tests/YapSpeechTests/main.swift`).**
- The refusal loop (~L190–203) becomes "a disagreement publishes once, marked
  `boundary-unresolved`".
- Add a one-letter word ("I") seam case, from probe 1's retained cases.
- The "must refuse rather than clamp" cases (L113–147) split in two:
  - an overrun of up to one frame clamps;
  - nonfinite, reversed and large overruns still refuse.

**Other tests.**
- `packages/core/src/asset-transcript.test.ts` and
  `source-transcript-read.test.ts`: diagnostics round-trip; an old-recipe
  generation regenerates (uses slice 01).
- **One expensive run at the end of the slice:** `transcript.review` over the
  full `narration.mov`. Rows near 119.1 s and 218.6 s carry diagnostics, and
  the final word is clamped. Also a 119 s → `695104000/3` range.

**Docs, same change.**
- `packages/protocol/src/operations.ts:1049`: explicit ranges are also
  windowed in 20 s chunks; describe the new diagnostics.
- `helpers/mac/Sources/YapSpeech/README.md` L9–17 and L31–34: replace "refuse
  rather than clamp" with "bounded, diagnosed, raw evidence kept".

**Must stay green.**
- The seam tests for repeats, shifted estimates and exact points
  (`main.swift` L165–219), apart from the refusal assertions.
- The invalid-timing refusals for malformed input.
- Decoded length ≤ 28 s.

**Delegated.** Field, table and enum names; the exact shift set (within
±0.5 s); whether `TranscriptGapRecord` changes.

**Would change this slice.** If the user picks the alternative for decision
A, publish no word for an unresolved observation and record an unresolved
span instead.
