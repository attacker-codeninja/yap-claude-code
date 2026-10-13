# Camera on and off during a take

A person recording their screen can turn the companion camera off and back on, any number
of times, from the floating take controls, the menu, the CLI or MCP. A take can start with
the camera off and turn it on later. Off time is a real gap in the camera source: the camera
never shows a held picture across it, and a held picture is never certified as recorded.

## Next Agent Prompt

Status (2026-10-12): slices 00, 01, 02, 04, 05, 06, 07 and 08 are committed; 03 (optional) was not
done. Slice 08 extended the toggle journeys and gapped admission, measured the 500-run receipt and
the reserved-off mapping, ran the live-app suites, re-ran the preservation gate (A, B and a clone of
`~/.yap`, all green), and ran the full suite once, fixing what it found. One finding is open for the
user: KU6 is confirmed (below and in [choices](choices.md)); the design was not changed.
Next pickup: whole-spec review, then close-spec.

You are resuming this feature. Do this:

1. Read this README, [slice 08](slices/08-acceptance.md) and [choices](choices.md) (its slice 08
   section holds the measurements, the KU6 finding and the open polish notes).
2. Get the user's decision on KU6 (whether the companion ingress should log only camera rows,
   owner `CaptureClockIngress`). It is a follow-up, not part of closing.
3. Review the whole spec's commits (`review`), consolidate `choices.md`, show the user the redrawn
   [overlay shots](assets/overlay/) (`preview-shots`), then run close-spec.

Warnings:
- Never write to `~/.yap`. Every run uses a scratch `YAP_HOME`; the preservation gate works
  on an APFS clone and hashes the original before and after.
- Do not touch camera-only takes (`PrimaryCameraCaptureInput`). The toggle is companion-only.
- Slice 02 changes the recording format; slice 01's gate must stay green after it.
- Do not change product code (native, service, protocol) while slice 01's corpus is being
  produced: the corpus must come from the unchanged build.
- No step waits on a physical camera (user decision, 2026-10-12). Every device question is
  settled by design in slice 05; fixtures and mocks prove the behaviour. This Mac lists no camera
  (`system_profiler SPCameraDataType`); the user's camera is probably Continuity Camera. A
  real-device run is an optional extra in slice 08, done only if a camera happens to be present.
- The preservation gate runs the built `dist/` and `YAP_NATIVE`: rebuild both from the code
  under test first. A fresh checkout needs the prepared RNNoise model
  (`node helpers/denoise/prepare.mjs`) before any native build.
- The gate asserts admission states exactly the receipt's own `gaps` (none for a pre-change
  take, which keeps the key absent) and availability equal to support minus gaps, so it also
  holds for a library that already has toggled takes.
- Gate frames use `maxLongEdge: 144` so old cached renders cannot answer for new code. The
  [baseline frames](assets/pre-toggle-corpus/baseline/) are the before picture for
  compare-screenshots.
- A library closed mid-admission cannot be checked on a clone: a reserved capture intent pins
  absolute paths and inodes ([choices](choices.md)). Corpus A is fenced before reservation.

