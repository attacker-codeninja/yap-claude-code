# 08 Multicam sync: no new primitive (closed by decision)

**Decision C, revised by the product's user (2026-10-12).** No synchronization
primitive. Multicam sync becomes skill guidance (slice 10), composed from
primitives Yap already has.

**Why.**
- **The session solved it with existing primitives in a few calls.**
  1. `transcript.review` on both sources.
  2. Match shared distinctive words (each appearing once in both sources).
     Their median start-time difference was 146.64 s, with every match within
     ±0.08 s.
  3. Refine with PCM from `audio.get` (or `yap ffmpeg`) and a small envelope
     cross-correlation: 146.58 s.
  4. Check a second window for drift; there was none.

  The real cost was writing correlation loops in pure Python without NumPy.
  That's the agent's environment, not a product gap.
- **A sync primitive isn't really a primitive.** Every mainstream tool
  (PluralEyes, Premiere's Synchronize) pairs waveform matching with a
  confidence threshold and drift policy. Those are product decisions about
  when to trust a match.
- **That policy has already drawn heavy machinery here once.** The archived
  [synchronization study](../../done/video-editing-feedback/assets/20-synchronization/README.md)
  built frozen protocols, thresholds, receipts and lexical scouts. Its subject
  was a different problem: a remote podcast with no shared room audio at all.
  That complexity is exactly what this product avoids.
- **It's use-case specific.** The product supplies evidence (word timings,
  PCM) and exact placement. The caller decides the offset.

**What remains.**
- Slice 10 teaches the recipe: word-anchor offset, a drift check at a second
  window, optional refinement from PCM, then explicit placement offsets.
- The fixture pair (`fixtures/launch-video/narration.mov` and
  `dji-0117-audio-3.36-73.36.wav`) stays as the skill-eval case for that
  guidance.
- Slice 11 treats hand-rolled sync as expected; it's an effort signal only.

**Would reopen this.** If a replay shows agents repeatedly failing to sync
co-located sources with the documented recipe, reconsider a narrow signal
primitive: a lag-correlation curve between two audio selections, with no
threshold and no admission policy.
