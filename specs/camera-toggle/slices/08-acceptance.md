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

## Implemented (2026-10-12)

Everything above except close-spec (the integrator's). Decisions are in [choices.md](../choices.md)
under "Slice 08 (acceptance)".

**Harness.** [`camera-toggle-controls.mjs`](../../../packages/test-harness/editing/camera-toggle-controls.mjs)
(real controller, host channel, service, CLI and MCP; fixture camera and screen) runs the four
journeys. 1: `device.camera` after every call (pause leaves it on, resume leaves it off); two
device opens; the receipt's one gap equals the fixture schedule in pause-removed source time; the
camera and primary share origin and pause; the admitted camera has two `available` intervals; the
source `frame.get` in the gap is `unavailable / physical_gap`; `timeline.events` reports the same two
intervals and no event outside them; a project linking screen and camera (one sync group) shows the
camera at its common-clock time in each run, and in the gap the camera picture is
`source-unavailable` and the frame equals the screen-only revision's. 2: never turned on: complete,
`CAMERA_NOT_TURNED_ON`, no camera acquisition, primary admitted, no device opened. 3: killed after
on, off, on (plus a third run 8 s in, so a fragment holds the first two); the next service recovers
the camera `CAPTURE_RECOVERED` with the first two runs whole and the gap between them. 4: a
camera-only take refuses `capture.setCamera` with `CAMERA_NOT_RESERVED`. Falsified once: a writer
that never advances the run went red at the two-run check.

[`camera-source-admission.mjs`](../../../packages/test-harness/editing/camera-source-admission.mjs)
now also takes `YAP_CAMERA_AVAILABILITY_OUTPUT` and admits every published take there through the
service: the microsecond probe equals the receipt's intervals for all eleven, including the
crash-recovered one. Falsified once: core reading the proof as one span refused the gapped import.

**Measurements.**
- 500 runs (499 gaps, ten-digit times): `camera.publication.json` 21,960 bytes against 65,536;
  normalized receipt 22,102 bytes against 32,768. Camera Stop latency 1,078 ms.
- KU6, mapping on a reserved-off take: 380 bytes per screen row (journey); with the retained
  physical callback rates (screen 29.1/s, microphone 93.0/s), about 2.75 MB per minute, so the
  256 MiB read budget is reached after about 97 minutes (about 55 with system audio). **Raised with
  the user; design unchanged.** Details in choices.md.

**Live app.** `dist/Yap.app` built from this head. `recording-controls.test.mjs` and
`recording-overlays.test.mjs` pass (4 tests). `overlay-shots.mjs` (controls, light and dark) draws
the real floating controls; no camera button, since this Mac has no camera and the real app lists
only native cameras. The panel resize (preview shown, minimized, restored, off after on) could not be
driven in the real app for the same reason; `recording-overlay-shots.mjs` (the production panel,
offscreen, synthetic picture) redrew all ten slice 07 shots byte-identically. No physical run.

**Preservation.** The slice 01 gate passed on corpora A and B and on an APFS clone of `~/.yap`
(0 recordings; 61,225 original members hashed before and after, unchanged), with this head's
`yap-native` and `dist/`. The delivered A and B frames are byte-identical to the baseline frames.

**Full run (once, with `YAP_NATIVE` and `YAP_SPARKLE_FRAMEWORK` exported).** First pass: protocol
47, core 826, composition 336 passed. Failures, each fixed and its suite re-run:
- Service, 7 vitest tests: fake-worker tests inherited `YAP_NATIVE` as the service's executable.
  An explicit `nativeExecutable` now wins over the environment; the fixtures pass `undefined`.
  (Its node half had not run behind the vitest failure.)
- macOS, `overlay-clock.test.mjs`: slice 00 shrank the clock's reserved width, so a ten-hour clock
  widened the controls. The clock now reserves the widest clock; the slice's overlay shots were
  redrawn (+4 points after the clock; unprimed critique in choices.md).
- Test harness, 22 replay tests: this checkout held LFS pointers; the two retained trees were
  materialized from the shared store. No code change.
- Found on the way: `check-types` (the capture fixture passed `timeoutMs: undefined`), two files
  `format:check` flagged, and `camera-source-admission.mjs`'s stale wrong-pause case.
Re-run: service 315 vitest (20 skipped: the audio acceptance suite needs `YAP_FFMPEG_DIRECTORY`)
and 184 node tests; harness 153; macOS native suites, 108 helper tests and 125 app tests (2 skipped
by their own conditions: a changing screen, one display); root tool tests 170; `check-types`,
`lint` and `format:check` clean.
