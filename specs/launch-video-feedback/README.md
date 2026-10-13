# Launch-video feedback

Status: active plan, nothing implemented. Last updated 2026-10-12.

An agent used Yap 0.1.33 end to end to make Yap's own launch video. This spec
turns what cost it time into contracts. Sources:
- [FEEDBACK.md](FEEDBACK.md): the original feedback, with corrections from code
  recon;
- [retro.md](retro.md): the session retrospective;
- [assets/receipts/](assets/receipts/README.md): the actual failing CLI
  output;
- [fixtures/launch-video](../../fixtures/launch-video/README.md): the real
  session inputs, user-authorized and stored in LFS.

## Next Agent Prompt

You are resuming this spec.
1. Read this README, then [slice 01](slices/01-stale-derived-self-recovery.md).
   Nothing is built yet.
2. Start at slice 01. Every later slice that changes a recipe or
   implementation identity depends on it, because today a recipe bump crashes
   reads of retained rows instead of regenerating them.
3. Slice 02 comes next. It sets the governing principle and the shared
   `issues` type that slices 03–07 use.
4. Follow [`write-tests`](../../.agents/skills/write-tests/SKILL.md): each
   slice names its red test first. Run the narrowest check per slice, and the
   full suite once, after slice 10.
5. **The acceptance criterion is [slice 11](slices/11-replay-acceptance.md).**
   A fresh Claude Opus 5.5 agent edits the same launch video, from the same
   inputs and prompts, on the built product, and its transcript is read
   against the baseline issue by issue. The spec isn't done until that replay
   passes.
6. Before ending your pass, update this section: the status line, the
   checklist, and the next pickup point.

Checklist:
- [ ] [01 Stale derived generations self-recover](slices/01-stale-derived-self-recovery.md)
- [ ] [02 Output by default: one `issues` contract](slices/02-issues-contract.md)
- [ ] [03 Long-media transcription always publishes](slices/03-transcription-publishes.md)
- [ ] [04 Audio treatments publish their best result](slices/04-audio-treatments-publish.md)
- [ ] [05 Short-window level for word-sized ranges](slices/05-short-window-level.md)
- [ ] [06 Error and admission paper cuts](slices/06-paper-cuts.md)
- [ ] [07 The remaining quality gates publish with issues](slices/07-remaining-quality-gates.md)
- [x] [08 Multicam sync: no new primitive (closed by decision)](slices/08-sync-estimate.md)
- [ ] [09 View-shot fixtures](slices/09-view-shot-fixtures.md)
- [ ] [10 Skill guidance](slices/10-skill-guidance.md)
- [ ] Full suite run
- [ ] [11 Replay acceptance](slices/11-replay-acceptance.md), then [close-spec](../../.agents/skills/close-spec/SKILL.md)

## Slice graph

```
01 self-recovery ──► 02 issues contract ──► 03 transcription ──┐
                                        ├──► 04 audio treatments ┤
                                        ├──► 06 paper cuts ──────┤
                                        └──► 07 other gates ─────┤
05 short-window level ───────────────────────────────────────────┤
09 view shots (independent) ─────────────────────────────────────┤
08 sync: closed, folded into 10 ─────────────────────────────────┴──► 10 skill guidance ──► full run ──► 11 replay
```

Ordered by pain: transcription cost ~25 minutes and 13 manual requests, and
mastering took four edit/measure rounds.

## Governing principle: output by default

Set by the product owner on 2026-10-12, and implemented by
[slice 02](slices/02-issues-contract.md).
- **If an operation can produce an output, it produces it, and reports every
  problem as an issue on that output.** This holds especially when the work is
  cheap and undoable: derived artifacts, revisions, previews, measurements, and
  exports to new files.
- **Refusal is only for:**
  - malformed or ambiguous input;
  - identity or revision conflicts;
  - resource bounds;
  - missing prerequisites;
  - destructive or irreversible actions.
- **A range that is partly valid is clamped and flagged.** One with no valid
  part is malformed.

A refusal audit (2026-10-12) found the product mostly strict on cheap quality
gates, and several of them throw away output that was already computed:
normalization, the limiter, transcript seams and timing. The docs state the
opposite principle in about ten places. Slices 03, 04, 06 and 07 fix every
gate the audit found, and slice 02 fixes the docs.

## Contracts this spec preserves

- **Recordings made with 0.1.33 keep working.** This is the product owner's
  rule.
  - Derived intermediates (transcript generations, prepared audio,
    normalization evidence, indexes, packaged transcripts) may be invalidated.
  - The system must detect a stale identity and regenerate on its own; no
    manual cleanup, no compatibility shims.
  - **No slice bumps `catalogFormat`.** `packages/core/src/catalog.ts` refuses
    any mismatched library with `UNSUPPORTED_CATALOG`, and recordings share
    that catalog. New derived data goes in additive tables.
- **No silent repair.** Every clamp, fallback, dropped word or unmet target
  publishes an issue. Raw evidence keeps the original values. Output by
  default means *flagged* output, never quietly altered output.
