# 01 Preservation baseline corpus and gate

**Contract unlocked.** "Recordings made before this change keep working" becomes a runnable
check. It runs against the pre-change build first (must pass), then after slices 02, 04 and 08.

**Seam.** Harness only, no product code:
`packages/test-harness/editing/camera-library-preservation.mjs --library <dir> --out <dir>`.

**Corpus (produced by the pre-change build, i.e. current `main` behaviour):**
- **A, published but not admitted.** ControllerJourney with `productionCamera: true`
  (`apps/macos/tests/ControllerJourney/Main.swift:131-139`), start with
  `cameraDeviceId: "fixture-camera"`, pause and resume once, stop. Copy the scratch home once
  publication settles and before admission jobs run (fence the job queue). Proves new code
  admits an old receipt.
- **B, admitted plus a project.** `packages/test-harness/editing/webcam.mjs --case capture-to-project`
  with `YAP_NATIVE`; keep a copy of its home (catalog, acquisitions, evidence, a project that
  places the camera asset).
- **C, optional, physical.** The pre-change dev app, `YAP_HOME=<scratch>`, a real camera, about
  10 s. Never `~/.yap`.

Store A and B under `specs/camera-toggle/assets/pre-toggle-corpus/` with a member-hash
manifest. Keep media small (fixture frames are tiny); reference anything over 5 MB by hash.
Note: `fixtures/screen-camera-timing` holds only an unpublished raw camera file, so it cannot be
the published-format baseline.

**Gate (the script):**
1. APFS-clone the library into scratch (`cp -c -R`). Hash every original file.
2. Start the service under test on the clone.
3. Assert: `recording.get` is `complete` with published sources; source admissions reach ready
   (fresh admission for A); `acquisition.get` camera binding `available` equals
   `[support − origin]`; the receipt has no `gaps` key; a `frame.*` read at a camera time returns
   a picture; corpus B's project compiles and renders one frame; `readPublished`/recovery
   accepts the receipt.
4. Re-hash the originals: unchanged.
5. Write `report.json` with `passed`.

**Human can see.** `report.json` with `passed: true` against the pre-change build.

**Delegated.** Corpus storage (LFS or hash reference); report formatting.

**Must stay green afterwards.** This gate, re-run after 02, 04 and 08.

**Feedback that changes this slice.** The user naming another library location to preserve.
