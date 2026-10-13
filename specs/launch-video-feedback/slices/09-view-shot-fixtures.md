# 09 View-shot fixtures

**Unlocks.** The offscreen capture and library renderers can produce
unlabelled shots for the site and videos. The overlay script fails with a
useful message.

**Seam.**
- One environment variable, `FIXTURE_LABEL=omit`, read by:
  - `apps/macos/tests/capture-view-shots.mjs` and `library-view-shots.mjs`;
  - their fixtures: `apps/macos/tests/fixtures/capture-view.swift`
    ~L158–162 (caption) and `library-view.swift:41` (window title).
- The default stays labelled, so review shots remain honest about being
  synthetic.
- `apps/macos/tests/harness.mjs` `launch()` (~L119) checks that `dist/Yap.app`
  exists and throws "Build dist/Yap.app first". Today it spawns blind, gets
  ENOENT, and `node:test`'s `after()` turns that into exit 7. The session's
  log shows exactly this: no app was built. It was a usage error, not a
  product defect.

**Red tests first.**
- A harness test, modelled on `harness-interrupt.test.mjs`: a missing app
  gives the clear message.
- The shot scripts honour `FIXTURE_LABEL=omit`.

**What a human can see, and how to accept it.**
1. Generate the idle capture shot and the recordings library shot, each with
   and without the label.
2. Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md)
   of each unlabelled shot against its labelled counterpart. The **slice
   variable** is the label region only, cropped to:
   - the capture caption strip;
   - the library title bar.

   Everything else must be pixel-identical.
3. Last check before accepting: run
   [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
   on the unlabelled shots.
4. Open both with
   [preview-shots](../../../.agents/skills/preview-shots/SKILL.md). This is a
   non-blocking checkpoint: allow about 5 minutes for the user to respond. If
   there's no response, decide on the evidence, record the decision here,
   close the shots, and continue.

**Out of scope.** Fixture data itself, such as the synthetic dates and the
"finalizing" row.

**Must stay green.** The existing shot runs (labelled), and
`settings-view-shots.mjs`.

**Delegated.** The variable's name, and whether `settings-view-shots` also
honours it.

## Verdict (2026-10-13): accepted

The preview checkpoint was skipped (this was an unattended run), so the
decision rests on this evidence:

- **Compare.** Each unlabelled shot was compared with its labelled
  counterpart at 2x backing scale. Outside the label region they are
  pixel-identical: 0 of 762,048 pixels differ on the capture `idle` shot and
  0 of 1,462,272 on the library `recordings` shot. Inside the region:
  - the caption strip (bottom 40 px) has 1,916 of 31,360 pixels changed,
    mae 0.80;
  - the title bar (top 64 px) has 4,228 of 98,304 pixels changed, mae 4.05.

  The title now reads "Library", matching the production window.
- **Critique.** An unprimed review of the unlabelled shots and zoomed crops
  of both label regions found no leftover text, clipping or artifact there.
  It also raised points that this slice doesn't change: the library renders
  as an inactive window (grey traffic lights), the fixture's "finalizing"
  row (out of scope), placeholder thumbnails, and alignment and contrast
  nits. These belong to whoever picks shots for the site and video.
- **Evidence.** [`assets/09-view-shots/`](../assets/09-view-shots/) holds
  each shot, labelled and unlabelled.
