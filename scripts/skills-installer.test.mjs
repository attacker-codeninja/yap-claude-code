import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { bundleSkillsInstaller } from "./skills-installer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the bundled skill installer lists and installs a local skill globally with no host tools", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-skills-installer-"));
  try {
    const installer = join(bundleSkillsInstaller(root, join(scratch, "Resources")), "cli.mjs");
    assert.ok(existsSync(join(dirname(installer), "THIRD-PARTY-LICENSES.md")));
    const home = join(scratch, "home");
    const work = join(scratch, "work");
    const shims = join(scratch, "shims");
    const shellOuts = join(scratch, "shell-outs.log");
    for (const path of [home, work, shims]) mkdirSync(path);
    // Any attempt to reach a package manager or VCS is recorded and fails.
    for (const tool of ["git", "gh", "npm", "npx", "pnpm", "bun", "curl"]) {
      writeFileSync(join(shims, tool), `#!/bin/sh\necho "${tool} $*" >> '${shellOuts}'\nexit 1\n`);
      chmodSync(join(shims, tool), 0o755);
    }
    const skill = join(scratch, "skill");
    mkdirSync(skill);
    writeFileSync(
      join(skill, "SKILL.md"),
      "---\nname: yap\ndescription: Fixture skill.\n---\n\nBody.\n",
    );
    const env = { HOME: home, PATH: `${shims}:/usr/bin:/bin`, TMPDIR: tmpdir() };
    const installerRun = (...args) =>
      spawnSync(process.execPath, [installer, ...args], {
        cwd: work,
        env,
        encoding: "utf8",
        timeout: 30000,
      });
    const listed = () => {
      const result = installerRun("ls", "--global", "--json");
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout).map(({ name, path }) => ({ name, path }));
    };

    const help = installerRun("--help");
    assert.equal(help.status, 0, help.stderr);
    assert.deepEqual(listed(), []);
    const added = installerRun("add", skill, "--all", "--global", "--yes");
    assert.equal(added.status, 0, added.stdout + added.stderr);
    assert.deepEqual(listed(), [{ name: "yap", path: join(home, ".agents/skills/yap") }]);
    assert.equal(
      readFileSync(join(home, ".agents/skills/yap/SKILL.md"), "utf8"),
      readFileSync(join(skill, "SKILL.md"), "utf8"),
    );
    assert.equal(
      existsSync(shellOuts),
      false,
      existsSync(shellOuts) && readFileSync(shellOuts, "utf8"),
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
