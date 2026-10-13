# 05 Companion session lifecycle: reserve, turn on, turn off (native)

**Contract unlocked.** A screen take can reserve a camera without opening it, turn it on and
off any number of times, and end cleanly if it was never turned on.

**Seam.**
- `CaptureCameraSelection.startsOn` / `CaptureCameraRequest.startsOn` (decodes `true` when absent).
- `CaptureInputPreparation.prepare` keeps today's checks (screen authorization, camera
  authorization, device present: `CameraCaptureInput.swift:91-97`) but no longer calls
  `makeSession` (`:102`). `CameraCaptureInput` holds the device, not a session.
- A narrow capability, so `NativeCapture` does not cast to a concrete input:
  ```swift
  @MainActor package protocol CompanionCameraSwitch: AnyObject {
      var deviceId: String { get }
      var isOn: Bool { get }
      func setOn(_ on: Bool) async throws   // serialized, idempotent
  }
  // CaptureInputSession gains: var companionCamera: (any CompanionCameraSwitch)? { get } (default nil)
  ```
- `CameraWriter` owns one named predicate, "compatible format": same dimensions, codec, pixel
  format and colour tags. It replaces the strict `CMFormatDescription` equality at
  `CameraWriter.swift:58-60`, because a re-created session may carry an equivalent description
  that is not byte-equal; decoding and passthrough export only need those properties to match.
  A fixture test proves a re-created session with an equivalent description is accepted and one
  with different dimensions is refused.
- `CameraCaptureInput` turn on: check authorization and presence → `makeSession` → check the
  session's format with the predicate (`CAMERA_FORMAT_CHANGED`) → `writer.queue.sync { camera.startAcquiring(now) }` →
  observe device loss on this session (the latch moves from the input to each session) →
  `session.start`. If start fails: `stopAcquiring(now)`, drop the session, rethrow.
  Turn off: `stopAcquiring(now)` → remove this session's observers → `session.stop` → drop
  the session. Removing observers first means a notification posted by `stopRunning` can never
  be mistaken for device loss.
  `start()` starts the primary, then turns on only when `startsOn`.
  `stop()` and `discardMedia()` join any in-flight switch first.
- Closure: `enum CameraClosure { case notTurnedOn; case closed(ClosedCameraSource) }`.
  `NO_CAMERA` stays for "turned on but never delivered".
- `NativeCapture.setCamera(on:)`: valid while recording or paused with no failure, otherwise
  `INVALID_STATE` (same guard as pause, `NativeCapture.swift:210-218`).
  `NativeCapture.companionCamera: (deviceId: String, on: Bool)?`.
  `.notTurnedOn` → camera publication `unavailable`, code `CAMERA_NOT_TURNED_ON`, and
  `CaptureResult.camera = nil`, so `withCamera` (`CaptureTypes.swift:234-238`) folds no failure
  and the take completes. Add the code to the terminal list (`CaptureTypes.swift:152`).
- Toggle limit: the receipt files are size-capped (normalized receipt 32 KiB, `camera.publication.json`
  64 KiB), which fits about 700 gaps (slice 04 finding). A take turns its camera on at most 500 times,
  counting a turn-on at its start; the 501st is refused with `CAMERA_TOGGLE_LIMIT`; the camera stays off and the take keeps recording. Test:
  `toggle-limit` mode. Slice 08 measures a real 500-run receipt against both caps.
- Device lost while off: mark lost, no interruption; the next turn-on throws `SOURCE_UNAVAILABLE`.
  Lost while on: whole-take interruption, unchanged.

**Verification (tests first).** Extend `SelectedCameraInputTests.swift` (uses
`FixtureCameraDevice.opens`, `FixtureCameraSession.swift:62-70`):
`reserved-off-never-on` (opens 0, take complete, camera `CAMERA_NOT_TURNED_ON`, directory holds
only the mapping), `off-on-off-on` (opens 2, stops 2, receipt has one gap),
`turn-on-device-missing`, `turn-on-permission-revoked`, `stop-during-turn-on` (no orphan
session), `device-loss-while-off` (no interruption), `device-loss-while-on` (interrupted as
today), `idempotent-set`. `EmptyCaptureRecoveryTests`: recovering a never-on directory gives
`inputsClosed: true` and an explicit `unavailable` code; pin the code here (today
`public-camera-empty-recovery.mjs:72` shows `unavailable`). `NativeCaptureInputTests`:
`companionCamera` is nil for screen-only and camera-only takes.

**Must stay green.** `PrimaryCameraInputTests`, `PrimaryCameraPublicationTests` (camera-only
untouched), `DeferredPauseTests`, `CaptureTerminationTests`, `SelectedCaptureStopTests`,
`IndependentCameraClockTests`, existing `SelectedCameraInputTests` modes.

**Delegated.** Nothing about session reuse: always re-create on turn-on (the device is not held
while off, which is what keeps the light off).

