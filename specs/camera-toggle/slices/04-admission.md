# 04 Admission of gapped camera proof (core)

**Contract unlocked.** A camera acquisition's `available[]` equals the proof's intervals minus
the asset origin. A legacy single-span proof admits unchanged.

**Shape** (`packages/core/src/evidence.ts`):
```ts
export type CameraPublicationProof = SourcePublicationProof & Readonly<{
  mapping: SourceFileProof;
  support: SelectionRange;
  gaps?: readonly SelectionRange[];
  representedFrames: number;
}>;
export function cameraProofIntervals(proof: CameraPublicationProof): SelectionRange[]; // sole TS owner
```
The validator (`evidence.ts:247-254`) applies the same `gaps` rules as Swift (slice 02).
`acquisitions.ts:1209-1228` compares `available` with `cameraProofIntervals(camera)` shifted by
the asset origin, keeping the deep-equal check and the error "Camera physical support differs
from verified source support". `assets.ts:800-858` already derives `available[]` from non-empty
edit segments; do not change it.

**Verification (tests first).**
- `packages/core/src/evidence.test.ts`: malformed `gaps` refused; absent `gaps` = one interval.
- `packages/core/src/acquisitions.test.ts`: two-interval proof against a probed asset with empty
  edits admits; a probe that covers the gap continuously (a held picture) is refused; a proof
  whose gaps don't match the probe is refused; the corpus-A receipt literal from slice 01 admits
  unchanged.
- `packages/core/src/capture-acquisition.test.ts`: the admission path.
- `packages/test-harness/editing/camera-source-admission.mjs` extended with slice 02's gapped
  output: the first real `media.probe`-against-receipt rounding check at µs scale.

**Must stay green.** Audio interval tests, `evidence-owner`, `evidence-pages`, composition and
source-index tests, and the slice 01 gate (re-run here).

**Firewall.** No camera special case in composition, assets or rendering.

**Delegated.** Whether the helper returns a copied or frozen array.
