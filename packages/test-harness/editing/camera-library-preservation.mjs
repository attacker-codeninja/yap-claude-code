import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  opendir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, run } from "./source-evidence-fixture.mjs";

// Recordings that already exist must keep working under the code being tested. The original
// library is only read: the service runs on an APFS clone, and every original member is hashed
// before and after. Usage:
//   YAP_NATIVE=<yap-native> node camera-library-preservation.mjs --library <home|corpus.tar.gz> --out <new dir>
// <home> is a Yap home that holds library/ (for example ~/.yap); a .tar.gz holds library/ at its root.
const { values } = parseArgs({
  options: { library: { type: "string" }, out: { type: "string" } },
});
assert.ok(values.library && values.out && process.env.YAP_NATIVE, "--library, --out, YAP_NATIVE");
assert.equal(process.env.YAP_TEST_PROBE_OVERRIDES, undefined);
assert.equal(process.env.YAP_TEST_UNAVAILABLE_OPERATIONS, undefined);
await mkdir(resolve(values.out));
const out = await realpath(resolve(values.out));
await mkdir(join(out, "frames"));
const input = await realpath(resolve(values.library));
const scratch = await mkdtemp("/tmp/yap-camera-preservation-");
// A picture size no caller requested before, so delivered frames are rendered by this build.
const maxLongEdge = 144;
const range = (startUs, endUs) => ({ startUs, endUs });
const report = {
  scope:
    "Existing library under the tested service on an APFS clone: recordings, source admission, camera availability, receipts, frames and project rendering; originals read-only",
  passed: false,
  library: input,
  nativeSha256: hash(await readFile(process.env.YAP_NATIVE)),
  harnessSha256: hash(await readFile(import.meta.filename)),
  trace: [],
  exchanges: [],
  checks: {},
};

