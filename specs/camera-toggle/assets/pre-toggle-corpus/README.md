# Pre-toggle library corpus

Two Yap libraries recorded by the build before camera on/off existed. The
[preservation gate](../../../../packages/test-harness/editing/camera-library-preservation.mjs)
opens each one with the code under test and checks that its recordings still work
([slice 01](../../slices/01-preservation-baseline.md) lists the assertions). Each archive holds
`library/` at its root; it is stored as a tar because library members carry modes (read-only
acquisition members, private directories) that git does not keep. [manifest.json](manifest.json)
lists every member's type, mode, size and SHA-256, and each archive's own hash.

- **A, published but not admitted** ([a.tar.gz](a.tar.gz)). One complete screen take with the
  companion camera `fixture-camera` and microphone, paused and resumed once. Both sources are
  published; no acquisition intent or admission job exists for them, so the code under test
  admits the old receipts itself. The library also holds 33 filler `asset.import` jobs (one
  interrupted, 32 queued) whose media was in scratch; they are the queue fence described below,
  and fail harmlessly when a later service runs them. [a-producer-report.json](a-producer-report.json)
  is the producing journey's record.
- **B, admitted plus a project** ([b.tar.gz](b.tar.gz)). The library left by the camera
  capture-to-project journey just before its relocation step: the same kind of take with both
  sources admitted, a third camera source imported by path, and one project whose current
  revision places the screen, camera and microphone, with replace/undo history and derived
  frame and audio caches.

Physical camera corpus C was not made.

## How it was produced

Native, service, CLI and controller-journey sources are those of `a8adbab2`, unchanged through
`054c6d09`. Builds started on `a8adbab2` with the slice 00 floating-controls UI uncommitted; that UI
and this spec were committed (`967b6479`..`054c6d09`) while the corpus was produced. None of those
files is compiled into the native worker, service or controller journey. The producer
(`camera-library-corpus.mjs`, `webcam.mjs --keep-home` and a reply hold in
`controller-service.mjs` that can hold any operation) exists only at commit `55b98661`, the last
whose product code is pre-toggle: run the recipe below from a checkout of that commit. Later
code cannot make this corpus, so the producer is not kept beside the code under test.

Inputs and binaries (scratch paths, 2026-10-12):

| Item | SHA-256 |
|---|---|
| `helpers/mac/.build/debug/yap-native` | `0dc7c95af6dc786e53e423b2892da10bdf59e8cdafd156af0dff15076e3d64d2` |
| `controller-journey` | `0a000324acf9710d00f289989580ba25fe66cbb97d8efc484fd98a56670e3ae3` |
| `input.mov` (`YAP_CAMERA_PROJECT_OUTPUT`) | `c59fb34b259f89d43bf525c707e5a0b898587955305c86b68b22f1f607b3c269` |
| `audio-input/narration.packed.mov` | `a1d96efa7a2366e2657a307e7bdedc3d910220e6f790a3559576684245fadfa2` |
| `frame-pixels` (`FrameImagePixels.swift`) | `82131bec855687f65fbce4d44c84c83909251c0c0029523b36fbc01b97e84b10` |

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
bun install --frozen-lockfile
bunx turbo build --filter=@yap/service... --filter=@yap/cli...
# The denoiser model is a verified prepared input; a fresh checkout links or prepares it.
node helpers/denoise/prepare.mjs --verify
swift build --build-system native --package-path helpers/mac --product yap-native
swift build --build-system native --package-path helpers/mac --product YapCaptureTests
node apps/macos/tests/build-controller-journey.mjs /tmp/yap-cs01/controller-build
swiftc -parse-as-library packages/test-harness/editing/FrameImagePixels.swift -o /tmp/yap-cs01/frame-pixels
YAP_CAMERA_PROJECT_OUTPUT=/tmp/yap-cs01/inputs-project helpers/mac/.build/debug/YapCaptureTests
YAP_CAMERA_SOURCE_ADMISSION_OUTPUT=/tmp/yap-cs01/inputs-admission helpers/mac/.build/debug/YapCaptureTests
export YAP_NATIVE=$PWD/helpers/mac/.build/debug/yap-native

# A
node packages/test-harness/editing/camera-library-corpus.mjs --out /tmp/yap-cs01/a-out \
  --executable /tmp/yap-cs01/controller-build/controller-journey --native "$YAP_NATIVE" \
  --video /tmp/yap-cs01/inputs-project/input.mov \
  --audio /tmp/yap-cs01/inputs-project/audio-input/narration.packed.mov

# B; controller.json is {"executable", "native", "video", "audio"} with the same four paths
node packages/test-harness/editing/webcam.mjs --case capture-to-project \
  --controller /tmp/yap-cs01/controller.json --camera /tmp/yap-cs01/inputs-admission/normal/camera \
  --pixels /tmp/yap-cs01/frame-pixels --out /tmp/yap-cs01/b-run --keep-home /tmp/yap-cs01/b-home

export COPYFILE_DISABLE=1
tar --no-mac-metadata --no-xattrs --uid 0 --gid 0 --uname '' --gname '' -czf a.tar.gz -C /tmp/yap-cs01/a-out library
tar --no-mac-metadata --no-xattrs --uid 0 --gid 0 --uname '' --gname '' -czf b.tar.gz -C /tmp/yap-cs01/b-home library
```

Both journeys reported `passed: true`. The B journey report (953 KB of exchanges and pictures)
is not kept; its SHA-256 is in the manifest.

**The queue fence for A.** Publication and the capture admission that follows it commit in the
same service turn, so no copy can be taken between them. A library closed during admission is
no substitute: a reserved capture intent pins absolute paths and file identities, so its clone
can never be admitted. The producer therefore fences with queue rules: one filler import runs
with its native reply held, 32 more fill the queue, and the capture admission after publication
is refused (`LIMIT_EXCEEDED`) before it reserves anything. The library then closes.

## Re-running the gate

```sh
export YAP_NATIVE=$PWD/helpers/mac/.build/debug/yap-native   # built from the code under test
node packages/test-harness/editing/camera-library-preservation.mjs \
  --library specs/camera-toggle/assets/pre-toggle-corpus/a.tar.gz --out /tmp/<new>/a
node packages/test-harness/editing/camera-library-preservation.mjs \
  --library specs/camera-toggle/assets/pre-toggle-corpus/b.tar.gz --out /tmp/<new>/b
node packages/test-harness/editing/camera-library-preservation.mjs --library ~/.yap --out /tmp/<new>/home
```

The service and CLI must be built (`dist/`) from the same code. Each run writes `report.json`
(`passed`), `originals.json` (the member inventory hashed before and after) and the frames it
delivered. The manifest's member lists are the `originals.json` of the archive runs.

[baseline/](baseline/) holds the first run, against this same pre-change build: the A and B
reports and delivered frames, and the `~/.yap` report (0 recordings, 61,225 members unchanged).
All three passed. Later runs compare against it.
