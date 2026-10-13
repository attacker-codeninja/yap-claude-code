import assert from "node:assert/strict";
import { copyFile, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ControllerJourneyService } from "./controller-journey-service.mjs";
import { hash, poll } from "./source-evidence-fixture.mjs";

// A library holding a published companion-camera take that admission has not touched: no
// acquisition intent, no job. The actual controller, CameraCaptureInput and service record it.
// camera-library-preservation.mjs reads the result.
//
// The fence uses only queue rules: one heavy job runs at a time, and admission refuses once 32
// jobs are queued. The first filler import runs and its native reply is held until the library
// closes; 32 more wait behind it. The capture admission that follows publication is refused
// before it reserves anything, and no capacity frees up before the library closes.
const queuedLimit = 32;
const { values } = parseArgs({
  options: Object.fromEntries(
    ["out", "executable", "native", "video", "audio"].map((name) => [name, { type: "string" }]),
  ),
});
for (const name of ["out", "executable", "native", "video", "audio"]) assert.ok(values[name], name);
await mkdir(resolve(values.out));
const out = await realpath(resolve(values.out));
const fixture = Object.fromEntries(
  ["executable", "native", "video", "audio"].map((name) => [name, resolve(values[name])]),
);
const scratch = await mkdtemp("/tmp/yap-camera-corpus-");
const home = join(scratch, "home");
const barrier = join(scratch, "barrier");
const report = {
  scope:
    "Published companion-camera take (pause/resume) closed before admission reserved anything; prerecorded input, actual controller, camera input and service",
  passed: false,
  trace: [],
  exchanges: [],
  fixture: [],
  inputs: Object.fromEntries(
    await Promise.all(
      Object.entries(fixture).map(async ([name, path]) => [
        name,
        { path, sha256: hash(await readFile(path)) },
      ]),
    ),
  ),
};
let service;
try {
  await mkdir(barrier);
  const holdConfig = join(barrier, "hold.json");
  await writeFile(holdConfig, JSON.stringify({ operation: "media.probe", directory: barrier }));
  // Filler media lives in scratch; a later service finds it gone and settles those jobs as failed.
  const filler = join(scratch, "filler.mov");
  await copyFile(fixture.video, filler);
  service = new ControllerJourneyService(home, report, { ...fixture, replyHold: holdConfig });
  await service.start();
  await service.fixtureCall("configure", { productionCamera: true });
  const fillers = [];
  const queueFiller = async () =>
    fillers.push(
      (
        await service.call("asset.import", {
          requestId: `queue-fence-${fillers.length}`,
          path: filler,
        })
      ).jobId,
    );
  await queueFiller();
  const held = await poll(
    async () => JSON.parse(await readFile(join(barrier, "entered.json"), "utf8").catch(() => "{}")),
    (value) => value.operation === "media.probe",
    "first filler reply held",
  );
  while (fillers.length <= queuedLimit) await queueFiller();
  assert.equal(
    (await service.call("asset.import", { requestId: "queue-full", path: filler }, { error: true }))
      .code,
    "LIMIT_EXCEEDED",
  );
  const take = await service.call("capture.start", {
    requestId: "pre-toggle-corpus-a",
    source: { kind: "display", displayId: 1 },
    cameraDeviceId: "fixture-camera",
    microphone: true,
  });
  assert.equal((await service.fixtureCall("inspect")).inputBoundary, "CameraCaptureInput");
  await service.call("capture.pause", { recordingId: take.recordingId });
  await service.call("capture.resume", { recordingId: take.recordingId });
  await service.call("capture.stop", { recordingId: take.recordingId });
  const recording = await poll(
    () => service.call("recording.get", { recordingId: take.recordingId }),
    (value) => value.state === "complete",
    "take complete",
  );
  assert.equal(recording.publication.primary.state, "published");
  assert.equal(recording.publication.camera.state, "published");
  assert.equal(recording.sourceAdmissions.length, 2);
  for (const source of recording.sourceAdmissions) {
    assert.equal(source.acquisitionId, null, "Admission reserved an acquisition past the fence");
    assert.equal(source.job, null);
  }
  await service.stop();
  service = undefined;
  await cp(join(home, "library"), join(out, "library"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  report.take = take;
  report.atFence = { fillers, heldOperation: held.operation, recording };
  report.passed = true;
} finally {
  if (service) {
    report.logs = service.logs;
    await service.stop().catch((error) => (report.shutdownError = error.message));
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await rm(scratch, { recursive: true, force: true });
}
assert.equal(report.passed, true);
console.log(JSON.stringify({ passed: report.passed, out }));
