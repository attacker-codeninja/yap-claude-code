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
reverted that: slice 05 refuses a turn-on that would start run 500 (`CAMERA_TOGGLE_LIMIT`), so a
take has at most 499 gaps. 500 gaps take about 20 KB, inside the original 64 KiB receipt bound
and the normalized receipt's 32 KiB, so no bound changes. Swift (`CameraAvailability.maximumGaps`)
and TypeScript (`maxCameraGaps`) both state 499 and both have a test at the edge.

### A crashed reordered tail ends the camera prefix (02)

A process crash can leave a fragment whose last picture was flushed ahead of earlier pictures
in presentation order (H.264 reordering). For an unsealed raw movie only, `scanRaw` now ends
the physical prefix at the first mapped picture the raw movie lacks, with the existing
`acceptedBeyondPhysicalEOF` diagnostic, instead of refusing the whole camera. A sealed raw
movie with a missing picture is still refused. Case `crashRecoveryWithGaps` needed this to be
deterministic; before it, recovery depended on where the fragment happened to end.
