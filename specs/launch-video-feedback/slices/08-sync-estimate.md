# 08 Multicam sync estimate, information only

**Open decision C.** Default, applied if the user hasn't answered: keep this
slice in this spec, last, gated by its probe.

**Unlocks.** A caller can ask for an audio-based offset estimate between two
sources. The result is a `CorrespondenceMeasurement` carrying:
- the candidate peaks;
- the peak strength;
- per-window offsets.

It is never admitted automatically. The caller passes it to the existing
`correspondence.prepare` (`packages/core/src/correspondence.ts:23`,
`admitCorrespondence`). No automatic retime.

**The constraint it must keep.** The archived
[synchronization study](../../done/video-editing-feedback/assets/20-synchronization/README.md)
refused unlike-mic correlation (best |r| about 0.197 against a 0.35 gate).
Those thresholds stay frozen. The Python experiment in
`packages/test-harness/editing/synchronization` stays a comparator, never a
production fallback.

**Probe first, and it decides whether this slice ships.** Run the frozen
protocol, unchanged, on these two fixtures:
- `fixtures/launch-video/narration.mov`;
- `fixtures/launch-video/dji-0117-audio-3.36-73.36.wav`.

The session's hand estimate was narration = DJI file time + 146.58 s. The
excerpt starts at DJI 3.36 s, so excerpt time 0 is narration 149.94 s.
Two things must both hold:
1. it lands near that offset;
2. the nine retained unlike-mic pairs still refuse.

If both can't hold without retuning, close this slice as a retained refusal:
keep the receipt, keep the fixture pair, and build nothing. This pair is unlike
mics again: the close lav recorded by the DJI against the Mac's built-in mic
across the room. It may also fall below the gate.

**Seam (only if the probe passes).**
- A distinct estimator recipe and receipt type in
  `packages/protocol/src/correspondence.ts` and
  `packages/core/src/correspondence.ts`.
- `correspondence.prepare` admission stays unchanged.
- The acquisition binding offset (narration `sourceToAssetOffsetUs` −47487)
  is handled explicitly, never folded silently into the estimate.

**Red tests first (`packages/core/src/correspondence.test.ts`).**
- The fixture pair.
- A replay of the retained unlike-mic refusals.

**Delegated.** The operation name (`correspondence.estimate` or similar) and
the window count.
