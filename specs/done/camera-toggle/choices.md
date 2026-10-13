# Choices

The decisions made while building camera on/off during a take that the spec, slices or user did
not make: the whole feature (`054c6d09..HEAD`), plus the two branch commits just before it that
the feature builds on (`d35c2d1b` floating-controls card, `967b6479` menu pressed state). Each
entry is judged against the final code. Decisions the user made are in the
[README](README.md#decisions-made-by-the-user) and appear here only where the build had to choose
how to carry them out.

Words used throughout:
- **take**: one recording session, from start to stop.
- **companion camera**: a camera recorded beside a screen take, in its own source. A
  **camera-only take** has the camera as its main source and has no on/off switch.
- **native**: the Swift helper that drives the devices and writes media. **service**: the
  TypeScript process that owns the library and answers the app, CLI and MCP.
- **run**: the pictures between one turn-on and the next turn-off. **gap**: the off time between
  two runs.
- **mapping** (`camera.mapping.jsonl`): one row per capture callback the take received, written
  live. **receipt** (`camera.publication.json`): the camera's published statement of what it
  recorded. Its **support** is the outer span from first to last recorded picture.
- **raw movie**: the camera file as written live. **canonical movie** (`video.mov`): the published
  copy, with off time as explicit empty edits.
- **admission**: core checking a published source and adding it to the library as an
  acquisition. It probes the canonical movie and requires the probed intervals to equal the
  receipt's.

**Review these first:** [every reserved take logs every callback (KU6)](#ku6-every-take-that-reserves-a-camera-logs-every-screen-and-microphone-callback)
(needs-user), [a toggle's release failure is reported on that toggle](#a-device-release-failure-from-a-turn-off-or-failed-turn-on-belongs-to-that-toggle)
(sound, corrected, low confidence) and [a crashed take whose camera never recorded recovers as `NO_CAMERA`](#a-crashed-take-whose-camera-recorded-nothing-recovers-as-no_camera)
(sound, low confidence).

Counts: needs-user 2, sound 39, plus 9 trivial calls (end of file).

---

## Needs user

### KU6: every take that reserves a camera logs every screen and microphone callback

- **When:** `6a5407f5` (a reserved-off camera gets a mapping from the take's start); measured in
  slice 08 (`0c05c279`).
- **The choice:** Take a 2-hour screen take with the microphone on. The person has granted camera
  access, so the take reserves the default camera, but they never turn it on. The companion
  camera's mapping file is written by the same component that receives every screen and
  microphone callback (`CaptureClockIngress`), and it writes a row for every one of them: about
  29 screen rows and 93 microphone rows a second, roughly 380 bytes each, so **about 2.75 MB per
  minute**, whether the camera is on or off. What happens next depends on the camera:
  ```
  camera never turned on   -> mapping is never read; the take completes
  camera turned on at all  -> publication reads the mapping; over 256 MiB it refuses the camera
                              (reached after ~97 min with the microphone, ~55 with system audio,
                              sooner with the camera on)
  any reserved take        -> the ingress fails the take (EVIDENCE_LIMIT) at 5,000,000 rows,
                              about 11 hours at these rates
  ```
  Before this feature only takes with the camera on carried a mapping, and those already hit the
  same 256 MiB budget at the same length. Now every screen take by a person who granted camera
  access carries one. The unbuilt alternative: the companion's mapping logs only camera rows,
  so its size follows camera time, not take time.
- **The gap:** The spec named this as a known unknown and asked slice 08 to measure it and raise
  it before closing; it did not decide the answer.
- **The reach:** The 11-hour row cap now applies to ordinary screen takes for anyone with camera
  access, and long takes with the camera on lose the camera exactly as 0.1.33 camera takes did.
  Changing the mapping's contents changes a pinned, hashed recording member, so it is easier to
  decide before many such takes exist.
- **Verdict:** needs-user. It trades file size and a long-take ceiling against changing what the
  mapping records. **Provisional call:** leave it as built (no regression for takes with the
  camera on; never-on takes still complete). **Recommended follow-up:** the companion ingress
  logs only camera rows (owner `CaptureClockIngress`). It is reversible: readers already accept
  any mapping that validates, so a later build can write fewer rows.
- **Confidence:** low.

### The camera button's look, and the floating controls' open polish

- **When:** `b291b7dc` (camera button); `d35c2d1b` (slice 00 card, minimize and restore).
- **The choice:** During a take with a reserved camera, the floating controls (the small panel
  with the clock, pause, finish and cancel) gain a camera button after pause/finish, behind a
  separator. On: the system's "engaged" chip behind a filled camera (`video.fill`). Off: a
  struck-through camera (`video.slash.fill`) with no chip, at full contrast. Two unprimed
  critiques drove this. A plain icon left on and off to a thin slash, and the system's own off
  style dimmed it so it read as disabled. While the picture is minimized, the restore button
  (`pip.exit`) joins the camera button's group with no separator. Polish left open: the slash is
  a hairline at 1x, the chip is pale in light mode, minimize is a "−" (the user asked that it
  look like a window minimize), the row changes width when the camera or restore button
  appears, the separator after the clock sits off-centre, the trash glyph sits further from the
  right edge than the dot from the left, and the chip crowds its separator.
- **The gap:** The slice delegated icon weights and spacing and named the symbols. It did not
  settle the on/off treatment or the open polish, and the user has not yet seen the redrawn shots.
- **The reach:** Any later control in this row will copy this toggle style.
- **Verdict:** needs-user. It is taste. **Provisional call:** keep it as built and show the
  [overlay shots](assets/overlay/). It is reversible: it is view code in
  `RecordingOverlayPanel`, with no contract behind it.
- **Confidence:** medium.

---

## Sound

Ranked least-confident first.

### A device-release failure from a turn-off or failed turn-on belongs to that toggle

- **When:** `6a5407f5`; corrected in the commit that rewrote this entry.
- **The choice:** A person records for 40 minutes and turns the camera off at minute 5. Releasing
  a camera session restores the device's frame-rate settings. If that restore fails, the session
  reports `DEVICE_RESTORE_FAILED`. The camera is off either way, and the failure is answered on
  that `capture.setCamera` call, never folded into the take:
  ```
  turn-off, release fails          -> the call refuses DEVICE_RESTORE_FAILED; camera off
  failed turn-on, release fails    -> the call refuses with the turn-on's own code; its message
                                      also names the release failure; camera off
  turn-on cancelled by stop/discard,
    release fails                  -> the call refuses INVALID_STATE as before, naming it too
  every case above                 -> one "camera release:" line on native's stderr; the take
                                      keeps recording and ends complete
  camera on at stop, release fails -> unchanged: the take ends interrupted with that failure
  ```
  The service passes native refusal codes through unchanged, and the app shows a refused toggle
  the way it shows any refused action (the menu's failure line, then a status refresh reads the
  camera off). No wire shape changed. As first built, the companion camera remembered the first
  release failure from any toggle and handed it back at stop, so the take ended **interrupted**
  35 minutes after the camera was switched off.
- **The gap:** Slice 05 said only "drop the session" on turn-off. Folding the result into the
  take's stop was the shortest path from the old single `camera.stop()`, and it contradicted two
  README invariants: "a camera toggle never touches the take lifecycle" and "a failed turn-on
  leaves the camera off and the take recording".
- **The reach:** A complete recording is never reported interrupted because of something that
  happened to the device during a toggle. A failed turn-on keeps its own cause as the code,
  because that is why the camera is off; the release failure is extra and travels in the message.
  The release at stop still fails the take: the camera was recording until that moment, and that
  rule is the one the take had before this feature.
- **Verdict:** sound. A toggle's release is a fact about the device and that toggle, so it is
  reported on the toggle. Fixture modes `turn-off-release-fails`, `failed-turn-on-release-fails`,
  `stop-during-turn-on-release-fails` and `stop-release-fails` in `SelectedCameraInputTests` pin
  all four rows.
- **Confidence:** medium. The user chose the corrected decision; whether the release at stop
  should also stop failing the take is left open on purpose.

### A crashed take whose camera recorded nothing recovers as `NO_CAMERA`

- **When:** `6a5407f5`.
- **The choice:** The app crashes during a take whose camera was reserved but never turned on.
  The camera's directory holds only the mapping, because the camera journal is written with the
  first picture. The next service runs recovery on that directory. Recovery publishes the camera
  `unavailable` with `NO_CAMERA` ("the reserved camera recorded no picture") and keeps the
  mapping. It qualifies only when the directory belongs to a camera and its one member is a
  regular file named like the mapping. A stray mapping in a screen directory still refuses. The
  alternative was `CAMERA_NOT_TURNED_ON`, the code a live stop uses. But a crashed directory looks
  the same whether the camera was never turned on or was lost before its first picture, so
  recovery states only what it can prove.
- **The gap:** Slice 05 asked for "an explicit unavailable code" and left which one open.
- **The reach:** In the CLI's `recording.get`, a person who never used the camera sees a code
  that reads like a device failure. The app's library treats any unavailable publication as
  settled, so it shows nothing wrong. Telling the two cases apart would need a durable record of
  turn-ons, which the README rejected (no journal events).
- **Verdict:** sound. It claims nothing the directory can't prove.
- **Confidence:** low.

### Camera fixture library A was fenced by filling the job queue

- **When:** `55b98661`; the tool that made it was removed in `d66fbf80`.
- **The choice:** The preservation gate needs a library where the camera was published by the
  old build but not yet admitted, so the new code must admit an old receipt itself. Publication
  and admission commit in the same service turn, so nothing outside can copy the library between
  them. Closing the library mid-admission does not work either: the reserved admission intent
  pins absolute paths and file identities, so a clone can never be admitted. The producer instead
  held one filler import's native reply and queued 32 more. The capture admission was then
  refused (`LIMIT_EXCEEDED`) before it reserved anything, and the library closed. As a result,
  library A holds 33 filler `asset.import` jobs that fail harmlessly when a later service runs
  them.
- **The gap:** Slice 01 said "fence the job queue" without saying how.
- **The reach:** Any library closed mid-admission can't be checked on a clone. `~/.yap` holds no
  recordings, so this doesn't reach the user today. The filler jobs are frozen into the archive.
- **Verdict:** sound. It is the only fence that leaves an admissible library.
- **Confidence:** medium.

### Each run starts on a forced key frame

- **When:** `86c164b0`.
- **The choice:** A take with 500 runs is published. The canonical movie is made by passthrough
  export: segments are copied without re-encoding, with an empty edit for each gap. If a run's
  first picture is a P-frame (a picture encoded as a difference from earlier ones), the export
  must also copy the earlier pictures it depends on as hidden preroll. At 500 runs the canonical
  movie grew from 1.1 MB to 7.5 MB, and publication's scan stalled at 0% CPU in the media read
  path. Now the writer marks the first picture of every run as a key frame
  (`kCMSampleBufferAttachmentKey_ForceKeyFrame`). Each run decodes on its own, and the canonical
  movie is the raw movie's size.
- **The gap:** The slice didn't foresee encoder dependencies across a gap.
- **The reach:** Every run costs one key frame, a few KB. The stall itself is in
  `MediaInput`'s read path (its 8-request concurrency budget is the suspect) and was not
  investigated, so any other file whose passthrough edits need a lot of preroll can still hit it.
- **Verdict:** sound. It removes the dependency at its cause for camera media. The `MediaInput`
  stall stays a separate latent issue.
- **Confidence:** medium.

### A crash keeps the camera's prefix up to the first missing picture

- **When:** `86c164b0`; crash journey `70b19317`.
- **The choice:** The app crashes during the third run. The raw movie on disk holds only the
  fragments the writer had cut, and the writer cuts a fragment only when a picture arrives a
  fragment interval (1 s, then 5 s) after the last cut. Its last fragment may also hold a picture
  flushed ahead of earlier ones, because H.264 reorders pictures. For an unsealed raw movie only,
  recovery now ends the camera at the first picture in the mapping that the raw movie lacks, with
  the existing `acceptedBeyondPhysicalEOF` diagnostic, instead of refusing the whole camera. A
  sealed (cleanly closed) raw movie with a missing picture is still refused. The unfragmented
  tail of the last run is lost, which the spec accepted.
- **The gap:** The spec accepted losing the tail but didn't say what a reordered tail should do.
  Before this change, recovery depended on where the fragment happened to end.
- **The reach:** Recovered camera sources can end earlier than the mapping says. The gaps before
  the cut are kept.
- **Verdict:** sound. It is a deterministic prefix rule, limited to crashed files.
- **Confidence:** medium.

### At most 500 turn-ons per take; 499 gaps; the original receipt bounds kept

- **When:** `f18e10df` (499 gaps, bound reverted); `6a5407f5` (`CAMERA_TOGGLE_LIMIT`).
- **The choice:** A person toggles the camera on and off over and over. The 501st turn-on,
  counting the one at the take's start if it starts on, is refused with `CAMERA_TOGGLE_LIMIT`.
  The camera stays off and the take keeps recording. Each turn-on starts at most one run, so a
  take has at most 500 runs and 499 gaps. 499 gaps fit inside the receipt's original 64 KiB read
  bound and the normalized receipt's 32 KiB with room to spare, so no bound changed. (Slice 02
  first raised the read bound to fit 100 000 gaps; that was reverted.) Swift
  (`CameraAvailability.maximumGaps`) and TypeScript (`maxCameraGaps`) both state 499. The count
  lives in the companion camera's switch, not the writer:
  ```
  turn-on: if turnOns >= 500 -> CAMERA_TOGGLE_LIMIT        (not counted)
           check access and presence -> refusals not counted
           turnOns += 1                                    (open failure, format change,
                                                            start failure all count)
  ```
  Counting attempts rather than recorded runs can only overestimate, so publication and recovery
  can never meet a 501-run take. The 32 KiB normalized bound is checked only by core.
- **The gap:** The plan sized the receipt but left the limit's unit, owner and counting to the
  build.
- **The reach:** 500 is a product limit a person can reach with a key held down. Raising it means
  raising the bounds in Swift and TypeScript together.
- **Verdict:** sound. It is a bound that holds in general, enforced before anything is written.
- **Confidence:** medium.

### "Compatible format" replaces exact format equality; an incompatible turn-on ends its run

- **When:** `6a5407f5`; the run-ending rule added in the commit that rewrote this entry.
- **The choice:** A camera is turned off and on again. The new session's format description may
  describe the same format without being byte-equal to the first. The writer used to require
  `CMFormatDescriptionEqual` and would interrupt the take. Now every picture is compared on what
  decoding and passthrough export depend on (`CameraFormat`): dimensions, pixel format and colour
  tags. A session states its dimensions but not its pictures' description, so a turn-on can only
  check size before it starts. What happens to a mismatch:
  ```
  turn-on, different size              -> the call refuses CAMERA_FORMAT_CHANGED; camera off
  turned-on session, other mismatch    -> that picture is logged camera-off, never recorded;
    (pixel format or colour tags)         the camera turns off (session released), one
                                          "camera off:" line on native's stderr; earlier runs
                                          publish and the take completes
  the session whose first picture set
    the format changes mid-run         -> unchanged: the take is interrupted
  ```
  Colour tags stay in the rule (user decision): one camera track with mixed tags would play
  with the wrong colour. As first built, the second row interrupted the whole take. No step
  waits on a physical camera to confirm formats (user decision).
- **The gap:** The plan named the predicate and its parts. It didn't say what can be checked
  before a session runs, or what a mismatch found after a turn-on does.
- **The reach:** A toggle never costs the take, even when the device describes its colour
  differently the second time. The turn-on's call has already answered, so the person sees the
  camera go off in live state rather than an error. Unmeasured on a device; see Open follow-ups
  in the README.
- **Verdict:** sound. It refuses early what is knowable early, and ends only the run that cannot
  join the track. Fixture modes `format-recoloured` and `format-changed-mid-run` in
  `SelectedCameraInputTests` pin the second and third rows.
- **Confidence:** medium.

### A stop or discard cancels a turn-on in flight

- **When:** `0a017098`.
- **The choice:** A person turns the camera on and presses Finish while the camera is still
  opening. The ending waits for the session to finish starting. The turn-on then releases that
  session itself, so none is orphaned, and its `setCamera` call is refused `INVALID_STATE`. The
  writer is sealed first, so the cancelled turn-on records nothing. The camera publishes as if
  that turn-on never happened. With no earlier run, it is `unavailable CAMERA_NOT_TURNED_ON` and
  the take completes. With earlier runs, they publish as before. This replaced a first build that
  published `NO_CAMERA` and cost the take. The turn-on at the take's own start is different: it
  is fenced by native's take generation and not joined, so a stop during startup stops the
  session being opened.
- **The gap:** Slice 05 said stop "joins any in-flight switch" and didn't say how the race ends.
- **The reach:** Pressing Finish never turns a camera race into a failed take.
- **Verdict:** sound. A race is not a device failure.
- **Confidence:** medium.

### `NO_CAMERA` only when the camera was on at stop and never delivered

- **When:** `8e5613bf`.
- **The choice:** The companion camera tracks whether it is *meant* to be on: from a start-on, or
  from the last turn-on that succeeded, until the person turns it off. Failed and cancelled
  turn-ons don't count. At stop:
  ```
  if not meantOn and no picture was accepted -> unavailable CAMERA_NOT_TURNED_ON; take complete
  else if no picture was accepted            -> NO_CAMERA (device failed); take interrupted
  else                                       -> publish the runs
  ```
  So turning the camera on and off again before its first picture arrives leaves the take
  complete. A camera that started on but whose start was skipped is still `NO_CAMERA`.
- **The gap:** Slice 05 defined `NO_CAMERA` as "turned on but never delivered" and didn't
  consider a person turning it off before delivery.
- **The reach:** `CAMERA_NOT_TURNED_ON` now also covers "turned on, turned off, nothing arrived".
  Its message still says "never turned on".
- **Verdict:** sound. A failure code means a failure, not a person's choice.
- **Confidence:** medium.

### `cameraAtStart` stays absent unless sent; the app always sends it

- **When:** `1886de84` (protocol, service), `ffdd90f4` (native), `b291b7dc` (app).
- **The choice:** A CLI caller starts a take with `cameraDeviceId` and no `cameraAtStart`. The
  schema doesn't fill in a default. The field stays absent through `capture.start`, the native
  start and the `device.selection` that status reports back. Only replay identity and native
  read absent as `"on"`. Native echoes the selection exactly as received. The app always sends
  `"on"` or `"off"` when it reserves a camera. The alternative was a schema default, which would
  make every companion selection carry the field.
- **The gap:** The wire said "absent = on" and didn't say whether the field is filled in.
- **The reach:** Readers of `device.selection` must treat absent as on. A take started elsewhere
  without the field and restarted from the app restarts with `"on"`, which means the same.
- **Verdict:** sound. One meaning, and the caller's omission stays visible.
- **Confidence:** medium.

### Replay identity includes the start state; old replays get `REQUEST_CONFLICT`

- **When:** `1886de84`.
- **The choice:** A client retries `capture.start` under the same request ID. The service
  compares the retry against the first request's identity, the list of allocation arguments.
  That list gains one element for every take: `null` without a companion camera, otherwise the
  resolved start state (absent → `"on"`). A retry that differs only in start state is refused,
  instead of quietly resolving to a take with the other state. Because the list grew for every
  take, a request ID first sent before this change and replayed after it gets `REQUEST_CONFLICT`.
  This was accepted: replay receipts are short-lived request identity, not recordings, and the
  user allowed no compatibility beyond existing recordings.
- **The gap:** Slice 06 said to append the state, not what happens to receipts already stored.
- **The reach:** Upgrading mid-retry can refuse a retry once.
- **Verdict:** sound. It is inside the user's compatibility rule.
- **Confidence:** medium.

### `capture.setCamera` waits 2 native calls; the service's native call gets the same 20 s

- **When:** `1886de84`, `ffdd90f4` (decided at integration, `d80c6071`).
- **The choice:** A turn-on opens a camera cold, behind any control call already queued. The
  operation's public wait is `2 * nativeCall` (20 s), and the client waits that plus 5 s. The
  service's own call to native for this operation gets the same 20 s, not the channel's usual
  10 s. The control channel's `call` accepts a per-call `timeoutMs`, and `operationWaitMs` is the
  one source of both numbers. With a shorter internal cap, the service would report `TIMEOUT`
  while native was still opening the camera, leaving the caller to guess its state. No physical
  camera was measured (user decision).
- **The gap:** Slice 06 set the public wait and left the internal call's deadline at the default.
- **The reach:** A turn-on slower than 20 s still answers `TIMEOUT` while native may finish
  turning on. The next `capture.status` shows the truth. Slice 03 may tighten the number.
- **Verdict:** sound. One budget, stated once.
- **Confidence:** medium.

### A camera switched on without camera access is still asked for

- **When:** `b291b7dc`.
- **The choice:** A person without camera access turns the menu's camera switch on and starts.
  Without access, a take reserves nothing (user decision). But here the person asked for the
  camera, so the app still sends it. Native refuses with `CAMERA_PERMISSION_REQUIRED`, and the
  menu offers the permission, as it did before this feature. The unbuilt alternatives were to
  drop the camera silently (a take without the camera somebody asked for) or to refuse in the app.
- **The gap:** The user's rule covered reservation, not an explicit request without access.
- **The reach:** Native stays the one place that says a permission is missing.
- **Verdict:** sound. An explicit request isn't dropped.
- **Confidence:** medium.

### Restart uses the take's start state, not its live state

- **When:** `b291b7dc`.
- **The choice:** A take starts with the camera off, the person turns it on, then presses
  Restart (`capture.restart`: discard and start again). Restart sends the selection native
  reported back for the take, so the new take starts with the camera **off**. Restarting with
  whatever is live now would be the alternative.
- **The gap:** No slice mentioned restart.
- **The reach:** Restart means "the same take again", not "continue as I am now".
- **Verdict:** sound. It matches restart's existing meaning.
- **Confidence:** medium.

### The preservation gate's design

- **When:** `55b98661`; generalised in `d5e89b85`.
- **The choice:** The gate (`camera-library-preservation.mjs`) proves that libraries made before
  this feature still work. It takes a Yap home or a fixture archive and clones only `library/`
  with `cp -c -p -R` (an APFS clone that keeps modes and times). It hashes every original member
  before and after. It reads each recording's state and source publication states from the
  clone's catalog before the service opens it, and requires the same states afterwards. Only
  recordings that were complete with every source published get the deeper checks: admission,
  then the receipt re-read fresh (an `acquisition.import` of a cloned camera directory), then
  delivered frames at `maxLongEdge: 144`, a size no old run requested, so cached frames can't
  answer for the new code. Others are reported "not exercised". A retryable admission failure is
  retried once. Recording and project counts must survive, so an empty listing can't pass. Since
  `d5e89b85` the gate requires admission to state exactly the receipt's own gaps, and
  availability to equal support minus gaps, so it also holds on a library that already has
  toggled takes.
- **The gap:** Slice 01 listed assertions and left the method open.
- **The reach:** This is the standing check for "existing recordings keep working". No cheap
  check makes its state-change assertion fail, so that assertion has not been seen to fire.
- **Verdict:** sound.
- **Confidence:** medium.

### The acceptance journeys' design

- **When:** `70b19317`, `0c05c279`; the app-channel harness from `ffdd90f4`.
- **The choice:** The toggle journeys live in `camera-toggle-controls.mjs`, which drives the real
  `CaptureController`, host channel and service from the CLI and MCP with a fixture camera (a
  prerecorded clip). Slice 08 suggested `webcam.mjs --case`, the single capture-to-project
  journey. The expected gap comes from the fixture's schedule, not from the writer: each run is
  the 733,333 µs clip from its first picture, and the expected gap is the off time minus the
  paused time. "Transparent in a gap" is judged against a second project revision without the
  camera: at a gap time the composed frame's hash equals the screen-only frame's. The crash
  journey turns the camera on a third time, 8 s in, so a fragment holds the first two runs. The
  500-run receipt is measured with runs starting 1,000 s in, so every time has the digits of a
  long take.
- **The gap:** Slice 08 listed what to assert, not the oracle or where it runs.
- **The reach:** Later camera journeys extend this harness. The real app can't reserve a camera
  on this Mac (it lists only native cameras), so the app-level proof goes through the fixture.
- **Verdict:** sound. Each oracle is independent of the code it checks.
- **Confidence:** medium.

### An explicit `nativeExecutable`, even `undefined`, overrides `YAP_NATIVE`

- **When:** `eaba0204`, `4fc00a1c`.
- **The choice:** With `YAP_NATIVE` exported, seven service tests that supply their own fake
  worker picked up the real native binary. `startProjectService` now uses `nativeExecutable`
  whenever the key is present, even when its value is `undefined`, and reads the environment only
  when the key is absent. The rejected alternative was "a supplied worker never reads the
  environment", which would need every harness that wraps the real worker to pass the path.
- **The gap:** The full run exposed it. No slice covered it.
- **The reach:** Callers of `startProjectService` must know that "absent" and "undefined" differ.
- **Verdict:** sound. Small, explicit, and production is unchanged.
- **Confidence:** medium.

### A camera that starts on is opened during preparation

- **When:** `6a5407f5`.
- **The choice:** Slice 05 said preparation would no longer open the camera. The build opens it
  in preparation when it starts on, and only a camera that starts off is reserved unopened. A
  camera that can't open then refuses the take before any output exists (the existing
  `disappeared` case), and a take with the camera on throughout acquires exactly as before. The
  first turn-on uses that session; every later turn-on opens a new one.
- **The gap:** The plan's "never open in preparation" would have let a start-on take begin
  recording and then fail on its camera.
- **The reach:** "The device opens only while on" still holds: a camera that starts on is on.
- **Verdict:** sound.
- **Confidence:** medium.

### A picture from before a turn-off that arrives after the next turn-on is dropped

- **When:** slice 02 review (`c4ac29dc`).
- **The choice:** The camera is turned off at 10.0 s and on again at 10.2 s. A picture captured at
  9.97 s is delivered late, at 10.25 s. The writer sees that it was captured before the current
  turn-on and records it as `camera-off` in the mapping instead of keeping it. Accepting it would
  label it with the new run and place it inside the gap. It costs at most one real picture per
  toggle.
- **The gap:** The window rule (next entry) applied only to the current window. Late delivery
  across a short off time was found in review.
- **The reach:** None beyond the lost picture. The mapping shows it.
- **Verdict:** sound. A gap stays empty.
- **Confidence:** medium.

### Off time is a `run` number in the mapping and `gaps` in the receipt, omitted when empty

- **When:** `86c164b0`; planned in `054c6d09`.
- **The choice:** A person turns the camera on, off, on. Mapping rows for the second run's
  pictures carry `"run": 1`. Callbacks while off are logged with disposition `camera-off`. The
  receipt keeps `support` as the outer span and adds `gaps: [{startUs, endUs}]`. Intervals are
  support minus gaps. Both fields are omitted when zero or empty, so a take whose camera was never
  turned off is byte-shaped exactly like a 0.1.33 recording, and old recordings are simply the
  one-interval case. There are no new journal events and no migration. `CameraAvailability` in
  Swift and `cameraProofIntervals()` in TypeScript are the only code that computes intervals.
- **The gap:** The plan chose this shape; the build kept it and made it the only shape.
- **The reach:** This is the recording format every reader now shares. A crash keeps the runs,
  because the mapping is written live and pinned by its hash.
- **Verdict:** sound. One statement of off time, and old recordings need nothing.
- **Confidence:** high.

### One byte form: `run: 0` and `gaps: []` are refused

- **When:** `86c164b0`, `bc9fd253`.
- **The choice:** A receipt arrives with `"gaps": []`, or a mapping row with `"run": 0`. Writers
  never produce these (they omit the field), so both Swift and TypeScript readers refuse them.
  TypeScript says "Invalid verified camera gaps", beside the existing support message. Each take
  therefore has exactly one encoding, and a take that was never turned off can't drift from the
  0.1.33 shape.
- **The gap:** The plan said "omitted when empty" and not what a reader does with an explicit
  empty value.
- **The reach:** Any future writer must omit the field rather than write empty.
- **Verdict:** sound.
- **Confidence:** high.

### The acquisition window decides what is recorded

- **When:** `86c164b0`.
- **The choice:** The camera is turned off at 10.0 s. A picture captured 9.95–9.98 s arrives late
  at 10.05 s and is still recorded: it was acquired while on. A picture spanning 9.99–10.02 s
  crosses the turn-off and is logged `camera-off`, as is one that starts before the turn-on. One
  rule:
  ```
  record picture iff onAt <= picture.start and picture.end <= offAt (offAt open while on)
  ```
  It is the same overlap rule the take clock applies to pauses. The slice said "refuses while
  off", which would have dropped late-delivered pictures that were acquired while on.
- **The gap:** "While off" was ambiguous about delivery time versus capture time.
- **The reach:** No recorded picture ever crosses a gap edge, which is one of the three checks
  that keep a held picture out.
- **Verdict:** sound.
- **Confidence:** high.

### Callbacks while off are not counted as omitted samples

- **When:** `86c164b0`.
- **The choice:** A take with the camera off for 10 minutes receives thousands of camera-off
  callbacks. They stay visible as mapping rows but are not added to the track's
  `omittedSamples`, which keeps counting only clock-rule omissions. A take with one run reports
  exactly what it did before.
- **The gap:** Unspecified.
- **The reach:** `omittedSamples` keeps meaning "dropped by the clock".
- **Verdict:** sound.
- **Confidence:** high.

### A multi-run take drops the live verification and publishes by full scan

- **When:** `86c164b0`; path choice made private in `70135730`.
- **The choice:** While a take runs, the writer keeps a live proof of one contiguous camera run
  (the "continuation"), so Stop can publish quickly. When a second run begins, the writer
  abandons that continuation at once, and publication uses the sequential scan. The slice said
  the continuation should return nothing for a multi-run mapping, which would have kept it
  re-scanning on every picture only to fail. A take whose turn-on gets no picture is still one
  run and keeps the fast path.
- **The gap:** The plan said where to return nil, not when to stop the work.
- **The reach:** Toggled takes stop more slowly (about 1 s for 500 runs). Which path ran is now
  private to `CameraMedia`.
- **Verdict:** sound.
- **Confidence:** high.

### Gaps are checked against the runs inside the canonical scan

- **When:** `86c164b0`.
- **The choice:** Publication already walks every mapped picture to check the canonical movie.
  That same walk now checks the gaps: a run's first picture must start the next interval, and
  every other picture must stay inside the current one. A run that starts with no source time
  after the previous run's last picture merges into it, so a zero-length gap (off only while
  paused) leaves no gap. Raw and canonical scans share this one rule (`startsInterval`). The plan
  put the check in journal validation, which is unchanged.
- **The gap:** The plan named a different place.
- **The reach:** There is one rule for where intervals start, used by every scan.
- **Verdict:** sound.
- **Confidence:** high.

### Every screen take reserves a camera when access is granted; the device opens only while on

- **When:** `b291b7dc` (app), `6a5407f5` (native). This is a user decision; the entry records how
  it was carried out.
- **The choice:** A person with camera access starts a screen take with the camera switch off.
  The app reserves the camera they picked, or the system default (`ControlsState.start()`), and
  sends `cameraAtStart: "off"`. Native creates the camera's output, but no session: the device
  isn't opened and its light stays off. Turning it on opens a new session, and turning it off
  releases it. Without access, nothing is reserved and there is no toggle.
- **The gap:** None. The user decided this.
- **The reach:** Every take by someone with camera access now has a camera source, published
  `CAMERA_NOT_TURNED_ON` when unused (and see KU6).
- **Verdict:** sound.
- **Confidence:** high.

### Turn-on order

- **When:** `6a5407f5`.
- **The choice:** A turn-on runs:
  ```
  limit -> access and presence -> count it -> open acquisition window -> open session
        -> size check -> watch this session for device loss -> start
  any refusal after the window opened: close the window, stop the session -> camera off
  ```
  Opening the window before the session is harmless, because no picture arrives before `start`,
  and every refusal closes it again. So the camera is off after any refusal.
- **The gap:** Slice 05 gave an order with the window opened after the format check. The build
  moved it earlier.
- **The reach:** Later turn-on steps slot into one sequence with one cleanup path.
- **Verdict:** sound.
- **Confidence:** high.

### A camera lost while off needs no flag

- **When:** `6a5407f5`.
- **The choice:** The camera is unplugged while off. Nothing happens: an off camera has no
  session, so nothing watches it. The next turn-on checks presence and refuses
  `SOURCE_UNAVAILABLE`, and the take keeps recording. Each session's loss observers are removed
  before it stops, so a notification posted by stopping can't be mistaken for loss. Slice 05
  suggested a stored "lost" flag; none was needed.
- **The gap:** The plan assumed a flag.
- **The reach:** Device loss has one meaning: an open session lost its device.
- **Verdict:** sound.
- **Confidence:** high.

### Status reports the camera through finalizing

- **When:** `ffdd90f4`.
- **The choice:** After Stop, while the take is finalizing, `capture.status` still reports
  `device.camera`, with state `off` once inputs stop. Native holds the reserved camera until the
  take fully ends.
- **The gap:** Slice 06 asked for it; the build chose to hold the reservation to do it.
- **The reach:** `device.camera` is non-null exactly while native holds such a take.
- **Verdict:** sound.
- **Confidence:** high.

### Service refusal order for `capture.setCamera`

- **When:** `1886de84`.
- **The choice:** The service checks, in order: the take exists (`NOT_FOUND`); it is recording or
  paused (else `INVALID_STATE` with `details.state`); it reserved a camera (else
  `CAMERA_NOT_RESERVED`, which also covers camera-only takes). Only then does it call native.
  It doesn't check that native's answer names the same take, because native refuses another take
  itself. Native's codes pass through unchanged.
- **The gap:** The plan listed the codes, not their order.
- **The reach:** CLI and MCP callers see the cheapest refusal first.
- **Verdict:** sound.
- **Confidence:** high.

### Minimizing the picture writes the existing `showCameraPreview` preference

- **When:** `d35c2d1b`.
- **The choice:** A person clicks "−" on the camera picture in the floating controls. The action
  `ControlsAction.showCameraPreview(false)` writes the existing Settings preference
  `showCameraPreview`, and the Settings window re-reads it on its next update. Restore writes
  `true`. The alternative was a separate overlay-only flag.
- **The gap:** Slice 00 needed a minimized state and didn't say where it lives.
- **The reach:** Minimizing persists across takes and shows in Settings. There is one owner.
- **Verdict:** sound.
- **Confidence:** high.

### The picture card takes the row's width at 16:9; the panel grows and shrinks from its bottom edge

- **When:** `d35c2d1b`.
- **The choice:** The picture was drawn square inside an oval (one capsule behind both picture
  and row). Now a custom layout (`PictureAboveRow`) lets the control row decide the width. The
  picture is a rounded card of that width at 16:9, filled and cropped from the centre, never
  squeezed. When the picture appears or disappears, or the clock widens, the panel resizes to fit
  in both directions. It keeps its bottom edge and its horizontal centre still, because that is
  where the person's hand is.
- **The gap:** The user reported the bug; the layout rule was the build's.
- **The reach:** Anything added above the row follows the same width rule.
- **Verdict:** sound.
- **Confidence:** high.

### Every capture-menu custom button draws a pressed tint

- **When:** `967b6479`.
- **The choice:** The capture menu's custom-drawn buttons gave no feedback while held. The
  report named Play and Copy prompt. The fix repaints on highlight and draws a translucent tint
  over every button kind (tile, primary, permission, secondary, plain), with each kind's corner
  radius.
- **The gap:** The report named two buttons.
- **The reach:** New button kinds get the tint for free.
- **Verdict:** sound. It is one rule, not two special cases.
- **Confidence:** high.

### One camera action for the menu and the floating controls

- **When:** `b291b7dc`, `697dc080`.
- **The choice:** The menu's camera switch and the floating camera button send the same
  `ControlsAction.setCamera(Bool)`. Before a take it sets the start switch. During a take that
  reserved a camera it sends `capture.setCamera`. Switching off before a take now keeps the
  picked camera; before, it cleared the pick. The chooser's first item still clears it. The start
  builder moved from the selection to `ControlsState.start()`, because reservation needs camera
  access and the catalog's default camera, which the selection doesn't hold. Both surfaces read
  "is the camera on" from one function (`RecordingOverlay.camera(for:)`), which reads native's
  live state.
- **The gap:** The plan named the action; the builder's new home and the shared reader were the
  build's.
- **The reach:** The menu and floating controls can't disagree. It replaces the private
  `companionCameraRequested` flag.
- **Verdict:** sound.
- **Confidence:** high.

### The menu's camera switch stays usable during a take

- **When:** `b291b7dc` (delegated; the slice recommended it).
- **The choice:** During a take that reserved a camera, the menu's camera switch stays enabled
  and shows native's live state, while the camera chooser and other inputs stay fixed.
- **The gap:** Delegated.
- **The reach:** There are two places to toggle and one action.
- **Verdict:** sound.
- **Confidence:** high.

### A refused live turn-on opens the capture panel

- **When:** `b291b7dc`.
- **The choice:** A person clicks the floating camera button and the turn-on is refused (camera
  gone, limit reached, format changed, access revoked). The failure is shown like any refused
  action, and the capture panel opens, because the floating controls have no room to explain
  it. A permission refusal re-reads access.
- **The gap:** Unspecified.
- **The reach:** Live-toggle errors surface in the same place as failed starts.
- **Verdict:** sound.
- **Confidence:** high.

### The library treats an unavailable source as settled, not pending

- **When:** `b291b7dc`.
- **The choice:** The slice asked to hide a never-turned-on camera's library row. No such row
  existed: `SourceAdmission.title` had no caller, and was deleted. The real defect was that the
  library counted any source with an unavailable publication as "admission pending" and re-read
  `recording.get` on every tick. That is every take reserved and never turned on. Now an
  unavailable publication, whatever its code, is settled.
- **The gap:** The slice described a row that wasn't there.
- **The reach:** Fixes polling for every unavailable source, not only this one.
- **Verdict:** sound. It is the general rule, not a camera special case.
- **Confidence:** high.

### The clock reserves the width of `00:00:00`

- **When:** `df0d106e`.
- **The choice:** Slice 00 cut the clock's reserved width from 78 to 62 points, so a ten-hour
  take widened the floating controls. The clock now reserves the width of a hidden `00:00:00` in
  its own font: 4 points wider than 62 and 12 narrower than the original 78, and right for any
  font.
- **The gap:** Slice 00 didn't consider ten-hour clocks.
- **The reach:** The row keeps one width for the whole take.
- **Verdict:** sound.
- **Confidence:** high.

### The pre-toggle fixture libraries are committed archives; their producer lives only in history

- **When:** `55b98661`; producer removed in `d66fbf80`.
- **The choice:** The two pre-change fixture libraries (A 43 KB, B 1.2 MB compressed) are
  committed as `.tar.gz` with a member manifest (type, mode, size, SHA-256). Archives keep the
  members' modes (read-only acquisition members, private directories), which git drops. The
  gate reads an archive directly. The scripts that produced them could only work against
  pre-toggle product code, so they were deleted. The corpus README points at `55b98661`, the last
  commit whose product code is pre-toggle, to re-run them.
- **The gap:** Slice 01 delegated storage.
- **The reach:** The corpus can't be regenerated from the current tree, by design.
- **Verdict:** sound.
- **Confidence:** high.

---

## Trivial calls (9)

Internal naming and placement: `cameraProofIntervals()` returns a fresh array; the
writer's acquisition window split into `startAcquiring`/`stopAcquiring` so the off path can't
throw; slice 02's extra cases live in `CameraAvailabilityTests` behind a small `GatedCameraTake`
harness; `ProbeCameraReplayTests` fixtures drop the retained mapping as a crash would; the stale
coordination harness was brought up to date; `camera-source-admission.mjs` takes the
availability output as a third argument; the live-toggle "no camera" failure message; the menu
switch is disabled while an update is fenced; `source.publication.json` was left without an
interval list (it never had one).
