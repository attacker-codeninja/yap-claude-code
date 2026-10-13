# Session retrospective: the Yap launch video

What happened when an agent used Yap 0.1.33 end to end on real material to make
the product's own launch video (2026-10-12). This is session history, not a plan.
The plan is in [README.md](README.md).

## The job

Inputs:
- Recording `d0e524d3-fa76-4556-aab3-04aeed386a48`: a 3:52 take with a window
  capture, narration from the Mac mic, and the MacBook camera.
- Five DJI Osmo files (4K HEVC 29.97, stereo AAC): the same take from a far
  camera, two later takes, and two silent B-roll shots.

Delivered: three revisions of a ~2-minute launch video. The user published v3,
the cut whose first ten seconds lead with the multicam wall.

## What worked without friction

- **Composition.** `edit.apply` with labels, clip and output processing stacks,
  keyframed geometry, opacity and gain, ProRes 4444 alpha overlays, image holds,
  and `export.create`. A 149-operation batch built the whole 2-minute
  composition in one revision.
- **Evidence reads.** `frame.batch`, `audio.get` on track taps, `audio.measure`
  per section (once the output stack was feasible) and `transcript.render.*` on
  the mix were enough to review joins, levels and visuals without a human
  watching.
- **Recovering intelligibility.** Measuring dialogue and music taps separately
  showed the bed sat only 5.6 LU under speech; −6 dB fixed it. The rendered-
  speech transcript of the final mix caught a word lost to denoise that no
  level meter flagged.
- **Native UI renderers.** `capture-view-shots.mjs` and `library-view-shots.mjs`
  produced real product UI for the video without accessibility permissions.

## Where time went, ranked

1. **Transcription of long media** (~25 minutes, 13 manual requests). Full-support
   preparation failed at one internal seam. Explicit ranges failed at seams and
   at the end of media. The workaround was ≤20 s chunking with seam
   correspondence lost. See FEEDBACK §1–3.
2. **Mastering** (four edit/measure rounds). An infeasible output normalization
   failed every `audio.measure`, including upstream taps. Dynamic mode was
   refused for a 0.1 LU miss. The working recipe (pre-limiter, then gain-only
   normalization) needed a hand-tuned ceiling. See FEEDBACK §4.
3. **Dialogue source discovery.** Which mic recorded what was only found by
   measuring: −36 LUFS narration against −17.6 on the DJI lav. See FEEDBACK §6.
4. **Multicam sync.** Hand-rolled audio-envelope cross-correlation found the
   offset (146.58 s, no drift at two windows). `correspondence.prepare` has no
   estimator. See FEEDBACK §6.
5. **Paper cuts.** `--wait` progress text in stdout, no label → id map in edit
   receipts, opaque curve-clock and source-bounds errors, a render range admitted
   then failed. Each cost one round trip.

## Agent-side mistakes, not product defects

These belong to the editing agent's own workflow; they're recorded so a spec
doesn't try to fix them in the product:
- zsh word-splitting in loops;
- music rebuilt without updating the drop time once;
- a graphic slot left at its old start time;
- the countdown kept even though it was spoken off-mic.

## Policy observations worth keeping

- **Denoise isn't free.** rnnoise at mix 0.85 cut the noise floor by 17 dB but
  took 14–16 dB off a soft trailing word. A rendered-speech transcript of the
  processed mix is the check that catches it.
- **Strictness has a cost.** Refusing a −14.1 LUFS result against a −14 target
  blocked a delivery that every listener would accept. A tolerance or a
  best-effort mode keeps the honesty without the deadlock.
- **Self-recovery over compatibility.** The user's rule for this work:
  recordings made with 0.1.33 must keep working, and derived artifacts
  (transcripts, prepared audio, indexes) may be invalidated as long as the
  system detects the stale or incompatible version and regenerates on its own.