async function fileHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
/** Every member below root, without following links: type, mode, size and content hash. */
async function inventory(root) {
  const members = [];
  async function walk(directory) {
    const names = [];
    for await (const entry of await opendir(directory)) names.push(entry.name);
    for (const name of names.sort()) {
      const path = join(directory, name);
      const stat = await lstat(path);
      const member = { path: relative(root, path), mode: (stat.mode & 0o7777).toString(8) };
      if (stat.isDirectory()) {
        members.push({ ...member, type: "directory" });
        await walk(path);
      } else if (stat.isFile())
        members.push({ ...member, type: "file", bytes: stat.size, sha256: await fileHash(path) });
      else if (stat.isSymbolicLink())
        members.push({ ...member, type: "symlink", target: await readlink(path) });
      else members.push({ ...member, type: "other" });
    }
  }
  await walk(root);
  return members;
}
const inventoryDigest = (members) => hash(JSON.stringify(members));
async function pages(operation, field) {
  const items = [];
  for (let cursor; ;) {
    const page = await service.call(operation, cursor ? { cursor } : {});
    items.push(...page[field]);
    if (!page.nextCursor) return items;
    cursor = page.nextCursor;
  }
}
async function picture(params, name) {
  const file = join(out, "frames", name + ".png");
  let first;
  const delivered = await poll(
    async () => {
      const value = await service.call("frame.get", params, { output: file });
      first ??= value;
      return value;
    },
    (value) => value.state === "ready",
    name,
  );
  const bytes = await readFile(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const output = delivered.published.output;
  assert.ok(output.width > 0 && output.height > 0);
  return { params, firstState: first.state, sha256: hash(bytes), receipt: output };
}

// The original is either a home directory or a corpus archive. An archive is the original; its
// extraction is a read-only source like a home.
let original = input;
if (input.endsWith(".tar.gz")) {
  report.archiveSha256Before = await fileHash(input);
  original = join(scratch, "original");
  await mkdir(original);
  await run("tar", ["-xzf", input, "-C", original], { timeout: 120000 });
}
const originalLibrary = join(original, "library");
assert.ok((await lstat(originalLibrary)).isDirectory(), "The library must hold library/");
const before = await inventory(originalLibrary);
report.originals = { members: before.length, digestBefore: inventoryDigest(before) };
await writeFile(join(out, "originals.json"), JSON.stringify(before, null, 2) + "\n");
const home = join(scratch, "home");
await mkdir(home);
await run("cp", ["-c", "-p", "-R", originalLibrary, join(home, "library")], { timeout: 600000 });

// Facts read from the clone before the service opens it, independent of the code under test.
const catalog = new DatabaseSync(join(home, "library/catalog.sqlite"), { readOnly: true });
const atOpen = {
  // Each recording keeps its state and the state of each source's publication.
  recordings: catalog
    .prepare(
      `SELECT recordingId,state,json_extract(publication,'$.observation.primary.state') AS "primary",
        json_extract(publication,'$.observation.camera.state') AS camera FROM recordings`,
    )
    .all()
    .map((row) => ({ ...row })),
  projects: catalog.prepare("SELECT count(*) AS count FROM projects").get().count,
  admittedAcquisitions: catalog
    .prepare("SELECT id FROM acquisitions WHERE metadata IS NOT NULL")
    .all()
    .map((row) => row.id),
};
catalog.close();
const recordingDirectories = [];
for await (const entry of await opendir(join(home, "library/recordings")).catch(() => []))
  if (entry.isDirectory()) recordingDirectories.push(entry.name);
report.checks.atOpen = { ...atOpen, recordingDirectories };

const service = new JourneyService(home, report, join(out, "native"));
const reread = join(scratch, "reread");
await mkdir(reread);
try {
  await service.start();
  const listed = await pages("recording.list", "recordings");
  const listedIds = listed.map((recording) => recording.recordingId);
  for (const id of [...atOpen.recordings.map((row) => row.recordingId), ...recordingDirectories])
    assert.ok(listedIds.includes(id), `Recording ${id} is no longer listed`);
  report.checks.recordings = [];
  const cameraAcquisitions = new Set();
  for (const { recordingId } of listed) {
    const { recordingId: _, ...before } = atOpen.recordings.find(
      (row) => row.recordingId === recordingId,
    );
    // Only takes that were complete with every source published owe admission, frames and receipts.
    const exercised =
      before.state === "complete" &&
      before.primary === "published" &&
      [null, "published"].includes(before.camera);
    const check = { recordingId, before, exercised, retried: [] };
    report.checks.recordings.push(check);
    if (!exercised) continue;
    const settled = await poll(
      async () => {
        const value = await service.call("recording.get", { recordingId });
        for (const source of value.sourceAdmissions) {
          assert.equal(source.admissionError, null, JSON.stringify(source.admissionError));
          if (source.job?.state !== "failed") continue;
          // An interrupted attempt is retried once through the public operation; anything else fails now.
          assert.ok(
            source.job.retryable && !check.retried.includes(source.job.jobId),
            `${source.kind} admission failed: ${JSON.stringify(source.job)}`,
          );
          check.retried.push(source.job.jobId);
          await service.call("job.retry", { jobId: source.job.jobId });
        }
        return value;
      },
      (value) =>
        value.sourceAdmissions.length > 0 &&
        value.sourceAdmissions.every((source) => source.job?.state === "ready"),
      `recording ${recordingId} sources ready`,
    );
    check.sources = [];
    for (const admission of settled.sourceAdmissions) {
      assert.equal(admission.publication.state, "published");
      const acquisition = await service.call("acquisition.get", {
        acquisitionId: admission.acquisitionId,
      });
      const source = {
        kind: admission.kind,
        acquisitionId: acquisition.id,
        admittedByThisBuild: !atOpen.admittedAcquisitions.includes(acquisition.id),
        retried: check.retried.includes(admission.job.jobId),
      };
      check.sources.push(source);
      if (admission.kind !== "camera") continue;
      cameraAcquisitions.add(acquisition.id);
      const directory = join(home, "library/recordings", recordingId, "camera");
      const receipt = JSON.parse(
        await readFile(join(directory, "camera.publication.json"), "utf8"),
      );
      // Admission states exactly the receipt's own gaps: none for a camera never turned off.
      const proof = acquisition.evidence.receipt.publications.video;
      assert.equal("gaps" in proof, "gaps" in receipt);
      assert.deepEqual(proof.gaps, receipt.gaps);
      const binding = acquisition.bindings.find((value) => value.sourceRoles.includes("video"));
      assert.ok(binding, "Camera acquisition binds its video");
      const asset = await service.call("asset.get", { assetId: binding.assetId });
      const origin = asset.originUs ?? 0;
      // Available is the receipt's support minus its gaps, from the asset origin.
      const bounds = [receipt.support.startUs];
      for (const gap of receipt.gaps ?? []) bounds.push(gap.startUs, gap.endUs);
      bounds.push(receipt.support.endUs);
      const expected = [];
      for (let index = 0; index < bounds.length; index += 2)
        expected.push(range(bounds[index] - origin, bounds[index + 1] - origin));
      assert.deepEqual(binding.available, expected);
      const frame = await picture(
        {
          assetId: binding.assetId,
          streamId: binding.streamId,
          acquisitionId: acquisition.id,
          atUs: expected[0].startUs,
          maxLongEdge,
        },
        `camera-${recordingId}`,
      );
      assert.equal(frame.receipt.actualSourceUs, expected[0].startUs);
      // A fresh import of a clone of the camera directory reads the receipt through this build.
      const copy = join(reread, recordingId);
      await run("cp", ["-c", "-p", "-R", directory, copy], { timeout: 600000 });
      const pending = await service.call("acquisition.import", {
        path: copy,
        requestId: `preservation-reread-${recordingId}`,
      });
      const job = await poll(
        () => service.call("job.get", { jobId: pending.jobId }),
        (value) => value.state === "ready",
        `camera reread ${recordingId}`,
      );
      const fresh = await service.call("acquisition.get", {
        acquisitionId: job.target.acquisitionId,
      });
      assert.deepEqual(
        fresh.evidence.receipt.publications.video,
        acquisition.evidence.receipt.publications.video,
      );
      const freshBinding = fresh.bindings.find((value) => value.sourceRoles.includes("video"));
      assert.equal(freshBinding.assetId, binding.assetId);
      assert.deepEqual(freshBinding.available, binding.available);
      Object.assign(source, {
        support: receipt.support,
        originUs: origin,
        available: binding.available,
        frame,
        reread: { acquisitionId: fresh.id, publicationEqual: true },
      });
    }
    assert.equal(
      check.sources.some((source) => source.kind === "camera"),
      settled.camera !== null,
    );
  }

  for (const check of report.checks.recordings) {
    const now = await service.call("recording.get", { recordingId: check.recordingId });
    check.after = {
      state: now.state,
      primary: now.publication?.primary?.state ?? null,
      camera: now.publication?.camera?.state ?? null,
    };
    assert.deepEqual(check.after, check.before, `Recording ${check.recordingId} changed state`);
  }

  const projects = await pages("project.list", "projects");
  assert.ok(projects.length >= atOpen.projects, "Every project is still listed");
  report.checks.projects = [];
  for (const { projectId } of projects) {
    const { currentRevisionId: revisionId } = await service.call("project.get", { projectId });
    const { revision } = await service.call("revision.get", { projectId, revisionId });
    const clips = revision.document.clips.filter((clip) => clip.placement?.kind === "project");
    const clip =
      clips.find((value) => cameraAcquisitions.has(value.acquisitionId)) ??
      clips.find((value) => value.streamId && value.assetId);
    const check = {
      projectId,
      revisionId,
      cameraClip: Boolean(clip && cameraAcquisitions.has(clip.acquisitionId)),
    };
    report.checks.projects.push(check);
    if (!clip) continue;
    const frame = await picture(
      { projectId, revisionId, atUs: clip.placement.range.startUs, maxLongEdge },
      `project-${projectId}`,
    );
    const placed = frame.receipt.pictures.find((value) => value.clipId === clip.id);
    assert.equal(placed?.status, "available", "The placed clip renders from its source");
    Object.assign(check, { clipId: clip.id, frame });
  }
  report.checks.counts = {
    recordings: listed.length,
    exercisedRecordings: report.checks.recordings.filter((value) => value.exercised).length,
    cameraRecordings: cameraAcquisitions.size,
    projects: projects.length,
    projectsRenderingCamera: report.checks.projects.filter((value) => value.cameraClip).length,
  };
  await service.stop();

  const after = await inventory(originalLibrary);
  report.originals.digestAfter = inventoryDigest(after);
  assert.deepEqual(after, before, "The original library changed");
  if (report.archiveSha256Before) {
    report.archiveSha256After = await fileHash(input);
    assert.equal(report.archiveSha256After, report.archiveSha256Before);
  }
  report.originals.unchanged = true;
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await service.stop().catch((error) => {
    report.passed = false;
    report.shutdownError = error.message;
  });
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(out, "service.log"), service.logs.join(""));
  await rm(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, counts: report.checks.counts, out }));
