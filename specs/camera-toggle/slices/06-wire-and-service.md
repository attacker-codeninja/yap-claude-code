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
`CAMERA_TOGGLE_LIMIT` (a turn-on that would start run 500). Native codes pass through the
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

**Until the native side lands, the real app is broken against this service**: `device.camera` is
required, so every `capture.status` answer from today's `CaptureController` fails the service's
parse, which also blocks stop reconciliation and deletion. Land this with the native part, not
before.

### Left for `apps/macos/Sources/Yap/CaptureController.swift` (after slice 05)

1. `status()`: add `"camera"`: `null` unless native holds a take with a reserved companion camera;
   otherwise `{"deviceId": <reserved id>, "state": "on"|"off"}` read from `NativeCapture`. Every
   status-shaped answer (status, setCamera) carries it, including while paused and finalizing.
2. `start`: parse optional `cameraAtStart` (`"on"`/`"off"`; absent with `cameraDeviceId` = on) into
   the session's start state, and echo it in `selection` exactly as received (absent stays absent).
3. `perform`: route `capture.setCamera {recordingId, on}` to `NativeCapture.setCamera`. Refuse a
   different or absent take with `INVALID_STATE`, and no reserved camera with `CAMERA_NOT_RESERVED`
   (the service checks first; native must agree). Setting the current state is a no-op answering
   status. Pass refusals through as codes: `CAMERA_PERMISSION_REQUIRED`, `SOURCE_UNAVAILABLE`,
   `CAMERA_FORMAT_CHANGED`, `CAMERA_TOGGLE_LIMIT`; after any refusal the camera is off and the take
   still recording. Answer with the `status()` dictionary.
4. Answer within the control channel's per-call deadline (`DEFAULT_CALL_TIMEOUT_MS`, 10 s): the
   service's native call is bounded by it even though the public wait is `2*nativeCall`.
5. `apps/macos/tests/capture-service.test.mjs`: the app channel routes `capture.setCamera` and
   status includes `camera` (not written; needs the native build).
