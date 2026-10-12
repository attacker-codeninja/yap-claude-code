import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { compileHomeDriver, makeResources, runHome } from "./fixtures/home-lifecycle.mjs";

const launcher = Buffer.from("#!/bin/sh\n# signed launcher stand-in\nexit 0\n");
let scratch;
let driver;

before(() => {
  scratch = mkdtempSync(join(tmpdir(), "yap-cli-lifecycle-"));
  driver = compileHomeDriver(scratch);
});
after(() => rmSync(scratch, { recursive: true, force: true }));

function setup(name, options) {
  const root = join(scratch, name);
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  return { home, resources: makeResources(root, options), command: join(home, ".local/bin/yap") };
}

test("install writes fresh bytes without quarantine", () => {
  const paths = setup("fresh", { launcher });
  // The bundled launcher of a downloaded app carries quarantine; the installed command must not.
  execFileSync("xattr", ["-w", "com.apple.quarantine", "0081;00000000;Safari;", join(paths.resources, "bin/yap")]);
  const [before, installed] = runHome(driver, paths, "cli.status", "cli.install");
  assert.deepEqual(before, { onPath: false, path: paths.command, state: "missing" });
  assert.equal(installed.state, "installed");
  assert.deepEqual(readFileSync(paths.command), launcher);
  assert.equal(statSync(paths.command).mode & 0o777, 0o755);
  // macOS may attach com.apple.provenance to any file a process writes; only quarantine blocks.
  assert.doesNotMatch(execFileSync("xattr", [paths.command], { encoding: "utf8" }), /com\.apple\.quarantine/);
  assert.deepEqual(readdirSync(join(paths.home, ".local/bin")), ["yap"]);
});

test("install replaces a different file", () => {
  const paths = setup("different", { launcher });
  mkdirSync(join(paths.home, ".local/bin"), { recursive: true });
  writeFileSync(paths.command, "#!/bin/sh\necho personal\n", { mode: 0o644 });
  writeFileSync(join(paths.home, ".zshrc"), 'export PATH="$HOME/.local/bin:$PATH"\n');
  const [before, installed] = runHome(driver, paths, "cli.status", "cli.install");
  assert.equal(before.state, "different");
  assert.deepEqual(installed, { onPath: true, path: paths.command, state: "installed" });
  assert.deepEqual(readFileSync(paths.command), launcher);
  assert.equal(statSync(paths.command).mode & 0o777, 0o755);
  // Already covered by the person's own startup file, so no profile is edited.
  assert.equal(existsSync(join(paths.home, ".zprofile")), false);
  assert.equal(readFileSync(join(paths.home, ".zshrc"), "utf8"), 'export PATH="$HOME/.local/bin:$PATH"\n');
});

test("uninstall keeps a modified command", () => {
  const paths = setup("modified", { launcher });
  const profile = join(paths.home, ".zprofile");
  writeFileSync(profile, "export EDITOR=vim\n");
  const [installed, removed] = runHome(driver, paths, "cli.install", "cli.uninstall");
  assert.equal(installed.profile, profile);
  assert.equal(removed.state, "missing");
  assert.equal(existsSync(paths.command), false, "an identical command is removed");
  assert.equal(readFileSync(profile, "utf8"), "export EDITOR=vim\n", "only the marked block is removed");

  runHome(driver, paths, "cli.install");
  writeFileSync(paths.command, "#!/bin/sh\necho edited\n");
  const [kept] = runHome(driver, paths, "cli.uninstall");
  assert.equal(kept.state, "different");
  assert.equal(readFileSync(paths.command, "utf8"), "#!/bin/sh\necho edited\n");
});

test("status is unavailable without a bundled launcher", () => {
  const paths = setup("unavailable");
  mkdirSync(join(paths.home, ".local/bin"), { recursive: true });
  writeFileSync(paths.command, "#!/bin/sh\necho personal build\n");
  const answers = runHome(driver, paths, "cli.status", "cli.install", "cli.uninstall");
  for (const answer of answers) assert.equal(answer.state, "unavailable");
  assert.equal(readFileSync(paths.command, "utf8"), "#!/bin/sh\necho personal build\n");
  assert.equal(existsSync(join(paths.home, ".zprofile")), false);
});
