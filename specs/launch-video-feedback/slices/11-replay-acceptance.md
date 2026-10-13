# 11 Replay acceptance: a fresh agent edits the same launch video

**This is the spec's acceptance criterion, set by the person who owns the
product.** After slices 01–10 ship:
1. A fresh Claude Code agent on **Claude Opus 5.5** (`claude-opus-5-5`, the
   model of the baseline session) edits the same launch video, from the same
   inputs and prompts, on the built product.
2. Its transcript is read against the baseline, issue by issue.

The spec is accepted only when none of the fixed issues recurs, and every
remaining difference is explained.

## Inputs (exactly the baseline's)

- **Recording `d0e524d3-fa76-4556-aab3-04aeed386a48`**, made by Yap 0.1.33.
  The replay uses the person's existing library, where it lives today, as
  the 0.1.33 compatibility check: the new build must open and edit it.
  - If the library copy is gone, restore it from
    `fixtures/launch-video/session/recording/` with `acquisition.import`,
    after `git lfs pull --include="fixtures/launch-video/session/**"`.
  - Record that deviation: the recording ID changes.
- **The five DJI files**, placed in `~/Downloads` before turn 1, from
  `fixtures/launch-video/session/downloads/`. Hashes are in
  [provenance](../../../fixtures/launch-video/provenance.json); the asset IDs
  equal the SHA-256s.
- **The prompts** in [acceptance/prompts.md](../acceptance/prompts.md), with
  their recorded deviations.

## Environment

- **Build and install.** Build the product at the spec's final commit and
  install it the normal way, so the global `yap` command and consumer skill
  match that commit. Record the `yap --version`, `cli.status` and
  `skill.status` receipts.
- **Agent.** A fresh worktree of this repository at that commit, matching the
  baseline's working directory (the baseline ran inside a t3code worktree of
  this repo), then:

  ```
  claude -p --model claude-opus-5-5 "<turn 1>"
  claude -p --resume <session-id> "<turn 2>"
  ```

  and so on for each turn. Keep the agent's own skills and tools as installed.
- **Isolation.** Don't seed the agent with this spec, `FEEDBACK.md`, the
  baseline transcript, or any hint about the issues. It must meet the product
  the way the first agent did.
- **Duration.** The baseline took several hours of agent time across turns.
  Run each turn in the background with progress visible, and don't poll in a
  loop.

## Reading the transcript

1. **Mechanical pass.** A checker reads the replay's Claude Code session JSONL
   (under `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`):
   - Owner: `packages/test-harness/acceptance/launch-video-replay.mjs`.
   - It counts the same signatures as
     [baseline-signatures.txt](../acceptance/baseline-signatures.txt):
     product refusals, matched in **tool results only**, by code or message
     text.
   - It also counts effort signals: `transcript.prepare` / `transcript.review`
     calls, `audio.measure` calls, hand-rolled cross-correlation, and RMS
     arithmetic outside Yap.
   - **Red first.** Run it on the baseline transcript
     (`a4621b78-f275-489e-bb3c-b5a5deacde5d.jsonl`, SHA-256 `d367948d…`, 1,442
     lines, on this Mac) and confirm it reproduces the baseline counts. Stop
     the count at the person's message "I already launched with the video you
     exported", where the baseline's editing phase ends.
2. **Reading pass.** Then read the replay transcript itself, by eye, start to
   finish. For each [FEEDBACK](../FEEDBACK.md) item, note whether the agent:
   - hit it;
   - worked around it;
   - never needed the path.

   Also note any *new* friction the baseline didn't hit. A new problem is a
   finding, not a pass.
3. **Evidence.** Save the replay transcript's hash, the checker output, and
   the reading notes in `assets/replay/`. Don't commit the transcript itself;
   it is personal session content, like the baseline.

## Pass criteria, per baseline issue

| Baseline issue | Pass |
| --- | --- |
| Seam disagreement (3 results) | Zero. Long media transcribes in one request; seam words carry `boundary-unresolved`. |
| Timing overrun (4 results) | Zero refusals for overruns of up to one frame; `timing-clamped` issues appear where expected. |
| Manual ≤20 s chunking | No hand-chunked `executionRange` loops. |
| Normalization infeasible (3 results) or unmet (2 results) | Zero refusals: every treatment publishes on the first try. Any miss arrives as a `normalization-target-unmet` issue with the excess and `maximumFeasibleTargetLufs`. No measurement fails because of the output stack. |
| Curve-clock error (1) | If it occurs, the agent fixes it in one step from the error's details. |
| Source-bounds error (1) | Zero refusals: the placement lands, with `range-clamped`. |
| Render range admitted then failed (1) | A partly valid range publishes, clamped, with `range-clamped`; a range wholly outside refuses at admission. |
| Hand-rolled cross-correlation (2) | Expected: there is no sync primitive by decision (slice 08). Record the effort, and whether the agent followed the slice 10 recipe. |
| RMS arithmetic outside Yap (5; a hand count first said 4) | Replaced by comparing `waveform.get` on the dry and processed taps (slice 05 closed with no new field). |
| Fixture labels painted over | Unlabelled shots used, or the agent passes `FIXTURE_LABEL=omit`. |
| Any class-B refusal in the [audit](07-remaining-quality-gates.md) | Zero. Any quality or target miss arrives as an issue on a delivered output. |

**Quality isn't lowered to pass.** The replay must still deliver a finished
launch video for each turn. Review its export the way the baseline was
reviewed:
- frames;
- rendered-speech ASR of the final mix;
- section loudness.

A replay that "passes" by skipping transcription or mastering fails.

## Expected nondeterminism (not failures)

- **Editorial choices.** A different cut, music or graphics design.
- **A different number of turns of work.** Provided the issues above don't
  recur.

Judge the product's behaviour, not the agent's taste.

## Would change this slice

- If the person asks for the music turn to be replayed, add it, with its
  Duet dependency recorded.
- If Opus 5.5 is no longer available, stop and ask. Don't substitute a model.
