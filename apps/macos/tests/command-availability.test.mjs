import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { app, finderEnvironment, launchReady, setDefault, temporary, waitFor } from "./harness.mjs";

/**
 * `yap` is available the moment Yap is: right after the app starts, and right after install when
 * nothing is running yet. Promptness is the CLI's own contract — discovery gives the service a
 * bounded time to answer and otherwise fails the command — so "available" means every command
 * succeeds on its first try, with no retry and no extra waiting by the caller.
 */
// The harness names the executable; discovery and the CLI need its bundle.
const bundle = resolve(app, "../../..");
const cli = join(bundle, "Contents/Resources/cli/main.mjs");

function yap(home, defaults, operation) {
  const result = spawnSync(process.execPath, [cli, operation, "--params", "{}"], {
    cwd: "/",
    env: { ...finderEnvironment, YAP_APP: bundle, YAP_HOME: home, YAP_DEFAULTS: defaults },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `${operation}: ${result.stdout}${result.stderr}`);
  const answer = JSON.parse(result.stdout);
  assert.equal(answer.ok, true, `${operation}: ${result.stdout}`);
  return answer.data;
}

function scratchDefaults(home) {
  const defaults = join(home, "preferences");
  setDefault(defaults, "showSettingsAtLaunch", "-bool", "NO");
  // The app runs with this person's real HOME; agent setup would rewrite their command and skill.
  setDefault(defaults, "setUpAgents", "-bool", "NO");
  return defaults;
}

/** Every command over a stretch of startup work, not just one lucky call, answers first time. */
function keepsAnswering(home, defaults, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let calls = 0;
  do {
    assert.equal(yap(home, defaults, "service.health").status, "ready");
    yap(home, defaults, "capture.status");
    calls += 2;
  } while (Date.now() < deadline);
  return calls;
}

test("yap answers on its first try right after the app starts", { timeout: 180_000 }, async () => {
  const home = temporary("/tmp/yap-available-");
  const defaults = scratchDefaults(home);
  const { instance } = await launchReady(home, { YAP_DEFAULTS: defaults });
  try {
    assert.ok(keepsAnswering(home, defaults, 10) > 0);
  } finally {
    await instance.reap();
  }
});

test(
  "the first yap command after install starts Yap and answers on its first try",
  { timeout: 180_000 },
  async () => {
    const home = temporary("/tmp/yap-installed-");
    const defaults = scratchDefaults(home);
    // Nothing is running for this home: discovery must launch the app and wait for it itself.
    const health = yap(home, defaults, "service.health");
    const appPid = Number(
      execFileSync("ps", ["-o", "ppid=", "-p", String(health.pid)], { encoding: "utf8" }).trim(),
    );
    try {
      assert.equal(health.status, "ready");
      assert.ok(keepsAnswering(home, defaults, 10) > 0);
    } finally {
      process.kill(appPid, "SIGTERM");
      await waitFor(() => {
        try {
          process.kill(appPid, 0);
          return false;
        } catch {
          return true;
        }
      }, 30_000);
    }
  },
);
