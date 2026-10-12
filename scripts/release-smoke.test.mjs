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

// A relocatable release: the kit holds Yap.app and its receipt; every executable that the
// smoke must not run is a trap that records its execution.
const withRelease = (body) => {
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
    for (const script of ["release-smoke.mjs", "release-kit.mjs"])
      copyFileSync(new URL(script, import.meta.url), join(scratch, "scripts", script));
    const forbidden = join(scratch, "forbidden-execution");
    const trap = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(forbidden)},'forbidden');process.exit(79);\n`;
    const kit = join(scratch, "kit");
    const app = join(kit, "Yap.app");
    writeFileSync(join(app, "Contents/MacOS/Yap"), trap, { mode: 0o755 });
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
    const refused = join(scratch, "codesign-refuses");
    // Records each verification; refuses a path ending in the suffix written to `refused`.
    writeFileSync(
      join(scratch, "bin/codesign"),
      `#!/bin/sh\necho "$@" >> '${verified}'\nfor arg; do last="$arg"; done\nif [ -f '${refused}' ]; then case "$last" in *"$(cat '${refused}')") echo "$last: invalid signature" >&2; exit 1;; esac; fi\n`,
      { mode: 0o755 },
    );
    const release = join(scratch, "dist/release");
    const receipt = JSON.stringify({
      tag: "v0.1.3",
      version: "0.1.3",
      nodeVersion: process.versions.node,
      updateArchive: { name: "update.zip" },
    });
    writeFileSync(join(release, "release.json"), receipt);
    writeFileSync(join(kit, "release.json"), receipt);
    writeFileSync(
      join(release, "SHA256SUMS"),
      `${"0".repeat(64)}  Yap-macos-arm64.zip\n${"0".repeat(64)}  release.json\n`,
    );
    const updateApp = join(scratch, "update/Yap.app");
    // Packages the kit and an update archive holding the same app (or a mutated copy).
    const pack = (mutateUpdate = () => {}) => {
      rmSync(join(release, "Yap-macos-arm64.zip"), { force: true });
      execFileSync("ditto", ["-c", "-k", kit, join(release, "Yap-macos-arm64.zip")]);
      rmSync(join(scratch, "update"), { recursive: true, force: true });
      execFileSync("ditto", [app, updateApp]);
      mutateUpdate(updateApp);
      rmSync(join(release, "update.zip"), { force: true });
      execFileSync("ditto", ["-c", "-k", "--keepParent", updateApp, join(release, "update.zip")]);
    };
    const run = () => {
      rmSync(verified, { force: true });
      const result = spawnSync(process.execPath, [join(scratch, "scripts/release-smoke.mjs")], {
        env: { ...process.env, PATH: join(scratch, "bin") + ":" + process.env.PATH },
        encoding: "utf8",
        timeout: 5000,
      });
      assert.equal(existsSync(forbidden), false, "The smoke must not execute the host or launcher");
      return result;
    };
    const verifications = () => readFileSync(verified, "utf8");
    body({ kit, app, bundledLauncher, trap, refused, pack, run, verifications });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

test("kit holds only the app and its receipt", () => {
  withRelease(({ kit, trap, pack, run }) => {
    pack();
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    for (const extra of ["yap", "README.txt"]) {
      writeFileSync(join(kit, extra), trap, { mode: 0o755 });
      pack();
      const broken = run();
      assert.equal(broken.status, 1, broken.stdout + broken.stderr);
      assert.match(broken.stderr, /only Yap\.app and release\.json/);
      unlinkSync(join(kit, extra));
    }
  });
});

test("bundled launcher verifies", () => {
  withRelease(({ bundledLauncher, trap, refused, pack, run, verifications }) => {
    pack();
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.match(
      verifications(),
      /^--verify --strict .*\/Relocated release\/Yap\.app\/Contents\/Resources\/bin\/yap$/m,
    );

    writeFileSync(refused, "/Yap.app/Contents/Resources/bin/yap");
    const unsigned = run();
    assert.equal(unsigned.status, 1, unsigned.stdout + unsigned.stderr);
    assert.match(unsigned.stderr, /invalid signature/);
    rmSync(refused);

    unlinkSync(bundledLauncher);
    pack();
    const missing = run();
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.match(missing.stderr, /bundled launcher/);
    writeFileSync(bundledLauncher, trap, { mode: 0o755 });
  });
});

test("archive smoke avoids production host/launcher execution and rejects changed trees or stale CLI versions", () => {
  withRelease(({ app, pack, run }) => {
    pack();
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    for (const mutation of ["bytes", "mode", "link"]) {
      pack((updateApp) => {
        if (mutation === "bytes")
          writeFileSync(join(updateApp, "Contents/Resources/cli/main.mjs"), "changed");
        if (mutation === "mode") chmodSync(join(updateApp, "Contents/MacOS/Yap"), 0o644);
        if (mutation === "link") {
          unlinkSync(join(updateApp, "Contents/Resources/alias"));
          symlinkSync("node/bin/node", join(updateApp, "Contents/Resources/alias"));
        }
      });
      const changed = run();
      assert.equal(changed.status, 1, changed.stdout + changed.stderr);
      assert.match(changed.stderr, /same files, modes and links/);
    }
    writeFileSync(
      join(app, "Contents/Resources/cli/main.mjs"),
      `console.log(JSON.stringify({name:'yap',version:'0.0.0',operations:[{name:'edit.apply'}]}));\n`,
    );
    pack();
    const stale = run();
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stderr, /CLI version must match the release receipt/);
  });
});
