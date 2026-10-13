# 06 Wire contract, service operation, CLI and MCP

**Contract unlocked.** The toggle and the start state are reachable from the CLI, MCP and the
app channel through one operation.

## Wire

Selection (`capture.start`, `capture.restart`, `nativeStart`, `device.selection`;
`packages/protocol/src/capture.ts:35-51`):
```ts
cameraAtStart: z.enum(["on", "off"]).optional()
// refine: requires cameraDeviceId; a primary camera source refuses it.
// cameraDeviceId present and field absent → "on" (today's meaning).
```
`allocationArguments` (`apps/service/src/capture.ts:798-818`) appends
`selection.cameraDeviceId ? (selection.cameraAtStart ?? "on") : null`, so a replay differing only
in start state is refused.

Operation (`packages/protocol/src/operations.ts`, beside pause at `:1449-1456`):
```ts
z.object({
  operation: z.literal("capture.setCamera"),
  params: z.object({ recordingId: id, on: z.boolean() }).strict(),
}).strict().describe(
  "Turn the named live screen take's reserved camera on or off, any number of times. Off time " +
  "is a gap in the camera source, never a held picture. Setting the current state answers with " +
  "it. Answers like capture.status.")
// waits: 2*nativeCall (a cold camera start opens the device; slice 03 may tighten this)
```
Reply: the `capture.status` shape `{device, recording}`.
Errors: `INVALID_STATE` (settled or not recording/paused), `CAMERA_NOT_RESERVED`
(`recording.camera === null`, includes camera-only; refused by the service before native),
`CAMERA_PERMISSION_REQUIRED`, `SOURCE_UNAVAILABLE`, `CAMERA_FORMAT_CHANGED`,
`CAMERA_TOGGLE_LIMIT` (the 501st turn-on of a take). Native codes pass through the
service unchanged; nothing enumerates them. Any refusal while
turning on leaves the camera off and the take recording.

Status (`captureDeviceSchema`, strict, `capture.ts:126-135`) gains a required field:
```ts
camera: z.object({ deviceId: id.max(256), state: z.enum(["on", "off"]) }).strict().nullable()
// non-null exactly while native holds a take with a reserved companion camera
```
Unchanged: `captureReportSchema`, lifecycle states, catalog columns. A toggle is not a lifecycle
transition.

Private app channel: `capture.start` passes `cameraAtStart`; `capture.setCamera {recordingId, on}`
answers with the native status dictionary including `camera`.

## Changes

- `packages/protocol/src/capture.ts`, `operations.ts`, `fixtures/app-capture-contract.json`
  (add the operation, a start with `cameraAtStart:"off"`, a status sample with `camera`).
- `apps/service/src/capture.ts`: `setCamera(recordingId, on)` inside `serialize`, beside
  `transition` (`:383-397`); returns `{device: captureDeviceSchema.parse(answer), recording}`.
  `project-service.ts` switch case (`:1139-1151`).
- `apps/macos/Sources/Yap/CaptureController.swift`: `perform` case (`:123-158`), `status()` adds
  `"camera"` (`:209-222`), `start` parses `cameraAtStart` into `startsOn` (`:248-276`).
- Fake natives: `apps/service/src/project-capture.fixture.ts:125-129`, `capture.test.ts` (~`:310`),
  `packages/test-harness/editing/capture-coordination.mjs:143-150`.
- Docs: `skills/yap/SKILL.md` (~`:249`), `skills/yap/references/capability-catalog.md:78-79`.

## Verification (tests first)

- `packages/protocol/src/index.test.ts`: contract fixture parity; `cameraAtStart` without a camera refused.
- `apps/service/src/capture.test.ts`: serialized behind pause; refused when settled; `CAMERA_NOT_RESERVED`; native refusal passed through; replay identity includes `cameraAtStart`.
- `apps/service/src/project-capture.test.ts`: dispatch end to end; never-on take completes with camera `CAMERA_NOT_TURNED_ON` and the primary admitted.
- `capture-coordination.mjs`: CLI and MCP both call `capture.setCamera`.
- `apps/macos/tests/capture-service.test.mjs`: the app channel routes the operation.

**Human can see.** `yap capture.setCamera --recording-id … --on false` against the fixture journey.

**Must stay green.** Existing capture service, lifetime, finalizing and coordination tests.

**Delegated.** Nothing.

## Status (2026-10-12)

Done (one commit): protocol (`cameraAtStart`, required `device.camera`, `capture.setCamera`
with its wait), contract fixture (operation, a start with `cameraAtStart:"off"`, status samples),
service `setCamera` and dispatch, replay identity, every TypeScript fake native, the coordination
journey, skill docs. Checks run: protocol `index.test.ts`; service `capture`, `capture-finalizing`,
`capture-lifetime`, `lifetime`, `project-capture` tests; CLI `main.test.ts`;
`capture-coordination.mjs` (no native build needed). The never-on case needed no service or core
change: core already admits a camera `unavailable` with any code beside a published primary; the
`project-capture` test now pins it with `CAMERA_NOT_TURNED_ON`.

Where the tests live differs from the list above: serialization, settled refusal,
`CAMERA_NOT_RESERVED` and native pass-through are in `project-capture.test.ts` (its fixture can hold
a native answer and refuse once); `capture.test.ts` holds replay identity.

### Native part (CaptureController, with slice 05)

Done (second commit):
1. `status()` carries `"camera"`: `null` unless native holds a take with a reserved companion
   camera, otherwise `{"deviceId", "state": "on"|"off"}` from `NativeCapture.companionCamera`.
   It stays reported while paused and finalizing (state `off` once inputs stop).
2. `start` reads `cameraAtStart` (`"on"`/`"off"`; absent = on; anything else `INVALID_REQUEST`)
   into `CaptureCameraRequest.startsOn`, and echoes it in `selection` exactly as received. A
   primary camera or a start without `cameraDeviceId` refuses it.
3. `perform` routes `capture.setCamera {recordingId, on}` after the same take check as pause
   (`INVALID_STATE` for another or no take) to `NativeCapture.setCamera`, which refuses
   `CAMERA_NOT_RESERVED` itself and passes the switch's codes through, including
   `CAMERA_TOGGLE_LIMIT`. It answers with the `status()` dictionary.
4. The service's native call for `capture.setCamera` is bounded by the operation's public wait
   (`operationWaitMs("capture.setCamera")`, 20 s), not the channel's 10 s default:
   `ControlChannel.call` takes an optional per-call `timeoutMs`, and `operationWaitMs` is now the
   one source of both that wait and `operationDeadlineMs`.

Checks: `project-capture.test.ts` "a camera turn-on that outlasts an ordinary native call is still
answered" (red with `TIMEOUT` before the change). The app-channel routing is proved by
`packages/test-harness/editing/camera-toggle-controls.mjs` (real `CaptureController`, host
channel, service, CLI and MCP; fixture camera): start off, status `camera.state: "off"` with no
device opened, on, off (MCP), on, stop; two opens, two stops, one gap in the receipt; a
never-turned-on take completes with `CAMERA_NOT_TURNED_ON` and its primary published.
`capture-service.test.mjs` asserts the real app's idle status carries `camera: null`; its fixture
window lists no camera, so it cannot route a toggle. Run against this build: that test, "records its
own window" and "cancel discards" (the real app's status now satisfies the required `device.camera`).
Other checks: service `capture`, `capture-finalizing`, `capture-lifetime`, `lifetime`,
`project-capture`; protocol `index.test.ts`; CLI `main.test.ts`; `capture-coordination.mjs`.
