# Choices

Decisions made while implementing this spec that a slice left open. One entry per
decision: what, why, and the slice.

## 01 Corpus storage: tar.gz archives committed directly, with a member manifest

The corpora are small (A 43 KB, B 1.2 MB compressed; no member over 5 MB), so they live in git
without LFS or hash references. They are archives rather than loose files because library
members carry modes (read-only acquisition members, 0700 directories) that git drops. The gate
accepts an archive directly and treats its extraction as the read-only original.

## 01 Corpus A's fence is the job queue's capacity, not a mid-admission close

Publication and the capture admission it triggers commit in the same service turn, so there is
no moment to copy a "published, nothing reserved" library from outside. Closing the library
during admission does not substitute: the reserved capture intent pins absolute paths and
inodes, so a clone of it fails with `NOT_FOUND`/`SOURCE_CHANGED` and can never be admitted. The
producer (`camera-library-corpus.mjs`) holds one filler import's native reply and queues 32 more,
so admission is refused with `LIMIT_EXCEEDED` before reserving anything. Cost: corpus A holds 33
filler `asset.import` jobs that fail when a later service runs them.

A consequence for later slices: any library closed mid-admission cannot be checked on a clone.
`~/.yap` holds no recordings, so this does not reach the user today.

## 01 Gate details

- `--library` takes a Yap home (the directory holding `library/`, e.g. `~/.yap`) or a corpus
  `.tar.gz`. Only `library/` is cloned and hashed; `run/` is runtime state.
- The clone uses `cp -c -p -R` (the slice's `cp -c -R` plus `-p`, so modes and times match the
  original).
- "readPublished accepts the receipt" is checked by importing an APFS clone of each camera
  recording directory with `acquisition.import`: the code under test reads the old receipt
  fresh, and its `publications.video` and binding `available` must equal the library's. For A,
  the capture admission itself is a second fresh read. Recovery of unfinished journals is not
  exercised: both corpora hold finished takes.
- Delivered frames use `maxLongEdge: 144`, a size no corpus journey requested, so cached frames
  from the old build cannot answer for the new one (`firstState` in the report is `processing`).
- Each recording's state and its sources' publication states are read from the clone's catalog
  before the service opens it, and must be the same afterwards. Only recordings that were
  `complete` with every source published get the admission, receipt, frame and reread checks;
  others are reported as not exercised. A failed, retryable admission is retried once through
  `job.retry`; any other admission failure fails the gate at once.
- Controls: a copy of B with the recording set to `interrupted` passes with nothing exercised.
  No cheap control makes the state change: without a capture controller the service does not
  rewrite a recording's state at open (a copy set to `capturing` stays `capturing`), so the
  state-change assertion has not been seen to fire.
- Recording and project counts are read from the clone's catalog before the service opens it, and
  recording directories from disk; every one must still be listed, so a build that loses old
  rows cannot pass on an empty listing.

- **`cameraProofIntervals()` returns a fresh, mutable array of fresh ranges** (04). Callers
  map it immediately (admission shifts it by the asset origin); a copy needs no freezing
  contract and cannot alias the stored receipt.
- **An empty `gaps` list is refused, not read as "no gaps"** (04). Slice 02 omits `gaps` when
  empty, so a continuous take has exactly one encoding and stays byte-identical to a
  pre-change receipt. Accepting `[]` would admit a second encoding no writer produces.
- **Malformed gaps refuse with their own message, "Invalid verified camera gaps"** (04), beside
  the existing "Invalid verified camera support", so a refusal says which field was wrong.

- **The service's native call for `capture.setCamera` gets the public 20 s budget** (06, decided at
  integration). A shorter internal cap would report `TIMEOUT` while native is still opening the
  camera, leaving the caller to guess the state. Implemented with the native side (05/06).
- **Replay identity grows for every take, accepted** (06). A request first sent before the change
  and replayed after it gets `REQUEST_CONFLICT`; replay receipts are short-lived and are not
  recordings, so no compatibility is owed.

### Every run starts on a forced key frame (02)

