import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { ControllerJourneyService } from "./controller-journey-service.mjs";
import { poll } from "./source-evidence-fixture.mjs";

/**
 * capture.setCamera through the app's real capture controller, host channel and service, from the
 * CLI and MCP. Only the camera device and the screen are prerecorded.
 */
const { values } = parseArgs({
  options: Object.fromEntries(
    ["out", "executable", "native", "video"].map((name) => [name, { type: "string" }]),
  ),
});
for (const name of ["out", "executable", "native", "video"]) assert.ok(values[name], name);
const out = resolve(values.out);
await mkdir(out);
const fixture = Object.fromEntries(
  ["executable", "native", "video"].map((name) => [name, resolve(values[name])]),
);
const report = { passed: false, trace: [], exchanges: [], fixture: [], cases: {} };
const service = new ControllerJourneyService(join(out, "home"), report, fixture);
const start = (requestId) =>
  service.call("capture.start", {
    requestId,
    source: { kind: "display", displayId: 1 },
    cameraDeviceId: "fixture-camera",
    cameraAtStart: "off",
    microphone: false,
  });
const finished = async (recordingId) => {
  await service.call("capture.stop", { recordingId });
  return poll(
    () => service.call("recording.get", { recordingId }),
    (value) => value.state === "complete" && value.publication?.inputsClosed,
    "take complete",
  );
};
try {
  await service.start();
  await service.fixtureCall("configure", { productionCamera: true });

  // A take that starts with its camera off opens no device until it is turned on.
  const take = await start("toggled");
  const params = { recordingId: take.recordingId };
  const status = await service.call("capture.status", {});
  assert.deepEqual(status.device.camera, { deviceId: "fixture-camera", state: "off" });
  assert.equal(status.device.selection.cameraAtStart, "off");
  assert.equal((await service.fixtureCall("inspect")).cameraOpens, 0);

  const on = await service.call("capture.setCamera", { ...params, on: true });
  assert.deepEqual(on.device.camera, { deviceId: "fixture-camera", state: "on" });
  assert.equal(on.recording.recordingId, take.recordingId);
  // The fixture camera stamps its whole clip from the moment it opens; let it all become past
  // before the turn-off, as a live camera's pictures are.
  await delay(3_000);
  const off = await service.call("capture.setCamera", { ...params, on: false }, { transport: "mcp" });
  assert.deepEqual(off.device.camera, { deviceId: "fixture-camera", state: "off" });
  let inspection = await service.fixtureCall("inspect");
  assert.deepEqual([inspection.cameraOpens, inspection.cameraStarts, inspection.cameraStops], [1, 1, 1]);
  await service.call("capture.setCamera", { ...params, on: true });
  await delay(3_000);
  const toggled = await finished(take.recordingId);
  inspection = await service.fixtureCall("inspect");
  assert.deepEqual([inspection.cameraOpens, inspection.cameraStarts, inspection.cameraStops], [2, 2, 2]);
  assert.equal(toggled.publication.camera.state, "published");
  const receipt = JSON.parse(
    await readFile(
      join(service.home, "library/recordings", take.recordingId, "camera/camera.publication.json"),
      "utf8",
    ),
  );
  assert.equal(receipt.gaps?.length, 1, JSON.stringify(receipt.gaps));
  report.cases.toggled = { take: toggled, gaps: receipt.gaps };

  // A reserved camera that is never turned on leaves the take complete.
  const idle = await start("never-on");
  const never = await finished(idle.recordingId);
  assert.equal(never.publication.camera.state, "unavailable");
  assert.equal(never.publication.camera.error.code, "CAMERA_NOT_TURNED_ON");
  assert.equal(
    never.sourceAdmissions.find((source) => source.kind === "primary")?.publication.state,
    "published",
  );
  assert.equal((await service.fixtureCall("inspect")).cameraOpens, 0);
  report.cases.neverOn = { take: never };
  report.passed = true;
} finally {
  report.logs = service.logs;
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
