# 07 App controls: camera button, reservation, library wording

**Contract unlocked.** The user-facing feature, through the same operation the CLI uses.

**Seam.**
- `ControlsAction.setCamera(Bool)`, ids `capture.camera.on` / `capture.camera.off` (must not
  collide with the capture-view intent ids `camera.on`/`camera.off` at
  `RecordingControls.swift:808-809`). The capture view's `CaptureViewIntent.cameraEnabled`
  (`CaptureView.swift:10`) is replaced by it, so the menu switch and the floating controls send
  one action.
- `ControlsState.DeviceStatus.camera: CameraStatus?` decoded from `capture.status`.
- Selection separates the picked device (`cameraDeviceId`) from the start switch
  (`cameraOn: Bool`), replacing the private `companionCameraRequested`
  (`RecordingControls.swift`). `start()` (`ControlsState.swift:366-391`) reserves
  `cameraDeviceId ?? system default` whenever camera access is authorized and the source is not a
  camera, and sends `cameraAtStart: cameraOn ? "on" : "off"`. Without access it reserves nothing.
- `RecordingControls.perform`: not live → set `selection.cameraOn`, keep the device; live → send
  `capture.setCamera`.
- `cameraActive` (`RecordingControls.swift:676`) derives from `device.camera?.state == "on"` or a
  camera-only source.
- `RecordingOverlayPanel` (extends slice 00):
  - a camera button in the row while `device.camera != nil`: `video.fill` when on,
    `video.slash.fill` when off; accessibility names "Turn Camera Off" / "Turn Camera On";
    placed after the pause/finish group;
  - the picture card only while the camera is on and the preview is shown; the restore button
    only while on and minimized;
  - clear the preview image when the camera goes off, so no frozen picture is ever shown.
- `LibraryState.SourceAdmission.title` (`LibraryState.swift:70-77`): a camera that was never
  turned on is not an error. Omit that camera row; the CLI's `recording.get` still reports it.

**Verification (tests first).**
- `apps/macos/tests/YapControlsTests/SelectionTests.swift`: reservation with and without access; `cameraAtStart`.
- `CapturePresentationTests.swift`: overlay states.
- `apps/macos/tests/recording-controls.test.mjs`: switch off before start still sends the device with `cameraAtStart:"off"`; a live toggle sends `capture.setCamera`; no access → no device.
- `recording-overlays.test.mjs`, `library-controls.test.mjs` (never-on camera row omitted).
- `apps/macos/tests/fixtures/recording-overlay.swift` + `recording-overlay-shots.mjs`: new states
  reserved-off, on+shown, on+minimized, off-after-on (no card, no stale picture). Click sweeps
  assert the exact row order, e.g. on+shown:
  `[.pauseOrResume, .startOrStop, .setCamera(false), .cancel]`;
  on+minimized: `[.pauseOrResume, .startOrStop, .setCamera(false), .showCameraPreview(true), .cancel]`.

**Visual gates, in order.** compare-screenshots against the slice 00 shots (judge only the camera
button and the off state); screenshot-critique as the last check; preview-shots to the user
(non-blocking, about five minutes, then decide and record here).

**Must stay green.** Slice 00 fixture assertions; existing overlay, controls and capture-view tests.

**Delegated.** Exact icon weights and spacing inside the existing capsule; whether the menu's
camera switch stays enabled while live (recommended: yes, same action).