`CameraWriter` marks the first picture of each run with
`kCMSampleBufferAttachmentKey_ForceKeyFrame`. Without it, a run that began on a P-frame made
the passthrough export copy the preceding pictures as hidden preroll for every edit: at 500
runs the canonical movie grew to 7.5 MB against a 1.1 MB raw movie, and the publication's
canonical scan stalled at 0% CPU inside `AVAssetReaderTrackOutput.copyNextSampleBuffer`
reading through `MediaInput`. A plain `AVURLAsset` decoded the same file in 0.56 s, so the
stall belongs to the `MediaInput` read path (its 8-request concurrency budget is the suspect;
not investigated further). With forced key frames the canonical movie is the size of the raw
movie and no run decodes from a picture before its gap. The slice did not name this.

### The acquisition window, not "while off", decides (02)

The gate is one rule: a picture is recorded only when its whole host interval lies inside the
current on window `[onAt, offAt)`. A late callback for a picture that ended at or before the
turn-off is still recorded (it was acquired while on); one that crosses the turn-off or starts
before the turn-on gets `camera-off`. The slice said "refuses while off"; this is the same
overlap rule as the take clock's pauses and loses no acquired picture.

### `camera-off` is not counted as an omitted sample (02)

`CapturedTrack.omittedSamples` keeps counting clock-rule omissions only, so a single-run take
reports exactly what it did before. Off-time callbacks stay visible as mapping rows.

### One form only: `run: 0` and `gaps: []` are refused (02)

Zero runs and empty gaps are written by omission, so the readers refuse an explicit `run: 0`
or `"gaps": []`. A take therefore has one byte form, and a single-run take is byte-shaped
exactly like a pre-change one.

### The live continuation stops at the second run (02)

The slice said the live inventory should return nil for a multi-run mapping. Instead the
writer calls `Verification.abandon()` when a run advances: the continuation accepts no further
checkpoints and stops working at once, rather than recopying and rescanning the raw movie on
every frame only to fail. Publication of a multi-run take then takes the sequential scan
(`intendedSupport` is nil when any frame has a nonzero run). If no frame follows the turn-on,
the take is still one run and the continuation's proven prefix is still used.

### Gaps are checked against runs inside the canonical scan (02)

"Recompute runs from the pinned mapping and require them to equal the receipt's gaps" is done
by the canonical scan itself, which already walks every mapped frame: a run's first frame must
start the next interval (unless no source time separates it from the previous run), and every
other frame must stay inside the current one. Raw and canonical scans share that one rule
(`CameraMedia.startsInterval`). `validateJournal` is unchanged.

### At most 499 gaps, inside the original receipt bounds (02, 04, revised at integration)

Slice 02 first grew the `camera.publication.json` read bound to fit 100 000 gaps. Integration
reverted that: a take turns its camera on at most 500 times, counting a turn-on at its start, and
slice 05 refuses the 501st (`CAMERA_TOGGLE_LIMIT`). Each turn-on starts at most one run, so a take
has at most 500 runs and 499 gaps; counting turn-ons rather than recorded runs can only
overestimate. 501 runs would make publication and recovery refuse the whole camera. 500 gaps take about 20 KB, inside the original 64 KiB receipt bound
and the normalized receipt's 32 KiB, so no bound changes. Swift (`CameraAvailability.maximumGaps`)
and TypeScript (`maxCameraGaps`) both state 499 and both have a test at the edge.

### A crashed reordered tail ends the camera prefix (02)

A process crash can leave a fragment whose last picture was flushed ahead of earlier pictures
in presentation order (H.264 reordering). For an unsealed raw movie only, `scanRaw` now ends
the physical prefix at the first mapped picture the raw movie lacks, with the existing
`acceptedBeyondPhysicalEOF` diagnostic, instead of refusing the whole camera. A sealed raw
movie with a missing picture is still refused. Case `crashRecoveryWithGaps` needed this to be
deterministic; before it, recovery depended on where the fragment happened to end.

- **A picture from before a turn-off that arrives after the next turn-on is dropped** (02, review
  finding). Accepting it would label it with the new run and place it inside a gap. It costs at
  most one real picture per toggle and is logged with disposition `camera-off`.
- **The 32 KiB normalized-receipt bound is checked only by core** (02, review finding). A 499-gap
  receipt with 10-digit microsecond endpoints is about 26-29 KB with the rest of the receipt, so it
  fits; slice 08 measures a real one.

- **`cameraAtStart` is never defaulted by admission (06).** Absent stays absent through
  `capture.start`, `nativeStart` and `device.selection`; only replay identity and native read
  absent as `"on"`. Why: the selection echoes what the caller sent, and a default inside the schema
  would make every companion selection carry the field. Open: whether native should echo the
  resolved state instead.
