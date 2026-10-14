# Transcript import and agent evidence

**Status:** proposal. This spec is the next planning unit for the agent-facing
media toolkit. It does not add a UI editor, a human approval flow or professional
editor interchange.

## Next Agent Prompt

**Last updated:** 2026-10-13. **Status:** planning complete; implementation has
not started. The API audit is recorded in slice 00. The next pickup is slice 01.

You are picking up the transcript-import-and-evidence spec. The next slice is
**01-import-contract**. First read this README, `DEVELOPMENT.md`, the owning
package READMEs and the current operation schemas. Implement only the parser and
provenance contract in slice 01. Keep supplied timing as the default, preserve
raw input and speaker names, and do not add alignment or automatic edits. Run the
slice's focused tests, update this section with the result and next pickup point,
then stop before starting slice 02.

Global TODO:

- [ ] 00 — Finish the API audit and freeze the public seams.
- [ ] 01 — Import SRT, VTT and supported JSON with provenance and supplied timing.
- [ ] 02 — Add explicit audio alignment without changing supplied input by default.
- [ ] 03 — Add missed-filler/disfluency evidence.
- [ ] 04 — Add pause/dead-air evidence with named detector policies.
- [ ] 05 — Add reversible speaker-attribution corrections.
- [ ] 06 — Integrate project/package persistence and CLI/MCP parity; run the full suite.
- [ ] 07 — Rename analysis operations and finish optional-model consent/error details.

Before ending any implementation pass, update this prompt with the current
status, tests run, open risks and exact next slice.

## Goal

Let an agent bring a transcript from a human, another AI service or another
editor into Yap, use it immediately as evidence, and explicitly choose whether
to trust its timing or align its literal text to audio. Add measured candidate
evidence for missed fillers and pauses, plus caller-authored speaker corrections,
without turning detection into automatic editing.

## Settled contract

- Yap remains an agent toolkit. There is no transcript/timeline UI in this work.
- The public operation schema is shared by CLI and MCP; adapters do not invent
  alternate names or meanings.
- An explicit reversible request is authorization. Do not add a confirmation
  gate or silently substitute a more clever policy.
- Imported timing is trusted by default. `timingPolicy: "supplied"` is the
  default; `timingPolicy: "align"` is an explicit opt-in.
- Import preserves original bytes, format, parser identity, cue boundaries,
  text, supplied timestamps, speaker names and source metadata.
- Cue-level timestamps remain cue-level evidence. Never spread one cue across
  words just to manufacture word timing. Word timing exists only when supplied
  or explicitly measured by alignment.
- Alignment preserves supplied text and supplied timing beside the derived
  alignment. It does not correct, add or remove words.
- Supplied speaker names are usable caller-authored labels. They do not become
  acoustic identity and do not overwrite diarization observations.
- Import plus an explicit project attachment is one atomic reversible revision.
  `edit.undo`, `edit.restore` and revision history remain the owners of recovery.
- Filler and pause detection are read-only evidence. They report method,
  settings, coverage and uncertainty; they never authorize a cut.
- `audio.pause.get` may use one tested technical default when the agent omits
  settings. The resolved threshold, window, channel, algorithm and version must
  be visible in the receipt. There are no hidden editorial defaults.
- The agent may override the detector settings explicitly. Do not add a
  capabilities endpoint until the installed build has more than one meaningful
  detector policy or mode to discover.
- `model.prepare` is a dependency operation. It downloads/acquires and verifies
  the selected model and runtime files; it does not transcribe, align, observe
  speakers or generate voice audio. The default transcript model is acquired
  automatically and has no customer-facing preparation step.
- Agents call the requested capability directly. They do not call
  `model.prepare` as a preflight. If an operation returns `MODEL_NOT_PREPARED`,
  its message and details must say that `model.prepare` will download/acquire and
  verify the named model/runtime files, identify `modelId`, purpose, what will be
  downloaded, estimated bytes or a clearly stated size scope, why the operation
  needs it, and that the failure is retryable. The agent uses those details to ask
  the user whether to download the optional model/runtime, calls `model.prepare`
  only after a yes, waits for readiness and retries the original request.
- Original media and prior revisions remain intact if parsing, alignment or
  publication fails.

## API seams