- **Zero editorial decisions.**
  - The product sets no thresholds for "word lost", "mic is bad" or "sync is
    good".
  - It applies no automatic denoise, normalization target or offset.
  - A flagged output isn't an editorial decision; the caller decides what to
    do with it.
- **One owner per concept.**
  - Issues have one owner: `packages/protocol` `issueSchema`.
  - Seams are owned by `YapSpeech` `SpeechBoundaryMerge`.
  - Measurement is owned by `audio-measurement.ts` and
    `acoustic-inspection.ts`.
  - Ranges are owned by `project-window.ts` and `validateSourceSelection`.

  The old ad hoc lists (`violations`, `failedGates`, `omitted`) migrate to
  `issues`, and the old fields are deleted. App, CLI and MCP share the same
  handlers.
- **Tolerances stay as they are.** They now decide whether an issue is
  emitted, not whether output exists.

## Firewalls (this spec must not)

- Bump `catalogFormat`, or rewrite source media.
- Weaken class-A refusals: identity, revision, malformed input, budgets,
  destructive actions.
- Add a caller-chosen transcription window length. Decoding is deliberately
  bounded (≤28 s decoded).
- Change `--wait` stdout/stderr or `edit.labels`. Recon proved both
  complaints wrong.
- Add a synchronization primitive, or promote the Python sync experiment
  (`packages/test-harness/editing/synchronization`) into production.
- Plan work from the retro's record-only sections.

## Decisions made by the product's user

The agent editing with Yap is the product's user; the person sending prompts
owns the product. The agent that hit these problems made these calls, revised
where the product owner set a principle:

**A. An unresolved seam word is published with `boundary-unresolved`
(slice 03).**
- A missing word was always worse than a flagged one. It breaks quotes, cuts
  and captions.
- Rejected: publishing no word and recording an unresolved span.

**B. Audio treatments always publish their best result, with issues
(slice 04).**
- The earlier plan was an opt-in `onMiss: "publish"` defaulting to refuse.
  The product owner's principle replaced it.
- A 0.05 dB true-peak excess had blocked rendering and measurement. A refusal
  plus a flag the caller has to learn is the friction the principle removes.

**C. No sync primitive (slice 08, closed by decision).**
- The session synced the far camera (146.58 s) from existing evidence: word
  timings from both transcripts, then PCM.
- A primitive would bring confidence thresholds and drift policy into the
  product, which is the complexity the archived study accumulated.
- Multicam sync becomes skill guidance (slice 10).

## Decisions already made (with what lost)

- **Render words.** `transcript.render.prepare` keeps the prepare/get split
  that every evidence operation uses; the CLI's `--wait` reads
  `transcript.render.get` instead (slice 06). Returning words from prepare
  lost: it would be a special case.
- **Denoise word loss.** A general `rmsDbfs` field in `audio.measure`
  (slice 05), plus skill guidance. A dedicated per-word attenuation operation
  lost: it duplicates the measurement owner.
- **Which mic recorded what.** Skill guidance using `audio.measure` across
  sources. A loudness summary inside `asset.get` lost: it would start a heavy
  job from a cheap describe call.
- **Placement and read ranges.** A partly valid range is clamped with
  `range-clamped` (slice 06). The earlier choice ("refuse; report the end")
  lost to the governing principle.
- **0.1.33 transcript packages.** On import, drop the stale transcript and
  regenerate it, rather than refusing the package (slice 01).
- **Unclear gates.** Each is decided per row in
  [slice 07](slices/07-remaining-quality-gates.md): font fallback, stateful
  processing over gaps, angle groups, SRT literals, unqualified sources,
  speaker continuity, subject framing and dialogue proposals.

## Research

Long-form ASR seam practice:
- Overlapping chunks are merged at token or word level on the longest
  agreeing run ([Canary/Parakeet](https://arxiv.org/pdf/2509.14128)).
- On disagreement, a whole word goes to the chunk whose core holds its start.
- A blank-collapse near a window edge was recovered by shifting the window
  0.25–0.5 s ([ParakeetSTT PR #3](https://github.com/JohanesSetiawan/ParakeetSTT/pull/3)).
- Chunk offsets accumulate in raw frames to avoid drift
  ([NeMo #16072](https://github.com/NVIDIA-NeMo/Speech/issues/16072)).

Multicam sync practice: [PluralEyes](https://www.premiumbeat.com/blog/pluraleyes-best-audio-sync-workflow/)
and [Premiere's Synchronize](https://audioforgepro.com/blog/audio-synchronize-failure-premiere-pro-v26-fix-fast)
match waveforms and gate on a confidence threshold. That threshold is a
policy, and it's why slice 08 adds no primitive.

## Verification

- Red tests come first and live with each owner:
  - `helpers/mac/Tests/YapSpeechTests/main.swift`;
  - `packages/*/src/*.test.ts`;
  - `apps/*/src/*.test.ts`.
- Expensive runs (real inference over `fixtures/launch-video/narration.mov`)
  happen only where a slice says so.
- Visual slices end with
  [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md):
  - slice 09's shots, which are also compared with
    [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md)
    against the current labelled shots;
  - slice 07 row (a)'s fallback frame.
