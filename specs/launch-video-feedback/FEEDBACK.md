# Feedback from making the Yap launch video with Yap

Written by the agent that edited the launch video (recording
`d0e524d3-fa76-4556-aab3-04aeed386a48` plus five DJI files), for whoever works on
this repo next. Each item is something that cost real time, with the evidence and
what I'd change. Ordered by how much it hurt.

> **Corrections after code recon (2026-10-12).** This snapshot is kept as
> written; these notes override it where they conflict.
> - **§6 "`--wait` mixes progress text into stdout" is wrong.** Progress goes
>   to stderr (`apps/cli/src/main.ts`, pinned by `apps/cli/src/wait.test.ts`).
>   The session captured with `2>&1`, which is why receipt 05 starts with a
>   progress line.
> - **§6 "labels aren't returned as a map" is wrong.** `edit.apply` returns
>   `edit.labels` (`packages/composition/src/edits.ts`). The session only read
>   `createdIds`.
> - **§4 "measurements of a single track tap" failing is unverified.** Every
>   failing read in the session was on the default output tap. Ranged output
>   reads fail because output normalization is whole-domain state.
> - **§4's dynamic-mode refusal was about true peak, not loudness.** −14.1
>   against −14 is inside the ±0.2 LU tolerance. −1.8 dBTP against a −2
>   ceiling exceeds the 0.15 dB allowance. A ±0.5 LU tolerance wouldn't have
>   helped.
> - **§6 `overlay-shots.mjs` exit 7 was a usage error.** `dist/Yap.app` wasn't
>   built (spawn ENOENT).
> - **§1–2 refusals are deliberate design.** "No estimate is silently
>   repaired" (`helpers/mac/Sources/YapSpeech/README.md`). Any fix must keep
>   raw evidence and make every repair explicit; see README.md.

## 1. Full-length transcription refuses on a single seam disagreement

**What happened.** `transcript.review` on the 3:52 narration
(`9ddcb13c…`, `track:1`) failed nonretryably:

```
TRANSCRIPT_BOUNDARY_DISAGREEMENT
Boundary ExactTime(120000000/1): left observation 85 'I' [119120000,119200000]
has no unique mandatory shared-context correspondence.
```

One ambiguous one-letter word at one internal 20 s seam threw away the whole
recording's transcript. A bounded `transcript.prepare` with
`executionRange` 119–230 s hit the same thing at the 219 s seam ("videos").
Anything longer than one internal window is exposed. The only way through was
hand-chunking into ≤20 s `executionRange`s (13 separate requests across four
files), then stitching rows myself. That loses the cross-window word
correspondence the seam logic exists to protect.

**What I'd change.**
- A seam disagreement should degrade locally, not fail the job. Keep both
  candidates as raw evidence and mark that word as `ambiguous-boundary`. Or
  re-decode that seam with a shifted window. Publish everything else.
- If refusal must stay, make it retryable with a different window phase. Or
  have `transcript.review` do the shifted-window retry itself, since it is
  meant to be the agent-friendly call.
- Short function words ("I", "the") at seams look like the common failure.
  Test fixtures should include seams landing mid-phrase on one-letter words.

## 2. The last word of a file can exceed the file and fail the request

```
INVALID_SPEECH_TIMING
Segment 5 token 88: engine estimate [16.56,16.72] exceeds interval
[215000000, 231701333)
```

The engine's estimate ran ~20 ms past the end of the media, and the whole
range was refused. Retrying with the exact fractional end (`695104000/3`)
changed nothing. I had to cut the request short of the real end, which risks
dropping the last word. The same thing happened on a mid-file 20.5 s chunk
(`[12.4,12.56]` past a 12.5 s window end).

**What I'd change.** Clamp an estimate that overruns the *physical end of
support* (and mark it clamped), rather than refusing. An overrun at an
arbitrary caller window end could also be clamped with a diagnostic. ASR
timestamps are estimates and the docs already say so.

## 3. Ranged preparation still splits into internal windows, silently

An `executionRange` longer than 20 s is split into internal windows with the
same seam rules, so a caller can't avoid #1 by asking for a bigger range. The
`--help` text describes the 20 s windowing only for the *omitted* range case.
Say so for explicit ranges too, or accept a caller-chosen window length.

