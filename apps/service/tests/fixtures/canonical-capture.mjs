import { execFileSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Writes a settled capture source into `directory`: the archived canonical narration and its
 * journal, with picture from the shared corpus. The archived receipt was published under the
 * capture hash salts that 8257046c renamed; the beside-file receipt carries the same media
 * facts hashed under the current salts, so native verification admits it. */
export async function writeCanonicalCapture(directory) {
  execFileSync("tar", [
    "-xzf",
    resolve("specs/done/agent-editing/assets/20d-canonical-admission/evidence.tar.gz"),
    "-C",
    directory,
    "--strip-components=1",
    "canonical-input",
  ]);
  await copyFile(
    new URL("./canonical-narration.publication.json", import.meta.url),
    join(directory, "narration.publication.json"),
  );
  await copyFile(
    resolve("specs/done/agent-editing/assets/00-corpus/video-only.mov"),
    join(directory, "video.mov"),
  );
}