- **Replay identity grows by one element for every take (06).** `allocationArguments` appends
  `null` for takes without a companion camera and the resolved start state for takes with one. A
  request ID first sent before this change and replayed after it is refused with
  `REQUEST_CONFLICT`. Accepted: replay receipts are short-lived request identity, not recordings,
  and the user's decision allows no compatibility shims beyond existing recordings. Open: append
  only for companion takes if old receipts matter.
- **Service refusal order (06).** `setCamera` checks, in order: the take exists (`NOT_FOUND`), is
  `recording` or `paused` (else `INVALID_STATE` with `details.state`), and reserved a camera (else
  `CAMERA_NOT_RESERVED`). It does not check that native's answer names the same take; native
  refuses another take itself.
- **~~The native call deadline stays 10 s (06).~~** Superseded at integration: the service's native
  call for `capture.setCamera` gets the public 20 s budget (entry above), implemented with the
  native side.
- **The coordination harness was stale before this slice (06).** It expected a companion
  `cameraDeviceId` to be refused (`INVALID_PARAMS`), and its terminal report carried no source
  publication, so the take was never admitted. Fixed both: a different camera on a reused request
  ID is `REQUEST_CONFLICT`, and the report now publishes the primary's authority.

### Slice 05 and the native part of 06 (implementation decisions)

- **A camera that starts on is opened during preparation; only a camera that starts off is
  reserved without opening (05).** The slice said preparation no longer calls `makeSession`. Kept
  for `startsOn` so a camera that cannot open still refuses the take before any output exists
  (existing `disappeared` case) and a continuous take acquires exactly as before. Every later
  turn-on opens a new session.
- **The limit counts turn-ons in `CameraCaptureInput`, not runs in `CameraWriter` (05).** Coordinator
  rule: 500 turn-ons, the 501st refused, checked before the device is opened. A turn-on refused
  before acquisition opens (permission, presence, the limit) does not count; one refused after it
  (open failure, format change, start failure) does, which only overestimates. The writer keeps only
  the acquisition window; its single `setAcquiring(Bool)` became `startAcquiring`/`stopAcquiring`
  so the off path cannot throw.
- **Turn-on order (05).** Authorization and presence → turn-on count → `startAcquiring` →
  `makeSession` → compatible-format check → observe loss → `start`. Opening acquisition before
  the session is harmless (no picture arrives before `start`) and any later refusal closes it
  again, so the camera is off after every refusal.
- **Before a session starts, "compatible format" can only compare picture size (05).** A session
  states its dimensions, not its pictures' description. The full predicate (`CameraFormat`: size,
  pixel format, colour tags) is applied to every picture in `append`; a mismatch found there
  interrupts the take as a format change always did. The turn-on refusal covers what can be known
  before opening.
- **`NO_CAMERA` means "on at stop and never delivered" (05, revised 2026-10-12).** A camera that
  recorded no picture closes `NO_CAMERA` (a device failure that interrupts the take) only when it
  was meant to be on at stop: started on, or turned on and not turned off since. A camera the
  person turned off before any picture was accepted publishes `unavailable CAMERA_NOT_TURNED_ON`
  and the take completes (`on-off-no-frames`). A camera that started on but whose start was
  skipped (probe `beforeStart`) is still `NO_CAMERA`. Failed and cancelled turn-ons do not count
  as turned on.
- **Loss while off needs no latch (05).** The off camera has no session and so no observer;
  presence is checked at each turn-on (`SOURCE_UNAVAILABLE`). No "lost" flag is stored.
- **Startup's turn-on is not joined by stop (05).** It is fenced by NativeCapture's generation, and
  a stop during startup must stop the session being opened (existing `discarded-startup` case).
  Turn-ons through `setCamera` are serialized and joined by stop and discard.
- **A stop or discard cancels a turn-on in flight (05, decided 2026-10-12).** A stop racing a
  turn-on is a race, not a camera failure, and must not cost the take. The ending still waits for
  the session to finish starting, then the turn-on releases that session itself (no orphan), the
  `setCamera` call is refused `INVALID_STATE`, and the camera publishes as if the turn-on never
  happened: with no earlier turn-on it is `unavailable CAMERA_NOT_TURNED_ON` and the take
  completes; with earlier runs they publish as before, the last ending where it ended. The writer
  is sealed before the switch is joined, so the cancelled turn-on records nothing. Replaces the
  earlier `NO_CAMERA` outcome. Startup's turn-on is unchanged (entry above).