## 4. Mastering: an infeasible output target blocks every audio read

Putting `normalization` on the **output** stack turned every `audio.measure`
into a failed job: `NORMALIZATION_NOT_FEASIBLE`, "Gain-only treatment cannot
meet the requested range or peak ceiling". That included section measurements
and measurements of a single track tap. The section numbers I needed to fix the
mix were only reachable from `errorDetails.before`, and only for the whole
program. Then `dynamic` mode landed at −14.1 LUFS / −1.8 dBTP against a
−14 / −2 request and was also refused ("misses the requested normalization
targets"), so the whole render path was blocked over 0.1 LU.

What finally worked: a limiter *before* gain-only normalization, with the
ceiling tuned by hand until peak-to-loudness fit (−11.5 dBFS for −15 LUFS /
−1 dBTP). That took four edit/measure rounds.

**What I'd change.**
- Measuring a tap upstream of the output stack shouldn't depend on the output
  stack being feasible.
- Report the pre-treatment peak-to-loudness ratio and the largest feasible
  target in the refusal, so the fix is one step, not four.
- Give `dynamic` mode a documented tolerance (±0.5 LU is normal practice), or
  make it a separate "best effort" mode that publishes with a diagnostic.

## 5. Denoise silently eats soft words

`rnnoise` at `mix: 0.85` on the Mac-mic clips cut 17 dB of room noise but also
took 14–16 dB off a trailing, soft "okay?". The rendered-speech transcript lost
the word entirely. At `mix: 0.6` it was still gone. The fix was a keyframed mix
falling to 0 over that one word, which works because the processor accepts
curves. A per-word "speech attenuated by more than N dB" diagnostic comparing
the dry and processed taps would catch this without a human listening. The
rendered-transcript diff did catch it, so that's the check to recommend in the
skill after any denoise.

## 6. Smaller friction

- **`edit.apply` labels aren't returned as a map.** I had to zip `createdIds`
  with my own operation order to recover label → id. Return `{label: id}` in
  the receipt.
- **`transcript.render.prepare` returns no words.** It needs a second
  `transcript.render.get` with the generation. A ranged request past the
  project end comes back as a *failed job* ("Rendering requires a nonempty
  range within the pinned project"), not an `INVALID_PARAMS` refusal at
  admission. Refuse it up front.
- **Which mic recorded what wasn't discoverable.** The person held a wireless
  mic paired to the DJI camera. The Mac's `narration` track was ~19 LU quieter
  during the pitch (−36 LUFS vs −17.6). Nothing in recording metadata hints at
  that; I only found it by measuring. A per-source loudness/SNR summary in
  `asset.get` or `recording.get` would make picking the dialogue source
  immediate.
- **Showing the app UI in marketing needs real screenshots.** The offscreen
  renderers (`apps/macos/tests/capture-view-shots.mjs`,
  `library-view-shots.mjs`) worked well, but every image has
  "Synthetic facts · presentation fixture" / "Library · Synthetic presentation
  fixture" baked in, which I had to crop or paint over. An option to omit the
  fixture label would make these reusable for the site and videos.
  `overlay-shots.mjs` exited with code 7 (log in the session workspace); worth
  checking.
- **Clip-curve clock errors are opaque.** Integer `at` keys on a clip
  processor fail with "Processing curve must match its clock". Only by probing
  did I learn clip curves need *fractions of clip duration* while project
  windows take microseconds. Name the expected clock in the error.
- **Placing a movie a fraction of a frame longer than its asset fails
  outright.** A 343-frame graphic (11.444 s) in an 11.46 s slot gave "Selected
  range exceeds source bounds". A hint with the asset's exact end, or an opt-in
  clamp to the last sample, would save a round trip.
- **`--wait` mixes progress text into stdout.** Lines like
  `audio.measure: failed` and `export.create: processing` come before the JSON
  envelope on stdout, so `yap … --wait > receipt.json` doesn't produce valid
  JSON. Send progress to stderr.
- **Camera-angle sync worked but was manual.** I cross-correlated audio
  envelopes myself to find the DJI ↔ narration offset (146.58 s, no drift).
  `correspondence.prepare` only admits caller-supplied measurements. A built-in
  audio cross-correlation estimator would make multicam edits much easier.
