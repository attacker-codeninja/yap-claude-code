# 10 Skill guidance

**Unlocks.** The consumer skill (`skills/yap`) teaches the workflows this spec
makes possible. It reflects only what earlier slices actually shipped; check
each slice's recorded outcome first.

**Changes (`skills/yap/SKILL.md`, `skills/yap/references/media-workflows.md`,
`creative-workflows.md`, `dialogue-finishing.md`).**
- `SKILL.md:276`: read `issues` on every output; only an empty list is clean.
- `media-workflows.md` L50–52 (the "seam is refused" wording) and L167–168:
  rewrite under output by default. L118 and L156 stay, as class A.
- **Transcription:**
  - explicit ranges are windowed too;
  - how to read `boundary-unresolved` and `end-clamped`;
  - the windowing is no reason to hand-chunk anymore.
- **Mastering:**
  - the feasibility arithmetic (peak-to-loudness ratio and maximum feasible
    target);
  - measure with the `dry` or `after-step` taps while the output is
    infeasible;
  - treatments always publish (slice 04); read `targets-unmet` /
    `ceiling-unmet` issues and decide whether to accept or re-target.
- **After denoise:**
  - render speech on the dry and processed taps and diff the words;
  - for any word that disappeared, compare `rmsDbfs` on both taps over its
    range;
  - keyframe the `mix` down over that word if the caller wants it back.

  This is guidance, never an automatic treatment.
- **Which mic recorded what:** `audio.measure` each candidate source over one
  shared range before choosing the dialogue source.
- **Output by default:** read `issues` on every result before trusting it,
  including `range-clamped`, `font-substituted` and `unqualified-source`
  (slice 01 and slice 07). Remove the skill's "a refusal is a boundary"
  wording.
- **Multicam sync (there is no primitive, by slice 08's decision):**
  1. `transcript.review` each co-located source.
  2. Match distinctive words that appear once in both, and take the median
     start-time difference.
  3. Check it at a second window for drift.
  4. Optionally refine with PCM from `audio.get` and a short envelope
     cross-correlation.
  5. Place clips with explicit offsets.

  Handle acquisition binding offsets explicitly. Eval this guidance on the
  fixture pair (`fixtures/launch-video/narration.mov` against
  `dji-0117-audio-3.36-73.36.wav`): it should land near narration =
  excerpt + 149.94 s.

**Verify.** Follow [write-skills](../../../.agents/skills/write-skills/SKILL.md),
and confirm every operation or field named exists in the installed CLI's
`--help`. Eval the skill with
[eval-skills](../../../.agents/skills/eval-skills/SKILL.md) on one case: "this
3:52 narration won't transcribe", using `fixtures/launch-video/narration.mov`.

**Then** run the full suite once, and close the spec with
[close-spec](../../../.agents/skills/close-spec/SKILL.md).