- **Recovery of a mapping-only camera directory answers `NO_CAMERA` (05).** A crashed take leaves
  the same directory whether the camera was never turned on or lost before its first picture, so
  recovery states what it can prove. Only a camera authority whose single member is the mapping
  (a regular file) qualifies; a stray mapping in a primary directory still refuses.
- **`device.camera` stays reported while finalizing (06).** `NativeCapture` holds the reserved
  switch until the take ends, so status reports the camera (state `off` once inputs stop) through
  finalizing, as slice 06 asks.
- **The app-channel routing proof is a controller-journey harness (06).**
  `packages/test-harness/editing/camera-toggle-controls.mjs` drives the real `CaptureController`,
  host channel and service from the CLI and MCP with a fixture camera. The real-app
  `capture-service.test.mjs` records only its own window and lists no camera, so it can show only
  `device.camera: null`.

### Slice 07 (app controls)

- **A camera switched on is asked for even without access (07).** With access granted every screen
  take reserves the picked camera or the system default. Without access nothing is reserved, unless
  the person turned the switch on: then the camera is still sent, so native refuses with
  `CAMERA_PERMISSION_REQUIRED` and the menu offers the permission, as before this slice. Dropping it
  silently would record a take without the camera somebody asked for. Open: refuse locally instead.
- **The start builder moved to `ControlsState.start()` (07).** Reservation needs camera access and
  the catalog's default camera, which the selection alone does not hold, so
  `CaptureSelection.start()` was replaced rather than given parameters.
- **`cameraAtStart` is always explicit when a camera is reserved (07).** The app sends `"on"` or
  `"off"`, never absent. A take started elsewhere without the field restarts with `"on"`, which
  means the same.
- **Restart keeps the take's start state, not its live state (07).** `capture.restart` sends the
  selection read back from `device.selection`, so a take started off and turned on restarts off.
  Open: restart with the live state instead.
- **The menu's camera switch stays usable during a take that reserved a camera (07, delegated; the
  slice recommended it).** It sends the same `setCamera` action and shows native's live state; the
  camera chooser stays fixed. Switching off before a take keeps the picked camera (the slice's
  rule); the chooser's first item still clears the pick.
- **A refused live turn-on reveals the capture panel (07).** The failure goes to `state.failure`
  like any refused action; because the floating controls have nowhere to say it, the capture panel
  opens the way a failed start already opens it. A permission refusal re-reads access.
- **An unavailable publication is not a pending admission (07).** The slice asked to omit a
  never-turned-on camera's library row; no such row exists (the dead `SourceAdmission.title` was
  deleted). The live defect was that the library re-read `recording.get` every tick for any take
  whose camera publication was unavailable, which after this slice is every take reserved and never
  turned on.
- **The camera button is a native toggle-style button in the row's camera group (07, delegated).**
  It comes after pause/finish, behind a separator, and the restore button joins it in that group with
  no separator. On draws the accessory-bar's engaged chip behind `video.fill`; off draws
  `video.slash.fill` without the chip and at full contrast (the native off style dimmed it, which a
  fresh critique read as disabled). Open polish from the final critique: the symbol's slash is a
  hairline at 1x and the chip is pale in light mode; the slice 00 elements were left as they were
  (the "−" minimize metaphor, the `pip.exit` restore glyph, and the row changing width when the
  camera button or the restore button appears).

### Slice 08 (acceptance)

- **The journeys extend `camera-toggle-controls.mjs`, not `webcam.mjs --case` (08).** It already
  drove the real controller, host channel and service with the fixture camera; `webcam.mjs` is the
  single capture-to-project journey and its relocation steps add nothing to the toggle.
- **The gap oracle is the fixture's schedule, not the writer's answer (08).** Each fixture run is
  the prerecorded clip (733,333 us) from its first picture; the first pictures' host times come from
  the mapping as the fixture stamped them, and the pause from the take journal. The expected gap is
  the off time minus the paused time, and the pause is asserted to fall inside it.
- **"Transparent at a gap time" is judged against the screen alone (08).** The camera is placed in a
  second revision; at a gap time the composed frame's RGBA hash equals the screen-only revision's,
  and the camera picture is `unavailable / source-unavailable`. Inside a run the hashes differ.
