# 00 Floating controls redesign (done, uncommitted)

**Contract unlocked.** The floating take controls show the camera picture as its own rounded
16:9 card at exactly the control row's width, filled and cropped from the centre. A minimize
button on the card hides the picture; the camera keeps recording. While minimized, a restore
button sits in the row. Takes without a camera show no preview controls.

**Why.** The user reported the preview drawn square inside an oval, overflowing it and off
centre. Cause: one `Capsule` background behind both the picture and the row (a tall capsule is
an oval) and asymmetric padding (16 pt leading, 2 pt trailing). It had never been rendered with a
camera: `apps/macos/tests/overlay-shots.mjs` only drives a camera-less take.

**Seam.**
- `ControlsAction.showCameraPreview(Bool)` (ids `camera.preview.show` / `camera.preview.hide`)
  writes the existing Settings preference `showCameraPreview`, so the overlay and Settings share
  one owner; `SettingsWindow.update` re-reads it.
- `RecordingOverlayPanel.updateCamera(active:previewShown:)` and `updatePreview(_:)`;
  `RecordingOverlayModel` holds `cameraActive`, `previewShown`, `preview`.
- `PictureAboveRow` layout: the row decides the width, the picture takes it at 16:9.
- The panel resizes both ways on any model change and keeps its bottom edge still.

**Verification.** `node apps/macos/tests/recording-overlay-shots.mjs` (fixture
`apps/macos/tests/fixtures/recording-overlay.swift`) renders the real view with a synthetic
4:3 frame in light and dark and asserts: centred, rounded corners, same width as the row, cropped
not squeezed, click sweeps return the exact row actions in order, minimize sends
`showCameraPreview(false)`, restore sends `showCameraPreview(true)`, no camera → no preview
controls. The app target builds; the capture-menu fixture still passes.

**Not yet verified.** The live panel resize (needs a `dist/Yap.app` build); done in slice 08.

**Slice 07 extends this view** with the camera on/off button and must keep these assertions.
