# Launch-video feedback

Status: active plan, nothing implemented. Last updated 2026-10-12.

An agent used Yap 0.1.33 end to end to make Yap's own launch video. This spec
turns what cost it time into contracts. Sources:
- [FEEDBACK.md](FEEDBACK.md): the original feedback, plus corrections from
  code recon;
- [retro.md](retro.md): what happened in the session;
- [assets/receipts/](assets/receipts/README.md): the actual failing CLI
  output;
- [fixtures/launch-video](../../fixtures/launch-video/README.md): the real
  narration and far-camera audio, user-authorized and stored in LFS.

## Next Agent Prompt

You are resuming this spec.
1. Read this README, then [slice 01](slices/01-stale-derived-self-recovery.md).
   Nothing is built yet.
2. Start at slice 01. Every later slice that changes a recipe or
   implementation identity depends on it, because today a recipe bump crashes
   reads of retained rows instead of regenerating them.
3. Follow [`write-tests`](../../.agents/skills/write-tests/SKILL.md): each slice
   names its red test first.
4. Run the narrowest check per slice. Run the full suite once, after the last
   slice.
5. **The acceptance criterion is [slice 10](slices/10-replay-acceptance.md).**
   A fresh Claude Opus 5.5 agent edits the same launch video, from the same
   inputs and prompts, on the built product, and its transcript is read
   against the baseline issue by issue. The spec isn't done until that replay
   passes.
6. Before ending your pass, update this section: the status line, the
   checklist, and the next pickup point.

Checklist:
- [ ] [01 Stale derived generations self-recover](slices/01-stale-derived-self-recovery.md)
- [ ] [02 Long-media transcription publishes with diagnostics](slices/02-transcription-diagnostics.md)
- [ ] [03 Normalization refusals answer the question](slices/03-normalization-evidence.md)
- [ ] [04 Explicit normalization miss policy](slices/04-normalization-miss-policy.md)
- [ ] [05 Short-window level for word-sized ranges](slices/05-short-window-level.md)
- [ ] [06 Error and admission paper cuts](slices/06-paper-cuts.md)
- [ ] [07 View-shot fixtures](slices/07-view-shot-fixtures.md)
- [ ] [08 Multicam sync estimate, information only](slices/08-sync-estimate.md)
- [ ] [09 Skill guidance](slices/09-skill-guidance.md)
- [ ] Full suite run
- [ ] [10 Replay acceptance](slices/10-replay-acceptance.md), then [close-spec](../../.agents/skills/close-spec/SKILL.md)

## Slice graph

```
01 self-recovery ──► 02 transcription ──┐
               └──► 03 normalization ──► 04 miss policy
05 short-window level ─────────────────┤
06 paper cuts (independent)            ├──► 09 skill guidance ──► full run ──► 10 replay acceptance
07 view shots (independent)            │
08 sync estimate (independent, gated) ─┘
```

Ordered by pain: transcription cost ~25 minutes and 13 manual requests, and
mastering took four edit/measure rounds. Slices 06–08 can run in parallel with
anything after 01.

## Contracts this spec preserves

- **Recordings made with 0.1.33 keep working.** This is the user's rule.
  - Derived intermediates (transcript generations, prepared audio,
    normalization evidence, indexes, packaged transcripts) may be invalidated.
  - The system must detect a stale identity and regenerate on its own; no
    manual cleanup, no compatibility shims.
  - **No slice bumps `catalogFormat`.** `packages/core/src/catalog.ts` refuses
    any mismatched library with `UNSUPPORTED_CATALOG`, and recordings share
    that catalog. New derived data goes in additive `CREATE TABLE IF NOT
    EXISTS` tables.
- **No silent repair.** A seam resolution or a timing clamp:
  - keeps every raw observation, including its original engine seconds;
  - publishes an explicit per-word diagnostic.

  Malformed input (nonfinite, reversed, or far out of bounds) still refuses.
- **Zero editorial decisions.**
  - No product thresholds for "word lost" or "mic is bad".
  - No automatic denoise, normalization target, or sync offset. Estimates are
    information the caller admits explicitly.
- **One owner per concept.** The changes live inside the existing owners:
  - seams in `YapSpeech` `SpeechBoundaryMerge`;
  - measurement in `packages/core/src/audio-measurement.ts` and
    `acoustic-inspection.ts`;
  - correspondence in `packages/core/src/correspondence.ts`.

  App, CLI and MCP share the same handlers. Replaced paths are deleted, not
  kept alongside the new ones.
- **Tolerances stay as they are.** `normalizationTolerance` is unchanged:
  ±0.2 LU integrated and 0.15 dB true-peak excess. Recon showed the session's
  dynamic-mode refusal was a 0.2 dB true-peak excess, not the 0.1 LU miss the
  feedback blamed.

## Firewalls (this spec must not)

