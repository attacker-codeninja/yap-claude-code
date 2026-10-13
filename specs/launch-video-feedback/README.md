# Launch-video feedback

Status: in progress. Last updated 2026-10-13.

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

You are resuming this spec. Status (2026-10-13): slices 01–09 are merged on
`t3code/create-launch-video`, and slice 10's guidance is written. The refusal
ledger (`packages/protocol/src/refusal-ledger.json`) has an empty
`pendingConversion`: every gate is converted or classified with a reason.
`UNAVAILABLE_SUPPORT` stays a refusal that names the supported runs (see
choices.md, "Slice 07b").

Next pickup, in order:
1. Build and install the product at that commit (slice 11 "Environment"),
   then slice 10's two evals: the "this 3:52 narration won't transcribe" case
   with `eval-skills`, and the recording-sync recipe on the fixture pair
   (expect narration = excerpt + 149.94 s).
2. [11](slices/11-replay-acceptance.md): replay acceptance with
   `packages/test-harness/acceptance/launch-video-replay.mjs`. Then the
   whole-spec review, a rewritten choices.md, and close-spec.

The full run (2026-10-13) is done: check-types, lint and format:check pass;
it caught one slice 03 regression (skipped speech windows reported 0
samples), now fixed. What still fails there is environmental or predates
this spec:
- six service files whose fixtures compile Swift with a cold module cache
  (35 s each with Xcode 27, against 10–30 s timeouts);
- the B-frame probe test (`helpers/mac/Tests/media-probe.test.mjs`), in code
  this spec didn't touch;
- `scripts/update-guard.test.mjs` and the signing tests, which need
  `YAP_SPARKLE_FRAMEWORK` and keychain access;
- timing tests that fail only under load and pass alone.

Also known before this spec:
- `descriptor exhaustion` (`apps/service/src/audio-processing.test.ts`) still
  fails. A spawn under EMFILE now reports a retryable failure (fixed). The
  test also expects the exhaustion to strike a native domain call; it now
  strikes the ffmpeg spawn first. The assertion is unchanged.
- Some speaker-service and project-import tests pass only without the
  real-native env vars (`YAP_NATIVE`, `YAP_FFMPEG_*`).

Open, needs the user: 01e's `AGENTS.md` paragraph waits on `/audit-agents`,
which only the user can run.

Rules for every pass:
- Follow [`write-tests`](../../.agents/skills/write-tests/SKILL.md): red
  first, narrowest checks.
- **The acceptance criterion is [slice 11](slices/11-replay-acceptance.md):**
  a fresh Claude Opus 5.5 agent replays the launch-video edit on the built
  product, and its transcript is read against the baseline.
- Log each decision the spec left open in [choices.md](choices.md).
- Update this section before ending a pass.