The exact schemas belong in `packages/protocol/src/operations.ts`; these names
describe ownership and behavior for planning:

1. **`transcript.import`** admits one SRT, VTT or supported JSON transcript,
   records raw bytes and provenance, and publishes an imported generation. It
   accepts `timingPolicy: "supplied" | "align"`, defaulting to `"supplied"`.
   The `align` branch chains the existing alignment owner; it does not invoke
   alignment in the default branch.
2. **`transcript.get`** reads imported rows and exposes origin, timing basis,
   supplied cue/word ranges, aligned ranges when present, speaker labels and
   parser/alignment issues. Continuations pin the imported generation and its
   provenance digest.
3. **`transcript.disfluency.get`** returns observed filler/vocalization rows and
   any supported missed-disfluency candidates. It distinguishes observed words,
   candidates, unknown coverage and unavailable support.
4. **`audio.pause.get`** returns bounded low-energy/pause candidates using one
   tested technical default when settings are omitted, or explicit detector
   settings supplied by the agent. It reports the resolved settings and never
   calls a candidate a safe edit boundary. A capabilities endpoint is deferred
   until multiple policies exist.
5. **`edit.apply`** gains the caller-authored speaker-attribution correction
   operation, or an equivalent edit operation owned by the existing revision
   reducer. It targets pinned occurrences/words and retains the base attribution
   and correction provenance side by side.
6. **Model lifecycle and analysis names** keep separate owners and outputs:
   `model.prepare` downloads and verifies dependencies; `transcript.transcribe`
   generates transcript evidence; `alignment.observe` generates alignment
   evidence; `speaker.observe` generates speaker evidence; and `voice.generate`
   creates a durable generated-audio asset. Rename the existing public analysis
   operations in one hard-cutover slice; CLI and MCP derive the same names and
   schemas, with no compatibility aliases unless a later decision adds them.

## API audit findings to carry forward

- `transcript.get` and `transcript.search` are appropriately read-only.
- `transcript.review` is an explicit convenience that may request missing
  transcription. It follows the same direct-call and user-approved optional
  model recovery as the lower-level operations; never reuse it for transcript
  import or a supposedly read-only imported-transcript read.
- `alignment.observe` already treats supplied text literally and preserves
  conditional evidence. Reuse its owner and bounded-window behavior.
- `wordKind` is a lexical classification of emitted text. It is not missed-filler
  detection and must not be advertised as one.
- Existing speaker attribution preserves unknown and overlap. Do not add a
  proximity/name fallback. Imported labels remain caller-authored metadata.
- Existing source/project range clamping reports issues. Preserve that pattern
  for imported and aligned ranges; never silently clamp away a mismatch.
- `edit.apply`, `edit.undo` and `edit.restore` already provide the atomic,
  replay-safe revision seam. Do not add a second mutation/history mechanism.
- Existing model preparation, capture permissions, destructive destination
  replacement and recording deletion have separate lifecycle or destructive
  contracts. This feature must not copy their gates into reversible transcript
  writes.
- `login.setEnabled` remains a separate user-owned OS preference: its explicit
  consent language is an installation boundary, not a model for adding approval
  gates to reversible media operations.

## Non-goals

- A transcript or timeline UI.
- Automatic filler removal, automatic silence removal or automatic speaker repair.
- Hosted transcription or hosted voice processing.
- Professional editor/NLE export.
- Invented word timings from cue spans.
- Silent alignment, cleanup, correction or model substitution.

## Verification map

Every slice has a focused protocol/core/service test and a CLI/MCP parity check
where it crosses the public operation boundary. Use deterministic SRT, VTT and
JSON fixtures covering Unicode, markup, cue overlaps, cue-only timing, word
timing, supplied speakers, unknown speakers and malformed input. Test restart,
replay, stale revision, failure isolation, pagination and original-byte
preservation. Run the full repository suite only after slice 06 is complete.

## Human review

The first useful checkpoint is a CLI/MCP import of a fixture with
`timingPolicy: "supplied"`, followed by a pinned transcript read that shows
provenance, cue/word timing basis and supplied speaker labels. A second
checkpoint requests `timingPolicy: "align"` for the same fixture and compares
the two evidence generations. No UI or rendered screenshot is needed for this
feature.
