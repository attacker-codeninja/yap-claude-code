# 08 End-to-end harness, physical acceptance, preservation re-check, close

**End-to-end harness.** `packages/test-harness/editing/webcam.mjs --case camera-toggle` (or a
sibling reusing `ControllerJourneyService` with `productionCamera: true`). Journeys:
1. Start with `cameraAtStart:"off"`, then `setCamera on`, `pause`, `setCamera off`, `resume`,
   `setCamera on`, `stop`. Assert `device.camera.state` after each call; receipt `gaps` match the
   schedule in pause-removed source time; `source.publication.json` intervals; the camera
   acquisition has two `available` intervals; composing the camera at a gap time is
   `source-unavailable` (transparent); no held camera picture in the gap through `frame.*` and
   `timeline.events`; sync groups hold (adapt `webcam.mjs:275-379`).
2. Never turned on: recording `complete`, camera `unavailable CAMERA_NOT_TURNED_ON`, no camera
   acquisition, primary admitted.
3. Kill the app after on, off, on; the service reconciles; the recovered camera has gaps.
4. Camera-only take: `setCamera` → `CAMERA_NOT_RESERVED`.
Also measure a real 500-run receipt against the 32 KiB normalized-receipt and 64 KiB
`camera.publication.json` caps (slice 05's `CAMERA_TOGGLE_LIMIT`). Also measure mapping bytes per minute on a reserved-off take (KU6). If a long take would exceed
the 256 MiB mapping read budget, raise it with the user before closing; the follow-up would make
the companion ingress log only camera rows (owner `CaptureClockIngress`).

**Live app (no physical camera needed).** Build `dist/Yap.app` (`apps/macos` `build`). Run
overlay-shots and the overlay tests in the live app, and confirm the slice 00 panel resize
(preview shown, minimized, restored) with the fixture camera. The ControllerJourney prerecorded
camera drives the toggle journeys above through the real app and service.

**Optional physical run.** Only if a camera is present: scratch `YAP_HOME`, start with the camera
off (light stays off), turn on, off, on from the floating controls, stop; check `video.mov`
across gaps and Stop latency. Not a gate.

**Preservation.** Re-run the slice 01 gate on corpora A, B (and C if made) with the new build,
then against an APFS clone of `~/.yap` (original hashed before and after; never opened for write).

**Full run.** Once, here: `apps/macos` `test`, service, core, protocol, harness journeys.

**Close.** Update `helpers/mac/Sources/YapCapture/README.md` (turning the camera off ends a run;
gaps are explicit; a held picture is never support), the app README's shared-controls section,
the skill docs; record decisions in `choices.md`; then run close-spec.