- **`source.publication.json` holds no interval list (08).** The slice asked for its intervals;
  it names the members and the duration only. The journey checks its `sourceDurationUs` equals the
  receipt's support end; the intervals live in `camera.publication.json` and the admitted binding.
- **The crash journey turns the camera on a third time, 8 s into the take (08).** A crash keeps
  only what the raw movie's fragments hold, and the writer cuts a fragment only when a picture
  arrives a fragment interval after the last cut (1 s, then 5 s). With on, off, on alone the second
  run was never in a fragment and recovery kept one interval. The crashed take's primary recovers
  `INVALID_MEDIA` ("no verified recoverable video" from the five-picture fixture screen); the
  journey asserts only the camera.
- **The 500-run receipt is the native case moved to ten-digit times (08).** `manyGaps` now starts
  its runs 1,000 s into the take, so every receipt time has the digits of a long take.
  `camera-source-admission.mjs` admits it through the service: `camera.publication.json` 21,960
  bytes (bound 65,536), normalized receipt 22,102 bytes (bound 32,768). Each further digit adds
  about 1 KB.
- **`camera-source-admission.mjs` takes the availability output as a third argument (08).** It
  admits every published take there (including the crash-recovered one) and checks the service's
  probe equals the receipt's intervals.
- **KU6 confirmed; raised with the user, design unchanged (08).** A reserved camera's mapping logs
  every screen and microphone callback whether the camera is on or off. Row size from the journey's
  never-on take: 380 bytes per screen row; physical callback rates from the retained built-in run
  (`specs/done/agent-editing/assets/20m-camera-continuing-verification/physical-stop.tar.gz`):
  screen 29.1 rows/s at 382 bytes, microphone 93.0 rows/s at 374 bytes, camera 25.1 rows/s at 496
  bytes. A reserved-off take with the microphone writes about 2.75 MB per minute and reaches the
  256 MiB mapping read budget after about 97 minutes; with system audio at the microphone's rate,
  about 55 minutes; with the camera on, sooner. Read from the code, not run: a camera never turned
  on is closed without reading the mapping, so such a take still completes; a camera turned on at
  any point is refused at publication when its mapping is over the budget. The ingress row cap
  (5,000,000 rows, `EVIDENCE_LIMIT`, fails the take) is reached after about 11 hours at these rates.
  Before this spec only takes with the camera on carried a mapping; now every screen take that
  reserves a camera does. The follow-up named in the slice (the companion ingress logs only camera
  rows, owner `CaptureClockIngress`) is the user's decision.
- **The live panel resize was confirmed through the offscreen fixture only (08).** The real app
  lists only native cameras and this Mac has none, so no real-app take reserves a camera. The
  overlay fixture (`recording-overlay-shots.mjs`, the production panel with a synthetic picture)
  redrew every slice 07 shot byte-identically; the real app's floating controls (no camera) match
  the closed recording-overlay shots in layout at 1x.
- **The clock reserves the widest clock, not a number (08, full-run fix).** Slice 00 cut the
  clock's reserved width from 78 to 62 points, so a ten-hour clock widened the panel
  (`overlay-clock.test.mjs`). The reservation is now a hidden `00:00:00` in the same font: 4 points
  wider than 62, 12 narrower than the original 78. An unprimed critique found only that change; it
  also noted, in both builds, the separator after the clock sitting off-centre (wider gap on the
  clock side), the trash glyph further from the right edge than the dot from the left, and the
  camera button's chip crowding its separator. Left as open polish. The slice's overlay shots were
  redrawn; the human checkpoint (preview-shots) is the integrator's.
- **An explicit `nativeExecutable`, even undefined, overrides `YAP_NATIVE` (08, full-run fix).**
  With `YAP_NATIVE` exported, seven service tests that supply a fake worker picked up the real
  binary. Fake-worker fixtures now pass `nativeExecutable: undefined`; production and the harness
  pass nothing and still read the environment. Rejected: "a supplied worker never reads the
  environment", which would have needed every harness that wraps the real worker to pass the path.
- **Retained LFS media is materialized from the shared store for the full run (08).** The test
  harness's replay suites read `specs/done/video-editing-feedback/assets` and
  `fixtures/video-editing-feedback`; this checkout held only pointers. `git lfs checkout` of those
  two trees (320 MB) copied from the common `.git/lfs` store, with no download.
