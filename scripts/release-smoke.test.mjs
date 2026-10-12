import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  chmodSync,
  unlinkSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("archive smoke avoids production host/launcher execution and rejects changed trees or stale CLI versions", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-smoke-contract-"));
  try {
    for (const path of [
      "scripts",
      "dist/release",
      "bin",
      "kit/Yap.app/Contents/MacOS",
      "kit/Yap.app/Contents/Resources/node/bin",
      "kit/Yap.app/Contents/Resources/cli",
      "kit/Yap.app/Contents/Resources/bin",
    ])
      mkdirSync(join(scratch, path), { recursive: true });
    copyFileSync(
      new URL("release-smoke.mjs", import.meta.url),
      join(scratch, "scripts/release-smoke.mjs"),
    );
    const forbidden = join(scratch, "forbidden-execution");
    const trap = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(forbidden)},'forbidden');process.exit(79);\n`;
    const app = join(scratch, "kit/Yap.app");
    writeFileSync(join(app, "Contents/MacOS/Yap"), trap, { mode: 0o755 });
    writeFileSync(join(scratch, "kit/yap"), trap, { mode: 0o755 });
    const bundledLauncher = join(app, "Contents/Resources/bin/yap");
    writeFileSync(bundledLauncher, trap, { mode: 0o755 });
    writeFileSync(
      join(app, "Contents/MacOS/yap-native"),
      `#!${process.execPath}\nconsole.log(JSON.stringify({id:'release-smoke',ok:true,data:{platform:'macos'}}));\n`,
      { mode: 0o755 },
    );
    symlinkSync(process.execPath, join(app, "Contents/Resources/node/bin/node"));
    writeFileSync(
      join(app, "Contents/Resources/cli/main.mjs"),
      `console.log(JSON.stringify(process.argv.includes('--version') ? {name:'yap',version:'0.1.3'} : {version:'0.1.3',operations:[{name:'edit.apply'}]}));\n`,
    );
    symlinkSync("cli/main.mjs", join(app, "Contents/Resources/alias"));
    const verified = join(scratch, "codesign.log");
    writeFileSync(join(scratch, "bin/codesign"), `#!/bin/sh\necho "$@" >> '${verified}'\n`, {
      mode: 0o755,
    });
    const release = join(scratch, "dist/release");
    writeFileSync(
      join(release, "release.json"),
      JSON.stringify({
        tag: "v0.1.3",
        version: "0.1.3",
        nodeVersion: process.versions.node,
        updateArchive: { name: "update.zip" },
      }),
    );
    writeFileSync(
      join(release, "SHA256SUMS"),
      `${"0".repeat(64)}  Yap-macos-arm64.zip\n${"0".repeat(64)}  release.json\n`,
    );
    execFileSync("ditto", ["-c", "-k", join(scratch, "kit"), join(release, "Yap-macos-arm64.zip")]);
    const updateApp = join(scratch, "update/Yap.app");
    const packageUpdate = () =>
      execFileSync("ditto", ["-c", "-k", "--keepParent", updateApp, join(release, "update.zip")]);
    const run = () =>
      spawnSync(process.execPath, [join(scratch, "scripts/release-smoke.mjs")], {
        env: { ...process.env, PATH: join(scratch, "bin") + ":" + process.env.PATH },
        encoding: "utf8",
        timeout: 5000,
      });
    execFileSync("ditto", [app, updateApp]);
    packageUpdate();
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.equal(existsSync(forbidden), false);
    assert.match(
      readFileSync(verified, "utf8"),
      /^--verify --strict .*\/Relocated release\/Yap\.app\/Contents\/Resources\/bin\/yap$/m,
    );
    const packageKit = () =>
      execFileSync("ditto", [
        "-c",
        "-k",
        join(scratch, "kit"),
        join(release, "Yap-macos-arm64.zip"),
      ]);
    for (const [mutation, message] of [
      ["missing", /bundled launcher/],
      ["different", /identical to the bundled launcher/],
    ]) {
      if (mutation === "missing") unlinkSync(bundledLauncher);
      else writeFileSync(bundledLauncher, trap + "// changed\n", { mode: 0o755 });
      packageKit();
      rmSync(join(scratch, "update"), { recursive: true });
      execFileSync("ditto", [app, updateApp]);
      packageUpdate();
      const broken = run();
      assert.equal(broken.status, 1, broken.stdout + broken.stderr);
      assert.match(broken.stderr, message);
    }
    writeFileSync(bundledLauncher, trap, { mode: 0o755 });
    packageKit();
    for (const mutation of ["bytes", "mode", "link"]) {
      rmSync(join(scratch, "update"), { recursive: true });
      execFileSync("ditto", [app, updateApp]);
      if (mutation === "bytes")
        writeFileSync(join(updateApp, "Contents/Resources/cli/main.mjs"), "changed");
      if (mutation === "mode") chmodSync(join(updateApp, "Contents/MacOS/Yap"), 0o644);
      if (mutation === "link") {
        unlinkSync(join(updateApp, "Contents/Resources/alias"));
        symlinkSync("node/bin/node", join(updateApp, "Contents/Resources/alias"));
      }
      packageUpdate();
      const changed = run();
      assert.equal(changed.status, 1, changed.stdout + changed.stderr);
      assert.match(changed.stderr, /same files, modes and links/);
      assert.equal(existsSync(forbidden), false);
    }
    writeFileSync(
      join(app, "Contents/Resources/cli/main.mjs"),
      `console.log(JSON.stringify({name:'yap',version:'0.0.0',operations:[{name:'edit.apply'}]}));\n`,
    );
    execFileSync("ditto", ["-c", "-k", join(scratch, "kit"), join(release, "Yap-macos-arm64.zip")]);
    rmSync(join(scratch, "update"), { recursive: true });
    execFileSync("ditto", [app, updateApp]);
    packageUpdate();
    const stale = run();
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stderr, /CLI version must match the release receipt/);
    assert.equal(existsSync(forbidden), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
