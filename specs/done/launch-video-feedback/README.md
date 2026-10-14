# Launch-video feedback: output by default

Status: shipped 2026-10-13. Accepted by a fresh-agent run on the real inputs
([assets/replay](assets/replay/reading-notes.md)).

An agent used Yap 0.1.33 end to end to make Yap's own launch video. Most of
the time it lost went to refusals: work Yap had already computed, thrown away
because a quality gate missed.
- A 3:52 narration would not transcribe in one request, because one seam
  disagreement discarded everything.
- Mastering refused over a 0.05 dB true-peak excess.
- A placement 16 ms past its source refused.

This record keeps why the product now behaves differently and what must stay
true. Sources:
- [FEEDBACK.md](FEEDBACK.md) is the session's own feedback, with corrections
  from code recon.
- [retro.md](retro.md) is the retrospective.
- [assets/receipts](assets/receipts/README.md) holds the failing CLI output.
- [assets/refusal-audit.md](assets/refusal-audit.md) is the product-wide
  refusal audit.
- [choices.md](choices.md) is the final decisions ledger, including the ones
  that still need the owner.
- The real session inputs are in
  [fixtures/launch-video](../../../fixtures/launch-video/README.md), stored in
  LFS with the user's authorization.

## The principle

Set by the product owner on 2026-10-12, and stated in the root
[README](../../../README.md#product-boundary):

- **If an operation can produce output, it produces it and reports every
  problem as an issue on that output.** This matters most when the work is
  cheap and undoable: derived artifacts, revisions, previews, measurements,
  and exports to new files.
- **Refusal is only for:** malformed or ambiguous input, identity or revision
  conflicts, resource bounds, missing prerequisites, destructive actions, and
  execution failures (the work itself failed).
- **A range that is partly valid is clamped and flagged.** One with no part
  inside its domain is malformed.

Why: a refusal makes the caller rediscover what the product already knew,
usually by hand. Agents reached for hand-chunked transcription, pre-limiters
outside the stack and RMS arithmetic in Python. An issue keeps the output and
the knowledge together. The caller still decides; the product makes no
editorial call.

## Invariants

- **Flagged, never silently altered.** Every clamp, fallback, dropped word,
  split state or unmet target publishes an issue, and raw evidence keeps the
  original values.
- **One issue vocabulary.** Every kebab-case issue code, with evidence typed
  per code, lives in `packages/composition/src/issues.ts` (`issueSchema`,
  `issueCodes`). Older UPPER_SNAKE warnings (capture recovery, the delivery
  check) stay outside it, classified `issue-code` in the refusal ledger.
  - An output carries at most 1000 issues, then one `issues-truncated`.
  - `boundedIssues` is idempotent: bounding an already-bounded list keeps
    the omitted count.
  - The skill helpers keep their own copy of that bound in
    `skills/yap/scripts/inspection-artifacts.mjs`, because they can't import
    composition. That copy truncates, but it doesn't fold an existing
    `issues-truncated` the way `boundedIssues` does.
- **Issues live beside output, never inside evidence.** Issues persist in the
  additive `output_issues` table (`packages/core/src/issues.ts`), written in
  the same transaction as the publication.
  - Retained evidence and portable packages carry none; prepared audio
    re-derives its issues on read and import.
  - So evidence from 0.1.33 stays byte-identical, and its strict schemas
    still accept it.
- **Refusals are classified.** `packages/protocol/src/refusal-ledger.test.ts`
  checks every double-quoted multi-word UPPER_SNAKE literal in product source,
  with per-file counts, against `refusal-ledger.json`. One-word codes such as
  `UNAVAILABLE` and `CANCELED` aren't scanned.
  - The test also requires that nothing is pending conversion. A new
    quality-gate refusal is a regression, not a backlog item.
  - Every issue code must be produced in source and asserted by a test.
  - No issue code may equal a refusal code.
- **0.1.33 recordings keep working.** `catalogFormat` stays 29, the 0.1.33
  format, because every format refuses every other. A test in
  `packages/core/src/capture-store.test.ts` pins it.
  - A refusal turned into output bumps its producer's implementation identity.
    Failed jobs from older builds then re-run instead of answering "failed".
  - Stale derived data regenerates on its own: transcripts by recipe and
    policy, and normalization and limiter evidence by identity.
  - Data a revision pins stays historical; a package adopts it read-only.
- **The cache identity holds the applied range.**
  - Every clamping read keys its cache by the clamped range: transcripts,
    rendered speech, alignment, audio, previews and evidence.
  - Each request reports its own clamp in its result's `issues`, so a request
    for the applied range shares the same output.
- **A read surfaces the issues of what it read.**
  - A ready transcript read returns `published.issues`.
  - Project reads carry their source generations' issues on each dependency.
  - The CLI's `ready (N issues)` marker counts the read's own issues,
    `published.issues` and each dependency's issues. An `issues-truncated`
    entry counts as the number it omitted (`apps/cli/src/wait.ts`).
- **Primitives only.** No sync primitive, no thresholds for "word lost" or
  "sync is good", and no automatic treatments.

## How each failure was answered

- **Long transcription.**
  - Owners: `helpers/mac/Sources/YapSpeech` (`SpeechWindows`,
    `SpeechBoundaryMerge`, `SourceTranscript`); the recipe is
    `source-windows-20s-context4s-guard1s-v3`.
  - Windows overlap, and every request decodes this way, explicit ranges
    included.
  - Words go to the window whose core holds their start. A word the two
    windows disagree on is published with `boundary-unresolved`, because a
    missing word breaks quotes, cuts and captions; this was decision A.
  - An estimate past the decoded edge is clamped, with `timing-clamped`. A
    malformed token is dropped, with `word-dropped`.
- **Mastering.**
  - Owner: `packages/core/src/audio-measurement.ts`.
  - Normalization and the limiter always publish their best result (decision
    B).
  - For gain-only targets the peak ceiling wins. `normalization-target-unmet`
    carries `peakToLoudnessDb` and `maximumFeasibleTargetLufs`, so the caller
    can re-target in one step. Applying the full gain would have shipped
    clipped audio.
- **Ranges.**
  - Owners: `packages/composition/src/range-admission.ts` (`admitRange`,
    `admitReadRange`, `admitMicrosecondRange`, `keepSameFraction`) and
    `admitProjectRange` in `packages/core/src/project-window.ts`.
  - Place, replace, reanchor and content anchors keep the same fraction of a
    placement (`fitClip` in `packages/composition/src/edits.ts`). Trim and
    angle validity clamp to the clip's interval.
  - Each reports `range-clamped` with `operationIndex`.
  - Stored documents are still validated strictly.
- **Source gaps.**
  - `deriveStatePlan` in `packages/composition/src/processing-state.ts` splits
    a stateful processor's state at a hole in its input. The processor
    restarts after the gap instead of learning across invented silence.
  - `stateSupportIssues` in `packages/core/src/project-window.ts` reports the
    split as `support-gap`.
- **Fonts.** Owner: `packages/core/src/text-fallback.ts`. A fallback face is
  drawn and reported as `font-substituted` or `glyph-missing`.
  `FONT_UNAVAILABLE` and `FONT_CHANGED` are real codes.
- **Captions.**
  - SRT keeps markup and reports `srt-literal-markup`
    (`packages/composition/src/caption-sidecars.ts`). Its only
    format-specific refusal is a timing line inside a cue.
  - Overlaps and omissions are issues.
  - The skill's caption and dialogue proposal helpers emit registry issues.

## Divergences from the plan

- **Slice 05 shipped no field.** Its probe found that a whole-word RMS hid
  denoise loss: 3.4 dB across the word, where 20 ms buckets show 10–16 dB at
  its onset and tail. `waveform.get` already answers that, and the skill now
  teaches comparing it on the dry and processed taps.
- **`UNAVAILABLE_SUPPORT` stays a refusal.** Aligning one caller text against
  several runs is ambiguous. Per-run speaker observation would need hundreds
  of lines of new generation machinery. Instead, the refusal names the
  `available` runs, so the caller narrows in one step.
- **The clamp moved off shared outputs.** It was first stored on the
  published output for rendered speech and alignment. Because the identity
  holds the applied range, it is now reported per request, everywhere.
- **Acceptance was scoped down by the owner.** One focused task, designed to
  cross every fixed path, replaced the three-turn re-edit. The run never
  exercised three of those paths: curve clock, source bounds and render
  range.
- **Transcript reads were fixed before acceptance.** A ready transcript read
  now carries its published issues (`c8a08428`, `89f5542c`).
- **The product's user made decisions too.**
  - The agent editing with Yap made A (publish seam words), and the owner
    approved it.
  - The agent proposed B as an opt-in. The owner revised it into the
    output-by-default principle.
  - The agent also closed sync (C): there is no primitive, and the skill
    teaches the recipe in `skills/yap/references/creative-workflows.md`.

## Dead ends

- **An opt-in `onMiss: "publish"` that defaults to refusing.** The principle
  replaced it; strictness has no opt-in.
- **Shifting seam windows by ±0.25 s or ±0.5 s.** On `narration.mov`, only a
  −0.25 s shift resolved both seams. A shift changes the recognized words
  themselves: the left window heard "videos" shifted and "video" unshifted.
  So it re-rolls the evidence instead of settling it.
  [assets/03-seams](assets/03-seams/) holds the unshifted repeat decodes the
  seam tests use.
- **Holding the last frame for a placement past its source.** It invents
  picture. Clamping keeps what exists.
- **Severity levels on issues.** Ranking problems is an editorial call.
- **A sync primitive.** Its confidence threshold and drift policy are the
  editorial logic the archived synchronization study accumulated.

## Visual provenance

- [assets/09-view-shots](assets/09-view-shots/) holds the capture and library
  view shots, labelled and unlabelled.
  - The session's video painted fixture labels over product UI.
  - `FIXTURE_LABEL=omit` produces the unlabelled versions.
  - The labelled ones remain the default, so review shots stay honest about
    being synthetic.
  - They were held to this standard: outside the label region the unlabelled
    shots are pixel-identical to the labelled ones (pinned by
    `apps/macos/tests/view-shot-labels.test.mjs`), and an unprimed critique
    found no leftover text. The preview sign-off was skipped because the run
    was unattended.
- [assets/07a-fonts](assets/07a-fonts/) holds the font-fallback frames.
  - `reference.png` is the pinned face drawing everything.
  - `font-substituted.png` draws a check mark the face lacks, using another
    installed face.
  - `glyph-missing.png` draws a character no font has, as a placeholder box.
  - An unprimed critique judged these frames. The check mark doesn't match
    Arial, and the placeholder box sits slightly tall and low; both are what
    the issues report, and nothing is clipped. Before this change, both cases
    refused (`frames.json`).

## Acceptance

[assets/replay](assets/replay/reading-notes.md) holds the record. A fresh
Claude Opus 5.5 agent cut a mastered teaser from the session's real inputs,
with no hint of what used to break.
- It hit none of the baseline's seven refusal signatures. The baseline hit
  them in 3, 4, 3, 2, 1, 1 and 1 tool results.
- It did no hand-chunked transcription and no RMS arithmetic outside Yap.
- [acceptance/baseline-signatures.txt](acceptance/baseline-signatures.txt) is
  the baseline those counts come from.
- `packages/test-harness/acceptance/launch-video-replay.mjs` produces the
  counts. Its first count misread the run's cross-correlation script as RMS
  work; the rule was corrected, and the baseline counts are unchanged.
- Reading the transcript found new friction: `INVALID_PARAMS` refusals came
  with empty `details`. That was fixed after acceptance (`b95de9c1`).

## Open items

These need the owner; [choices.md](choices.md) has the details.
- `audio.extract` from treated project audio carries none of its issues.
- Stale transcripts adopted from packages are never reclaimed.
- The output-by-default paragraph for `AGENTS.md` waits on `/audit-agents`.
