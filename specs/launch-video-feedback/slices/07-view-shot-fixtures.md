# 07 View-shot fixtures

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
