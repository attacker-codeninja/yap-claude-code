# Acceptance run: reading notes

One focused task (slice 11), sent verbatim to a fresh Claude Opus 5.5 session
on 2026-10-13 against a copy-on-write clone of the person's library. Mechanical
counts are in [checker-output.txt](checker-output.txt). The transcript itself
is personal session content and is not committed.

## Result

A 33.05 s teaser, `~/Movies/yap-replay-check/teaser.mp4` (1920×1080, 30 fps).
- The decoded export measures −14.0 LUFS and −1.6 dBTP.
- Frames on both sides of every cut land on the planned shot.
- The fade goes from black over the first second (mean luma 0, 41, 74, 106 and
  137 at 0, 0.1, 0.3, 0.6 and 1.0 s).
- The agent compared a transcript of the final mix with the untreated audio
  and found every word present.

## Per baseline issue

| Baseline issue | This run |
| --- | --- |
| Seam disagreement (3 results) | **Gone.** The 3:52 narration came back in one `transcript.review`. The three seam words arrived as `boundary-unresolved` issues, and the agent read them. |
| Timing overrun (4) | **Gone.** No refusals. |
| Hand-chunked transcription | **Gone.** No `executionRange` loops. |
| Normalization infeasible (3) or unmet (2) | **Gone.** The first −14 LUFS / −1 dBTP request published with `normalization-target-unmet` instead of refusing. The agent read the issue's evidence, put a limiter before normalization, and met both targets on the next try. |
| Curve-clock error (1) | **Not hit.** The fade from black was authored correctly on the first attempt. |
| Source-bounds error (1) | **Never needed the path.** The agent read the B-roll's 7.3 s length before placing it and chose to slow it to 91% to fill the 8 s asked for, reporting that. |
| Render range admitted then failed (1) | **Not hit.** |
| Hand-rolled cross-correlation (2) | **1, as expected.** There is no sync primitive, by decision. The agent paired transcript words and cross-correlated the two microphones. Both gave 146.624 s against the full DJI file, consistent with the fixture's 149.94 s against its 3.36 s excerpt plus the asset's 47.5 ms lead-in. It checked drift at a second window 45 s away. |
| RMS arithmetic outside Yap (4) | **0.** It checked denoise word loss with `waveform.get` on the dry and processed taps and the rendered transcript. It found "Mac" softened to "map" and eased the mix over that word. |

## New friction (read from the transcript, not the summary)

- **`INVALID_PARAMS` named nothing.** It came up twice, on
  `processing.capabilities` and `export.create`, with `details: {}`. The
  export needed a UUID `exportId` and an `audio.codec`, and the agent had to
  dig both out of the schema. **Fixed:** `admitOperation`
  (`packages/protocol/src/index.ts`), shared by the CLI and the service, now
  returns `details.invalid` with each rejected field's path and message.
- **The agent's summary overstated two checks.** These are agent findings,
  not product defects.
  - It said "every word is there", but its own diff shows the filler "uh" at
    30.08 s missing from the final mix.
  - Its two mix dips over "Mac" still transcribed as "map". Only the final
    mastered render read "mac", which is weaker evidence than the summary
    implies.
- None of the baseline's workarounds recurred, and no new refusal appeared.

## Verdict

Accepted. None of the fixed issues recurred, and the run delivered a finished,
checked teaser. The checker's first count showed one "RMS outside Yap"; that
was the cross-correlation script's normalization. The checker was corrected,
and the baseline's counts are unchanged.
