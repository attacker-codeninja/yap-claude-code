# 03 Physical session cycle measurement (optional, non-blocking)

Nothing depends on this slice. Slice 05 settles every question below by design; run this only
if a physical camera is present, to confirm or tighten those defaults.

**Question.** Can a companion camera session be created, started, stopped and dropped
repeatedly on a real device during a take, and what does that cost?

Measures:
- **KU2** is `CMFormatDescriptionEqual` true between the first frames of two separately created
  `NativeCameraSession`s for the same device?
- **KU3** cold start latency per cycle (sets the `capture.setCamera` wait in 06).
- **KU4** device-loss observation re-arms on each new session (today `observing` is a one-shot
  latch, `CameraCaptureInput.swift:208-213`; `NativeCameraSession.stop` removes observers and
  clears the delegate, `:344-360`).
- Does `stopRunning` post `wasInterruptedNotification`? If so the loss observer must ignore it.
- By eye: the camera light is off between cycles.

**Seam.** A throwaway probe suite in `helpers/mac/Tests/YapCaptureTests`, selected by
`YAP_CAMERA_SESSION_CYCLE_OUTPUT`, using `NativeCapture.cameraCandidates()` and the session type
at package scope. Measurement only; no production behaviour is merged.

**Human can see.** A JSON report: cycles, per-cycle start ms, format equal, dimensions,
notifications observed. The user may confirm the light by eye.

**What it can change.** If the format is always identical, 05's predicate may be tightened back
to strict equality. A measured start latency may lower 06's `2*nativeCall` wait.

**Delegated.** Number of cycles (at least 5); report layout. Delete the probe when 05 lands
unless it is promoted to a regular test.
