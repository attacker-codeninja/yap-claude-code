# 11 Acceptance: a fresh agent does one focused task on the real inputs

**This is the spec's acceptance criterion, set by the person who owns the
product, and scoped down by them on 2026-10-13.** The original plan replayed
the whole three-turn launch-video edit. The owner narrowed it: a fresh Claude
Code agent on **Claude Opus 5.5** (`claude-opus-5-5`, the baseline's model)
does one concrete task that crosses every fixed path, and its transcript is
read against the baseline, issue by issue. A whole re-edit isn't needed to
prove the product no longer fails where the baseline did.

## The task

Sent verbatim, with no hint of what was broken:

```
Using the yap CLI, cut a ~30-second teaser from recording d0e524d3-fa76-4556-aab3-04aeed386a48, starting at my pitch ("So, introducing Yap…"). ~/Downloads/DJI_20261013075219_0117_D.MP4 is the same take from a farther camera: line it up and cut to it for a few seconds in the middle. Put the B-roll clip ~/Downloads/DJI_20261013080249_0122_D.MP4 in as an 8-second cutaway near the end. Fade the first shot in from black. Clean up the room noise without losing any words, master the audio to -14 LUFS with peaks under -1 dBTP, and export it to ~/Movies/yap-replay-check/teaser.mp4. Tell me anything I should know about the result.
```

What each part crosses:
- **Transcript of the 3:52 narration, to find the pitch:** seam disagreement,
  timing overrun and hand-chunking.
- **Lining up the far camera:** cross-correlation by hand (no sync primitive,
  by decision).
- **An 8 s cutaway from a 7.3 s clip:** the source-bounds refusal.
- **A fade from black:** the curve-clock error.
- **Denoise without losing words:** RMS arithmetic outside Yap.
- **-14 LUFS under -1 dBTP on this peaky narration:** normalization
  infeasible or unmet.
- **The export:** delivery of the mastered result.

## Environment

Decided with the owner: no app install.
- **Library.** The user's library is cloned copy-on-write to
  `~/.yap-replay/library`, which also serves as the 0.1.33 compatibility
  check (the new build must open and edit the recording).
- **Service and CLI.** This checkout's service runs on that clone, and `yap`
  on the agent's PATH is this checkout's CLI, pinned to that service.
- **Skill.** The personal yap skill points at this commit's skill for the
  run.
- **Working directory.** The agent works in a clean worktree at this commit,
  without the spec, fixtures or checker.
- **Rate limits.** If the agent is rate-limited, the runner resumes the same
  session with "continue". That is a recorded deviation.

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

**Quality isn't lowered to pass.** The run must still deliver the finished
teaser. Review its export the way the baseline was
reviewed:
- frames;
- rendered-speech ASR of the final mix;
- section loudness.

A run that "passes" by skipping transcription or mastering fails.

## Expected nondeterminism (not failures)

- **Editorial choices.** A different cut, music or graphics design.
- **A different amount of work.** Provided the issues above don't
  recur.

Judge the product's behaviour, not the agent's taste.

## Would change this slice

- If Opus 5.5 is no longer available, stop and ask. Don't substitute a model.
