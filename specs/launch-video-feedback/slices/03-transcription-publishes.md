# 03 Long-media transcription always publishes

**Unlocks.** `transcript.prepare` and `transcript.review` publish a complete
transcript for any readable media. No local problem fails the job; each
becomes an issue on the affected word, using slice 02's contract.

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
- **Identity bump, once:** recipe `source-windows-20s-context4s-guard1s-v3`
  (`SpeechWindows.swift` L5, `packages/core/src/transcript.ts:32`) and policy
  `transcript-v4`. Slice 01 turns the bump into regeneration.
- **Core:** an additive table carries per-word issues into reads as `issues`.

**Probes first. They choose the method; whether to publish is already decided.**
1. **Seam replay.** On `fixtures/launch-video/narration.mov`:
   - prepare single windows that reproduce the planned decoded windows:
     100–120 s and 120–140 s (seam 120), and 199–219 s and 219–230 s
     (seam 219), each with 4 s context;
   - retain each `raw.jsonl` as a boundary case;
   - `main.swift --boundary-cases` reproduces both disagreements twice;
   - also decode each seam shifted ±0.25 s and ±0.5 s. If a fixed shift set
     resolves the seams, try it before falling back to start-owned, and record
     the shift in the word's details.
2. **Overruns.** Read the raw token timings for 215 s to the end and for
   219–231.5 s. The observed overruns were 19 ms and 60 ms. Record the
   engine's frame duration in this slice. Clamping is unconditional; this is
   only context for the issue's `details`.

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