- Bump `catalogFormat`, rewrite source media, or clamp authored edit ranges.
- Add a caller-chosen transcription window length. Decoding is deliberately
  bounded (≤28 s decoded).
- Change `--wait` stdout/stderr or `edit.labels`. Recon proved both
  complaints wrong.
- Promote the Python sync experiment
  (`packages/test-harness/editing/synchronization`) into production.
- Plan work from the retro's record-only sections ("Agent-side mistakes",
  "Policy observations").

## Decisions made by the product's user

The person who prompts this work isn't the product's user; the agent editing
with Yap is. The agent that hit these problems in the baseline session made
these calls:

**A. An unresolved seam word: publish it with `boundary-unresolved` (slice 02).**
- While editing, a missing word was always worse than a flagged one. It breaks
  quote selection, cut boundaries and captions, and the only way to notice it
  is to re-transcribe.
- A flagged word, with both raw candidates kept, says exactly where to look.
- Rejected: publishing no word and recording an unresolved span.

**B. Normalization that misses its target: an explicit opt-in
`onMiss: "refuse" | "publish"`, defaulting to `"refuse"` (slice 04).**
- In the session, a 0.05 dB true-peak excess blocked both rendering and
  measurement. The agent would have accepted the result immediately if it
  could have seen it.
- The default stays strict, so a miss is only published when the caller asks
  for it, and it is recorded as `unmet`.
- Rejected: refuse-and-report only. That still leaves the caller stuck.

**C. The sync estimate stays in this spec (slice 08).**
- The far camera started about 2.5 minutes after the Mac recording, so its
  footage had to be shifted 146.58 s to line up with the take.
- Yap has no way to work that out. The agent hand-wrote an audio
  cross-correlation: slide one track against the other until the waveforms
  match.
- Slice 08 makes that a Yap operation. It returns the offset with a strength
  score. Nothing moves unless the caller explicitly admits the result through
  `correspondence.prepare`.
- The archived research refused this for mismatched mics, and those thresholds
  stay frozen. The slice may therefore close as a retained refusal, and
  slice 10 accounts for that.

The archived [synchronization study](../done/video-editing-feedback/assets/20-synchronization/README.md)
refused unlike-mic correlation: the best |r| was about 0.197 against a 0.35
gate.

## Decisions already made (with what lost)

- **Render words:** `transcript.render.prepare` keeps the prepare/get split
  every evidence operation uses. The fix is to make the CLI's `--wait` read
  `transcript.render.get` (slice 06). Returning words from prepare lost
  because it would be a special case.
- **Denoise word loss:** a general `rmsDbfs` field in `audio.measure` that
  works at any duration (slice 05), plus skill guidance (slice 09). A
  dedicated per-word attenuation operation lost: it duplicates the measurement
  owner.
- **Which mic recorded what:** skill guidance using `audio.measure` across
  sources (slice 09). A loudness summary inside `asset.get` / `recording.get`
  lost because it would start a heavy measurement job from a cheap describe
  call.
- **Placement bounds:** report the asset's exact end in the error. An opt-in
  clamp lost: authored ranges stay exact.
- **Out-of-range render request:** refuse at admission, matching `audio.get`
  and `audio.measure`. The pinned test at
  `apps/service/src/project-contracts.test.ts:81` pins an inconsistency, not
  a decision; commit `779a9105` gives no rationale for checking at job time.
- **0.1.33 transcript packages:** on import, drop the stale transcript and
  regenerate it, rather than refusing the whole package.

## Research

Long-form ASR seam practice:
- Overlapping chunks are merged at token or word level on the longest
  agreeing run ([Canary/Parakeet](https://arxiv.org/pdf/2509.14128)).
- On disagreement, a whole word goes to the chunk whose core holds its start.
  A blank-collapse near a window edge was recovered by shifting the window
  0.25–0.5 s, though no single shift fixed every case
  ([ParakeetSTT PR #3](https://github.com/JohanesSetiawan/ParakeetSTT/pull/3)).
- Chunk offsets should accumulate in raw frames, or timestamps drift
  ([NeMo #16072](https://github.com/NVIDIA-NeMo/Speech/issues/16072)).

Yap's existing merge already prefers "core holds start" provisionally
(`SourceTranscript.swift`). It refuses instead of publishing the result.

## Verification

- Red tests come first and live with each owner:
  - `helpers/mac/Tests/YapSpeechTests/main.swift`;
  - `packages/core/src/*.test.ts`;
  - `apps/service/src/*.test.ts`;
  - `apps/cli/src/*.test.ts`.
- Expensive runs (real inference over `fixtures/launch-video/narration.mov`)
  happen only where a slice says so.
- Slice 07 is the only visual slice. It ends with
  [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md) on
  its shots, and uses
  [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md)
  against the current labelled shots.
