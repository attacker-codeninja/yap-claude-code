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
  session's format with the predicate (`CAMERA_FORMAT_CHANGED`) → `writer.queue.sync { camera.setAcquiring(true, now) }` →
  observe device loss on this session (the latch moves from the input to each session) →
  `session.start`. If start fails: `setAcquiring(false)`, drop the session, rethrow.
  Turn off: `setAcquiring(false, now)` → remove this session's observers → `session.stop` → drop
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
