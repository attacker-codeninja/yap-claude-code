import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Review shots say they are synthetic; shots for the site and videos can leave that label out.
 * `FIXTURE_LABEL=omit` must remove the label and change nothing else in the frame, so each
 * renderer runs twice and the two shots may differ only inside the label's region.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "yap-view-shot-labels-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function render(runner, label) {
  const output = join(scratch, `${runner}-${label ?? "default"}`);
  const environment = { ...process.env, SHOTS: output };
  delete environment.FIXTURE_LABEL;
  if (label) environment.FIXTURE_LABEL = label;
  execFileSync(process.execPath, [join(root, "apps/macos/tests", runner)], {
    cwd: root,
    env: environment,
    stdio: ["ignore", "ignore", "inherit"],
    timeout: 600_000,
  });
  return output;
}

function pixels(png) {
  const [width, height] = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      png,
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split(",")
    .map(Number);
  const rgba = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  return { width, height, rgba };
}

/** Pixel rows, top first, where the two shots differ. */
function differingRows(a, b) {
  assert.deepEqual([a.width, a.height], [b.width, b.height], "both shots keep the same size");
  const rows = [];
  const stride = a.width * 4;
  for (let y = 0; y < a.height; y++) {
    if (
      !a.rgba
        .subarray(y * stride, (y + 1) * stride)
        .equals(b.rgba.subarray(y * stride, (y + 1) * stride))
    )
      rows.push(y);
  }
  return rows;
}

function metadata(output, fixture) {
  return JSON.parse(readFileSync(join(output, "native-metadata.json"), "utf8")).find(
    (entry) => entry.fixture === fixture,
  );
}

test("FIXTURE_LABEL=omit removes only the capture caption strip", { timeout: 1_200_000 }, () => {
  const labelled = render("capture-view-shots.mjs");
  const omitted = render("capture-view-shots.mjs", "omit");
  const a = pixels(join(labelled, "idle.png"));
  const b = pixels(join(omitted, "idle.png"));
  const rows = differingRows(a, b);
  // The caption sits in the stage's 20-point bottom margin, below the capture view.
  const strip = a.height - 20 * metadata(labelled, "idle").backingScale;
  assert.ok(rows.length > 0, "the unlabelled shot still carries the caption");
  assert.ok(rows[0] >= strip, `pixels changed above the caption strip, from row ${rows[0]}`);
});

test("FIXTURE_LABEL=omit removes only the Library title-bar label", { timeout: 1_200_000 }, () => {
  const labelled = render("library-view-shots.mjs");
  const omitted = render("library-view-shots.mjs", "omit");
  const a = pixels(join(labelled, "recordings.png"));
  const b = pixels(join(omitted, "recordings.png"));
  const rows = differingRows(a, b);
  // The shot is the window frame: its title bar sits above the content.
  const { backingScale, contentHeightPoints } = metadata(labelled, "recordings");
  const titleBar = a.height - contentHeightPoints * backingScale;
  assert.ok(titleBar > 0, "the shot includes the title bar");
  assert.ok(rows.length > 0, "the unlabelled shot still carries the label");
  assert.ok(rows.at(-1) < titleBar, `pixels changed below the title bar, at row ${rows.at(-1)}`);
});
