# 02 Camera availability intervals (native data plane)

**Contract unlocked.** A companion camera whose frames arrive in several runs closes, publishes
and recovers with real gaps. Off time is an explicit empty edit in the canonical `video.mov`,
never a held picture. A single-run take produces exactly today's receipt and mapping shape.

## Format

Mapping row (`camera.mapping.jsonl`):
```jsonc
{"role":"camera","disposition":"accepted","sourceUs":1234567,
 "cameraFrame":{"ordinal":41,"start":{...},"end":{...},"run":2}, ...}   // "run" omitted when 0
{"role":"camera","disposition":"camera-off","sourceUs":null,"cameraFrame":null, ...}
```
Rules (written by `CameraWriter`, validated by `CameraMedia.Mapping`): `run` starts at 0, never
decreases, and advances only when a turn-on follows a run that accepted at least one frame.

Receipt (`camera.publication.json`, `CameraMedia.Receipt`):
```jsonc
"firstUs":1200000, "endUs":31033333,              // outer span, unchanged meaning
"support":{"startUs":1200000,"endUs":31033333},  // outer span, unchanged
"gaps":[{"startUs":9033333,"endUs":14100000}]    // NEW, optional, omitted when empty
```
`gaps`: sorted, disjoint, non-adjacent, strictly inside `support`, at most 499 entries (500 runs,
`CAMERA_TOGGLE_LIMIT`). Encoded with `encodeIfPresent`. `VerifiedSource` encodes the same
`support` plus optional `gaps` into `receipt.publications.video`.

One value type owns the arithmetic, in `CameraMedia.swift`:
```swift
package struct CameraAvailability: Sendable, Equatable {
    package let support: ExactRange
    package let gaps: [ExactRange]
    package init(intervals: [ExactRange]) throws
    package var intervals: [ExactRange]
}
```
No other Swift type computes camera intervals. `ClosedCameraSource.result` keeps the outer span.

## Changes (line numbers measured 2026-10-12)

- `CameraWriter.startAcquiring(atHostUs:)` and `stopAcquiring(atHostUs:)` (one `setAcquiring` until slice 05 split it), on the writer queue, sole mutators of
  the gate. `append` (`CameraWriter.swift:41-113`) refuses with `camera-off` while off and for a
  buffer whose host interval starts before the current on-time (stale) or crosses the off-time
  (same overlap rule as `CaptureClock.accepts`, `CaptureClock.swift:183-191`).
- `CameraFrameMapping.run` (decodes 0 when absent). `Mapping.next` (`CameraMedia.swift:103-121`)
  accepts `camera-off` rows without a frame and validates run order.
- `RawScanState.append` (`:475-484`) builds one interval per run with the existing per-frame
  rule `min(nominalEnd, nativeEnd)`; a run boundary starts a new interval.
- `CanonicalScanState` (`:295-311`), `scanCanonical` (`:331-332`), `finishCanonical` (`:896-901`):
  each run's first frame starts its interval, its last frame bounds its end; the merged occupied
  segments must **equal** `availability.intervals`. Replaces "single bounded native support
  interval".
- `exportCandidate` (`:989-1015`): leading empty segment, then each interval as a passthrough
  segment with an empty segment between intervals.
- Fast path: `intendedSupport` (`:414-437`) and the live inventory (`:643-645`) return nil when the
  mapping has more than one run, so multi-run takes publish through the sequential scan (as the
  camera-verification entry in `specs/done/agent-editing/choices.md` requires). A single run with
  a late start keeps the fast path.
- `validateJournal`/`readPublished` (`:259-277`): recompute runs from the pinned mapping and
  require them to equal the receipt's `gaps`.
- `CaptureSourcePublication.support` (`:290-296`) returns one span per interval (`supportHash`
  already hashes a list, `:278`).
- `MediaRecovery.recoverCamera` (`YapWire/MediaRecovery.swift:232-252`): `intervals` from the same
  availability, `durationUs` = last interval end.

## Verification (tests first)

New `helpers/mac/Tests/YapCaptureTests/CameraAvailabilityTests.swift`, suite variable
`YAP_CAMERA_AVAILABILITY_OUTPUT`, driving `FixtureCameraSession` (`offer(at:)`) and calling
`CameraWriter.startAcquiring`/`stopAcquiring` between offers:

1. `singleRunIsLegacyShape`: no `gaps` key, no `run` key; JSON key sets equal a corpus-A receipt from slice 01.
2. `startsOffThenOn`: one run, leading empty edit, fast path used.
3. `onOffOn`: two intervals, one gap; canonical segments empty, occupied, empty, occupied; no decoded picture timestamp in the gap (through `PresentationSource`); occupied pixel hashes equal raw.
4. `offDuringPause`, `pauseDuringOff`: gaps measured in pause-removed source time; a zero-length gap merges.
5. `lateCallbackAfterOff`: a buffer crossing the off-time gets `camera-off`.
6. `staleBufferAfterOn`: a buffer starting before the on-time gets `camera-off`.
7. `emptyRun`: on then off with no frames adds no interval and no run.
8. `crashRecoveryWithGaps`: drop the writer unclosed; `MediaRecovery` republishes with the gaps. A lost unfragmented tail of the last run is accepted and documented.
9. `manyGaps` (500 runs): export validates; record Stop latency as a number.

