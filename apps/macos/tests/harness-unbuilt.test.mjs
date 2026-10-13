import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporary } from "./harness.mjs";

/**
 * Launching before `dist/Yap.app` is built is a usage error, and it must read as one. Spawning
 * the missing executable instead fails with ENOENT, which node:test reports only as an opaque
 * exit 7. The harness runs from a copy laid out where no app is built, so this holds whether or
 * not this checkout has a build.
 */
test("launching without a built app names the missing build", () => {
  const root = temporary("/tmp/scr-unbuilt-");
  const tests = join(root, "apps", "macos", "tests");
  mkdirSync(tests, { recursive: true });
  copyFileSync(join(import.meta.dirname, "harness.mjs"), join(tests, "harness.mjs"));
  const script = join(tests, "run.mjs");
  writeFileSync(
    script,
    'import { launch, temporary } from "./harness.mjs";\n' +
      'launch(temporary("/tmp/scr-unbuilt-home-"));\n',
  );

  const run = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 30_000 });

  assert.notEqual(run.status, 0, "a launch without an app must fail");
  assert.match(run.stderr, /Build dist\/Yap\.app first/);
  assert.ok(run.stderr.includes(join(realpathSync(root), "dist", "Yap.app")), run.stderr);
  assert.doesNotMatch(run.stderr, /ENOENT/);
});