TODO:
- [x] 00 Floating controls redesign: preview card, minimize/restore — [slice](slices/00-overlay-redesign.md)
- [x] 01 Preservation baseline corpus and gate — [slice](slices/01-preservation-baseline.md)
- [x] 02 Camera availability intervals (writer → receipt → canonical → recovery) — [slice](slices/02-availability-intervals.md)
- [ ] 03 (optional, non-blocking) Physical session cycle measurement — [slice](slices/03-session-cycle-spike.md)
- [x] 04 Admission of gapped camera proof — [slice](slices/04-admission.md)
- [x] 05 Companion session lifecycle: reserve, turn on/off — [slice](slices/05-session-lifecycle.md)
- [x] 06 Wire contract, service operation, CLI/MCP — [slice](slices/06-wire-and-service.md)
- [x] 07 App controls: camera button, reservation, library wording — [slice](slices/07-app-controls.md)
- [x] 08 End-to-end harness, physical acceptance, preservation re-check, full run (close is the integrator's) — [slice](slices/08-acceptance.md)

## Decisions (made by the user)

- On/off toggle mid-take, any number of times, leaving gaps in the camera source.
- Any screen take reserves a camera if one exists: the camera picked in the menu, or the
  system default. It is reserved even when the camera switch is off at start. The device is
  not opened and its light stays off until turned on. Without camera permission already
  granted, nothing is reserved and the toggle is absent.
- No backward compatibility and no migrations, with one exception: recordings that already
  exist on the user's Mac must keep working. Checked 2026-10-12: the installed app's library
  (`~/.yap`) holds 0 recordings, so the gate proves preservation on a pre-change corpus and on
  a clone of `~/.yap` at the end.
- Recordings saved by release 0.1.33 must keep working (user, 2026-10-12). This plan's base
  commit differs from the 0.1.33 release commit (`4667cdca`) only in site and docs files, so the
  slice 01 corpus is 0.1.33-format media; the gate is the proof.
- Camera-only takes are out of scope: there the camera is the primary source and "off" would be
  a pause.
- "Minimize preview" (hide the picture, camera keeps recording) and "camera off" (stop
  recording the camera) are different controls. Minimize must look like a window minimize.

## Contracts

Each concept has one owner. Shapes are written out in the slice that owns them.

| Concept | Owner | Shape |
|---|---|---|
| Camera availability intervals | `CameraMedia` receipt (`helpers/mac/Sources/YapCapture/CameraMedia.swift`), arithmetic in one value type `CameraAvailability`; TypeScript reads it only through `cameraProofIntervals()` in `packages/core/src/evidence.ts` | `support` stays the outer span; new optional `gaps: ExactRange[]`, **omitted when empty**. Intervals = `support − gaps`. A pre-change receipt is the one-interval case. ([02](slices/02-availability-intervals.md), [04](slices/04-admission.md)) |
| Run boundaries (frames between one turn-on and the next turn-off) | `CameraWriter` acceptance gate | Mapping rows carry optional `cameraFrame.run` (omitted when 0); callbacks while off get disposition `camera-off`. No new journal events. ([02](slices/02-availability-intervals.md)) |
| Companion session lifecycle | `CameraCaptureInput` | Device opened lazily on turn-on, session dropped on turn-off. ([05](slices/05-session-lifecycle.md)) |
| Live camera state | `NativeCapture`, exposed as `capture.status` `device.camera` | `{deviceId, state: "on"\|"off"} \| null`; never stored in the catalog. ([06](slices/06-wire-and-service.md)) |
| Start state | capture selection | `cameraAtStart: "on" \| "off"` (optional; absent with a camera = `"on"`, today's meaning). ([06](slices/06-wire-and-service.md)) |
| Toggle operation | `packages/protocol/src/operations.ts` | `capture.setCamera {recordingId, on}` → same reply as `capture.status`. CLI and MCP get it automatically. ([06](slices/06-wire-and-service.md)) |
| Never-turned-on camera | `NativeCapture` publication | camera publication `unavailable`, code `CAMERA_NOT_TURNED_ON`; take still `complete`. ([05](slices/05-session-lifecycle.md)) |
| App action | `ControlsAction.setCamera(Bool)` | Menu switch and floating controls send the same action; replaces the private `companionCameraRequested`. ([07](slices/07-app-controls.md)) |

## Slice graph

```
00 overlay redesign (done)
01 preservation baseline ──► 02 availability intervals ──► 04 admission ───────────┐
                                                 02 ──► 05 session lifecycle ──► 06 wire + service ──► 07 app controls ──► 08 acceptance
03 optional device measurement (off the critical path)                      04 ──► 08
```

## Invariants and firewalls

- A held picture is never acquisition evidence ([choices.md:975-983](../done/agent-editing/choices.md)).
  Three independent checks hold it: the writer refuses frames that cross an off boundary; the
  canonical movie's occupied segments must equal the receipt intervals exactly; core admission
  requires the probed `available[]` to deep-equal the proof intervals.
- The raw movie stays continuous; only the canonical `video.mov` carries gaps, as explicit
  empty edits ([20e1 evidence](../done/agent-editing/assets/20e1-camera-gap-materialization/README.md):
  correcting the raw duration failed, empty edits keep occupied pictures exact).
- A camera toggle never touches the primary clock, the screen stream, or the take lifecycle
  (no report, no `ingestLifecycle`, no catalog column).
- Camera lost while off: the take continues; the next turn-on refuses with `SOURCE_UNAVAILABLE`.
  Camera lost while on: whole-take interruption, unchanged from today.
- A failed turn-on leaves the camera off and the take recording.
- Downstream readers that are already gap-aware stay untouched: asset availability
  (`packages/core/src/assets.ts`), composition (`packages/composition`), renderer
  (`CompositionPictureExecutor`). No camera special case is added to them.

The end state reads as if designed today: one interval model, one session owner, one action.
Nothing in this plan is a compatibility shim, so nothing has to be removed later.

## Rejected alternatives

- **`supportSegments` replacing `support`** (risk-first draft): every new receipt would change
  shape, so a continuous take after the change would no longer match a pre-change receipt.
  `gaps` omitted-when-empty keeps those identical.
- **Journal events `cameraOn`/`cameraOff`** (fewest-slices and risk-first drafts): would make a
  second statement of the off intervals beside the receipt. The mapping's `run` field is
  written live (so recovery has it) and pinned by the mapping hash.
- **Keeping a built session and calling start/stop on it** (fewest-slices draft): opens the
  device at take start, which can light the camera and contradicts "light stays off". Opening
  lazily makes that question moot.
- **Two slices plus gates** (fewest-slices draft): the native data plane, session lifecycle and
  admission each have their own seam and failure mode; merging them leaves a slice that cannot
  be accepted or rejected by one artifact.
- **Camera state inside `device.selection`** (fewest-slices draft): the selection is what the
  take was started with; live state belongs to its own field.

## Known unknowns

| Unknown | Discovered in |
|---|---|
| Is the format identical between two sessions on the same device? | Settled by design (05): a "compatible format" predicate; a real mismatch refuses the turn-on and the take continues. 03 may confirm. |
| Start latency of a cold session | Settled by design (06): the operation waits `2*nativeCall`. 03 may tighten it. |
| Does `stopRunning` post an interruption notification the loss observer must ignore? | Settled by design (05): observers are removed before `stop`, per session. |
| Camera light while a take holds a reserved camera | Settled by design (05): the device is not opened until turned on. |
| Passthrough export and Stop latency with hundreds of gaps | Measured (08): 500 runs, camera Stop 1,078 ms; receipt 21,960 B of 65,536, normalized 22,102 B of 32,768 |
| Mapping size on long reserved takes (it logs every screen/mic callback, read budget 256 MiB) | **Confirmed (08), raised with the user:** about 2.75 MB/min with the microphone, so about 97 min to the budget (about 55 with system audio) |
| Recovery code for a never-turned-on directory that holds only a mapping | 05 |
| A crash while off may lose the last run's unfragmented tail | 02 (case `crashRecoveryWithGaps`), accepted and documented |

## Review map

Every visual shot goes through [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md)
as its last check, and through [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md)
against its previous look. Human checkpoints are non-blocking: open the shots with
[preview-shots](../../.agents/skills/preview-shots/SKILL.md), wait about five minutes, then
decide on the evidence and record the decision here.

Source of this plan: three independent drafts (fewest slices, risk first via Codex, seam
quality), synthesized 2026-10-12. Survey notes and drafts were working files only; this folder
supersedes them.