Extend: `CameraSourcePublicationTests.swift` (malformed `gaps`: overlapping, out of span,
adjacent; receipt with `gaps` stripped; gap the mapping cannot justify → all refused),
`SourcePublicationRecoveryTests.swift` (multi-interval `supportHash` round trip),
`IndependentCameraClockTests.swift:175-215` (origin sharing for a late first run).

Run: `swift run --build-system native --package-path helpers/mac YapCaptureTests` with the suite
variable. The human can open the produced `video.mov` in QuickTime: black during the gap, not frozen.

**Must stay green.** `CameraLivePublicationTests`, `CameraPublicationOverlapTests`,
`IndependentPublicationTests`, `CanonicalRecoveryTests`, `ProbeCameraReplayTests`,
`CameraJournalProvenanceTests`, `packages/test-harness/editing/empty-edit-delivery.mjs`, and the
slice 01 gate (re-run once here).

**Delegated.** Internal interval accumulation; one empty edit per gap vs coalesced (occupied
segments and timestamps must not change); diagnostic wording.

**Out of scope.** Session start/stop (05); admission (04); any UI.

## Implemented (2026-10-12)

Status: built and green on the narrow checks below. Decisions the slice left open are in
[choices.md](../choices.md).

**Contract as built.** Mapping rows and receipt exactly as in Format above. `VerifiedSource`
(admission evidence `publications.video`) now holds a `CameraAvailability` and encodes
`support` plus `gaps` only when nonempty. `CaptureSourcePublication` support and
`MediaRecovery.recoverCamera` return one interval per availability interval. The camera
receipt read bound is `65536 + 100000 × 128` bytes. Explicit `run: 0` and `"gaps": []` are
refused (one byte form per take).

**Beyond the slice.**
- Each run's first picture is a forced key frame (`CameraWriter`). Without it the 500-run
  publication stalled in the canonical scan; see choices.md.
- For an unsealed raw movie, `scanRaw` ends the crash prefix at the first mapped picture a
  reordered fragment lacks (`acceptedBeyondPhysicalEOF`) instead of refusing the camera.
- `Verification.abandon()` replaces "live inventory returns nil": the writer stops the
  continuation when a run advances.
- `ProbeCameraReplayTests` was already red before this slice (verified on a pre-change build of
  054c6d09: "Retained camera mapping differs from closed observations" at the `torn` fixture).
  Its fresh fixtures now drop the retained mapping too, as a crash before closure leaves them.

**Deviations from Verification.**
- The suite drives `CameraWriter` directly through a small harness (`GatedCameraTake`) with
  explicit host times and the take clock, writing the same mapping rows and verification
  checkpoints `CaptureClockIngress` writes. `FixtureCameraSession` has no way to toggle until
  slice 05 wires the session lifecycle.
- The listed extensions live in `CameraAvailabilityTests.swift` rather than the named files:
  malformed/stripped/run-unjustified gaps (`malformedGapsRefused`), multi-interval
  `supportHash` round trip (`crashRecoveryWithGaps` recovers twice with camera source
  authority), and origin sharing for a late first run (`startsOffThenOn` with a primary origin).
  The named files only follow the `VerifiedSource.availability` rename.
- Case 1 compares against key sets captured from a take published by the pre-change build
  (recorded in the test). At integration these were checked equal to the key sets of corpus A's
  0.1.33 receipt and mapping. The gap bound was set to 499 (500 runs), keeping the original
  64 KiB receipt bound; see `choices.md`.

**Evidence.** `YAP_CAMERA_AVAILABILITY_OUTPUT=<dir>`: all nine cases plus malformed gaps pass.
Each mechanism was falsified once (gate ignoring the off-time crossing, canonical holding a
picture across the gap, gap boundaries ignoring runs, no forced key frame, run always written):
each went red for its own reason. `manyGaps` (500 runs, 1000 pictures at 160×120): camera Stop
latency (close + publish) 930 ms, written to `many-gaps-stop-latency.json`. Crash recovery kept
`[0,0.5) [1,2) [2.5,5.9)` s and lost the unfragmented tail after 5.9 s.

Must-stay-green, run on this build: `CameraLivePublicationTests`, `CameraPublicationOverlapTests`,
`IndependentPublicationTests` (with `NativeCaptureInputTests`), `ProbeCameraReplayTests` (on a
take from this build and on a take produced by the pre-change build), `CameraJournalProvenanceTests`
(inside `CameraSourceAdmissionTests`), plus the touched `IndependentCameraClockTests`,
`CameraSourcePublicationTests`, `SourcePublicationRecoveryTests`, `EmptyCaptureRecoveryTests`.
Not run: `CanonicalRecoveryTests` (no suite variable; it never reaches camera code) and
`empty-edit-delivery.mjs` (imports a plain movie through the service; no changed code on its
path). The slice 01 gate does not exist yet; re-run it here once it lands.
