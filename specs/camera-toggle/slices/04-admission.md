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

## Status (2026-10-12)

TypeScript side done; built without slice 02 in the tree, against literal receipts of the
shape slice 02 specifies.

Done:
- `CameraPublicationProof.gaps` and `cameraProofIntervals()` in `evidence.ts`; the receipt
  validator refuses malformed `gaps` with "Invalid verified camera gaps" (not a list, empty
  list, an invalid range, unsorted, overlapping, adjacent, touching or outside `support`, more
  than 499 entries).
- `AcquisitionImporter.binding` compares the probe's `available[]` with the proof intervals
  shifted by the asset origin; the deep-equal and its error text are unchanged. Import, capture
  and portable verification all reach this one comparison.
- Tests: `evidence.test.ts` (intervals, malformed gaps), `acquisitions.test.ts` (gapped admits;
  held picture, mismatched gaps and a continuous proof over a gapped movie refused; a retained
  single-span native proof admits unchanged), `capture-acquisition.test.ts` (a published
  companion camera with a gap through the capture job: admitted with two intervals; a held
  picture fails `INVALID_EVIDENCE`). The four admission tests were seen red against the old
  single-span comparison.

Left for the integrator:
- Extend `packages/test-harness/editing/camera-source-admission.mjs` with slice 02's gapped
  native output (the real `media.probe`-against-receipt check at µs scale).
- Done at integration: the legacy test ("a 0.1.33 camera proof admits unchanged") now uses
  the proof release 0.1.33 stored for corpus B's camera take.
- Budget: resolved at integration. A take has at most 500 runs (`CAMERA_TOGGLE_LIMIT`), so at
  most 499 gaps, about 20 KB: inside the 32 KiB normalized receipt and 64 KiB
  `camera.publication.json` bounds. Both validators state 499.