Checklist:
- [x] [01 Output by default: one `issues` contract and a refusal ledger](slices/01-issues-contract.md) (`AGENTS.md` line waits on the user)
- [x] [02 Stale derived generations self-recover](slices/02-stale-derived-self-recovery.md)
- [x] [03 Long-media transcription always publishes](slices/03-transcription-publishes.md)
- [x] [04 Audio treatments publish their best result](slices/04-audio-treatments-publish.md) (`UNAVAILABLE_SUPPORT` moved to 07b)
- [x] [05 Short-window level for word-sized ranges](slices/05-short-window-level.md) (closed by probe: no new field)
- [x] [06 Ranges and messages](slices/06-ranges-and-messages.md)
- [x] [07 The remaining gates: publish, or justify the refusal](slices/07-remaining-quality-gates.md)
- [x] [08 Multicam sync: no new primitive (closed by decision)](slices/08-sync-estimate.md)
- [x] [09 View-shot fixtures](slices/09-view-shot-fixtures.md)
- [ ] [10 Skill guidance](slices/10-skill-guidance.md) (written; evals wait on the installed build)
- [x] Full suite run (the ledger's `pendingConversion` is empty)
- [ ] [11 Replay acceptance](slices/11-replay-acceptance.md), then [close-spec](../../.agents/skills/close-spec/SKILL.md)

## Slice graph

```
01 issues + ledger ──► 02 self-recovery ──► 03 transcription ──┐
                  │                    └──► 04 audio ──────────┤
                  ├──► 06 ranges ──────────────────────────────┤
                  └──► 07 other gates ─────────────────────────┤
05 short-window level (after 02) ──────────────────────────────┤
09 view shots (independent) ───────────────────────────────────┤
08 sync: closed, folded into 10 ───────────────────────────────┴──► 10 skill ──► full run ──► 11 replay
```

Ordered by dependency, then pain: transcription cost ~25 minutes and 13
manual requests; mastering took four edit/measure rounds.

## Single owners (refactor-clean)

The plan adds no parallel abstraction. Each concept has one owner, and the
old copies are deleted in the slice that replaces them:

| Concept | Owner | Replaces |
| --- | --- | --- |
| Issue type and code registry | `packages/composition/src/issues.ts` (protocol re-exports) | `violations[]`, `failedGates[]`, `omitted`/`addedOverlaps`/`discardedStyling`, the thrown `issues[]` in `project-window.ts`, status `"refused"` in results |
| Issue storage | `output_issues` table, `packages/core/src/issues.ts` | issues inside evidence objects (never added) |
| Refusal classification | `packages/protocol/src/refusal-ledger.test.ts` + `refusal-ledger.json` | the audit doc, which becomes historical evidence |
| Range admission | `admitRange` in composition | ~13 per-site range checks |
| Stale-artifact detection | historical execution schema in `transcript.ts` + producer identity in the job input | strict literal parse of stored rows |
| Best-attempt audio publication | `audio-measurement.ts` | `checkProjectAudioResult` re-running the refusing gates |

There is no transitional scaffolding. `pendingConversion` is the one
short-lived list, and slice 11 asserts it empty.

## Governing principle: output by default

Set by the product owner on 2026-10-12, and implemented by
[slice 01](slices/01-issues-contract.md).
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
gate the audit found; slice 01 adds a ledger test so new quality-gate
refusals can't creep back, and states the principle in `AGENTS.md`.

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
- **Primitives only.** This is the product owner's rule. Yap ships
  primitives and evidence. It ships no use-case-specific tools, no business
  logic, and nothing that adds complexity an agent could handle itself with
  existing primitives. Slice 08's "no sync primitive" applies this rule; apply
  it to any new operation a slice is tempted to add.
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
  `transcript.render.get` instead (slice 06c). Returning words from prepare
  lost: it would be a special case.
- **Denoise word loss.** Skill guidance comparing `waveform.get` buckets on
  the dry and processed taps. Slice 05's probe showed a whole-word `rmsDbfs`
  reads 3.4 dB where 20 ms buckets show the 10–16 dB loss, so the field lost:
  it would duplicate `waveform.get` and hide the loss. A dedicated per-word
  attenuation operation lost earlier for the same reason.
- **Which mic recorded what.** Skill guidance using `audio.measure` across
  sources. A loudness summary inside `asset.get` lost: it would start a heavy
  job from a cheap describe call.
- **Placement and read ranges.** A partly valid range is clamped with
  `range-clamped`, shortening the placement (slice 06). Rejected: holding the
  last frame (invents picture), and "refuse; report the end" (lost to the
  principle). Single points outside a domain stay refusals.
- **Gain-only normalization that can't meet both targets.** The peak ceiling
  wins and loudness is reported unmet (slice 04). Rejected: applying the full
  requested gain, which would ship clipped audio (receipt 05 would have hit
  about +6.7 dBTP).
- **Issue storage.** A separate additive `output_issues` table, never fields
  inside retained evidence, so 0.1.33 evidence stays byte-identical and its
  strict schemas still accept it.
- **No severity levels on issues.** Ranking problems would be an editorial
  call.
- **Issue owner.** `composition`, because it's the root package (protocol and
  core depend on it). Rejected: `protocol` (two drafts proposed it, but
  composition's caption and framing code needs the type).
- **0.1.33 transcript packages.** On import, drop the stale transcript and
  regenerate it, rather than refusing the package (slice 02).
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