**Open follow-up for the user (not in this slice).** Should losing the camera while it is on
become "camera off" instead of interrupting the take?

## Implemented (2026-10-12)

Status: built and green on the narrow checks below. Decisions are in [choices.md](../choices.md)
under "Slice 05 and the native part of 06".

**Contract as built.**
- `CaptureCameraRequest.startsOn` (decodes `true` when absent) and
  `CaptureCameraSelection.startsOn`.
- `CompanionCameraSwitch {deviceId, isOn, setOn(_:)}`; `CaptureInputSession.companionCamera`
  (default nil). `CameraCaptureInput` is the only conformer.
- `NativeCapture.setCamera(on:)` (public): `INVALID_STATE` unless recording or paused with no
  failure, `CAMERA_NOT_RESERVED` without a companion camera, otherwise the switch's own refusals
  (`CAMERA_PERMISSION_REQUIRED`, `SOURCE_UNAVAILABLE`, `CAMERA_FORMAT_CHANGED`,
  `CAMERA_TOGGLE_LIMIT`). `NativeCapture.companionCamera: (deviceId, on)?` (public), held until
  the take ends.
- `CameraClosure {notTurnedOn, closed(ClosedCameraSource)}` in `CaptureInputClosure.camera`.
  `.notTurnedOn` publishes the camera `unavailable` with `CAMERA_NOT_TURNED_ON` (terminal) and
  `CaptureResult.camera = nil`; the take completes. A camera with no accepted picture closes
  `.notTurnedOn` whenever it is off at stop (never turned on, or turned off by the person);
  `NO_CAMERA` is kept for a camera on at stop that never delivered (revised 2026-10-12).
- `CameraWriter`: the compatible-format predicate is `CameraFormat` (size, pixel format, colour
  tags); `admits(width:height:)` applies its size part before a session starts. The acquisition
  window's mutator is split into `startAcquiring`/`stopAcquiring`.
- Recovery: a camera authority directory whose only member is the mapping closes `unavailable`
  with `NO_CAMERA` (`media.recover`), keeping the mapping.

**Deviations.**
- A camera that starts on is still opened in preparation (see choices). Only a camera that starts
  off is reserved without opening.
- The limit is counted in `CameraCaptureInput` as turn-ons, not by the writer (coordinator rule).
- The turn-on order opens acquisition before `makeSession` rather than after the format check;
  every refusal closes it again.
- A stop or discard during a `setCamera` turn-on cancels it (revised 2026-10-12; first built as
  `NO_CAMERA`): the call is refused `INVALID_STATE`, its session is released, and the camera
  publishes as if it had never been asked, so the take completes.
- Recovery pins `NO_CAMERA`, not `CAMERA_NOT_TURNED_ON`: a crashed directory cannot tell the two
  apart.
- `CameraAvailabilityTests.crashRecoveryWithGaps` (slice 02) failed in the full native product run
  once these cases were added: it waited for a fragment the writer cuts only while pictures keep
  arriving. It now keeps the third run going until a fragment holds it.

**Evidence.** `YAP_SELECTED_CAMERA_INPUT_OUTPUT=<dir>`: `reserved-off-never-on`, `off-on-off-on`
(an equivalent, not byte-equal, re-created format is accepted), `format-changed`,
`turn-on-device-missing`, `turn-on-permission-revoked`, `stop-during-turn-on` (take complete,
`CAMERA_NOT_TURNED_ON`, only the mapping), `stop-during-second-turn-on` (the earlier run publishes
alone, no gap), `discard-during-turn-on`, `on-off-no-frames` (turned off before any picture:
take complete, `CAMERA_NOT_TURNED_ON`; the lifecycle `no-camera` mode keeps on-at-stop `NO_CAMERA`),
`device-loss-while-off`, `device-loss-while-on`, `idempotent-set`, `toggle-limit` (500 turn-ons
publish 499 gaps; the 501st is refused). `EmptyCaptureRecoveryTests`: mapping-only camera.
`NativeCaptureInputTests`: screen-only and camera-only takes have no switch. Falsified once each:
strict description equality (off-on-off-on red), a limit of 501 (toggle-limit red), stop not
joining the switch (stop-during-turn-on red), and a cancelled turn-on counted as on
(stop-during-turn-on red with `NO_CAMERA`). `on-off-no-frames` was red with `NO_CAMERA` before
its fix.

Must-stay-green, run on this build: the whole `YapCaptureTests` product with no suite variable
(includes `PrimaryCameraInputTests`, `PrimaryCameraPublicationTests`, `DeferredPauseTests`,
`CaptureTerminationTests`, `IndependentCameraClockTests`, all `SelectedCameraInputTests` modes)
and `YAP_SELECTED_STOP_OUTPUT`. The slice 01 preservation gate passed on corpora A and B with
this build's `yap-native` and `dist/`.
