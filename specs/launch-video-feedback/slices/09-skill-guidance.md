# 09 Skill guidance

**Unlocks.** The consumer skill (`skills/yap`) teaches the workflows this spec
makes possible. It reflects only what earlier slices actually shipped; check
each slice's recorded outcome first.

**Changes (`skills/yap/references/media-workflows.md` and
`creative-workflows.md`).**
- **Transcription:**
  - explicit ranges are windowed too;
  - how to read `boundary-unresolved` and `end-clamped`;
  - the windowing is no reason to hand-chunk anymore.
- **Mastering:**
  - the feasibility arithmetic (peak-to-loudness ratio and maximum feasible
    target);
  - measure with the `dry` or `after-step` taps while the output is
    infeasible;
  - `onMiss: "publish"`, if slice 04 shipped.
- **After denoise:**
  - render speech on the dry and processed taps and diff the words;
  - for any word that disappeared, compare `rmsDbfs` on both taps over its
    range;
  - keyframe the `mix` down over that word if the caller wants it back.

  This is guidance, never an automatic treatment.
- **Which mic recorded what:** `audio.measure` each candidate source over one
  shared range before choosing the dialogue source.
- **Multicam:** the estimate → `correspondence.prepare` workflow, only if
  slice 08 shipped.

**Verify.** Follow [write-skills](../../../.agents/skills/write-skills/SKILL.md),
and confirm every operation or field named exists in the installed CLI's
`--help`. Eval the skill with
[eval-skills](../../../.agents/skills/eval-skills/SKILL.md) on one case: "this
3:52 narration won't transcribe", using `fixtures/launch-video/narration.mov`.

**Then** run the full suite once, and close the spec with
[close-spec](../../../.agents/skills/close-spec/SKILL.md).
