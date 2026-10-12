import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";

const sources = new URL("../Sources/Yap/", import.meta.url).pathname;
let scratch;
let executable;

// The stub runs one move against a recorded fake disk: it prints the plan, every effect in
// the order it ran, the outcome, and what LaunchDecision says about the relaunched copy.
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "yap-app-relocator-"));
  const stub = join(scratch, "Stub.swift");
  writeFileSync(
    stub,
    `import Foundation
struct Move: Decodable {
  let original: String; let ownVersion: String; let home: String
  let installed: [String: String]; let copyFails: Bool; let copyLeavesNothing: Bool
}
final class Disk: @unchecked Sendable {
  var bundles: [String: String]
  var events: [String] = []
  init(_ bundles: [String: String]) { self.bundles = bundles }
}
struct Failure: Error {}
@main struct Check {
  static func main() throws {
    let move = try JSONDecoder().decode(Move.self, from: Data(CommandLine.arguments[1].utf8))
    let disk = Disk(move.installed.merging([move.original: move.ownVersion]) { $1 })
    let relocator = AppRelocator(effects: .init(
      copy: { from, to in
        disk.events.append("copy \\(from.path) -> \\(to.path)")
        if move.copyFails { throw Failure() }
        if !move.copyLeavesNothing { disk.bundles[to.path] = disk.bundles[from.path] }
      },
      trash: { url in disk.events.append("trash \\(url.path)"); disk.bundles[url.path] = nil },
      open: { url in disk.events.append("open \\(url.path)") },
      versionAt: { url in disk.bundles[url.path] },
      exists: { url in disk.bundles[url.path] != nil }))
    let home = URL(fileURLWithPath: move.home)
    let original = URL(fileURLWithPath: move.original)
    let plan = relocator.plan(original: original, ownVersion: move.ownVersion, home: home)
    switch plan {
    case .openInstalled(let url): print("plan openInstalled(\\(url.path))")
    case .replace(let url): print("plan replace(installed: \\(url.path))")
    case .copyHome(let url): print("plan copyHome(\\(url.path))")
    }
    do {
      let relaunched = try relocator.perform(plan, original: original)
      disk.events.forEach { print($0) }
      print("relaunched \\(relaunched.path)")
      let decision = LaunchDecision.decide(bundle: relaunched, home: home, isRelease: true, arguments: [], running: [])
      print("relaunch decides \\(decision)")
    } catch {
      disk.events.forEach { print($0) }
      print("failed")
    }
    print("left \\(disk.bundles.keys.sorted().joined(separator: " "))")
  }
}
`,
  );
  executable = join(scratch, "check");
  execFileSync(
    "swiftc",
    [
      "-swift-version",
      "6",
      "-parse-as-library",
      join(sources, "AppRelocator.swift"),
      join(sources, "LaunchDecision.swift"),
      stub,
      "-o",
      executable,
    ],
    { stdio: "pipe" },
  );
});

after(() => rmSync(scratch, { recursive: true, force: true }));

const home = "/Users/someone";
const downloads = `${home}/Downloads/Yap.app`;
const homeApp = `${home}/Applications/Yap.app`;

function move(options) {
  const full = {
    original: downloads,
    ownVersion: "28",
    home,
    installed: {},
    copyFails: false,
    copyLeavesNothing: false,
    ...options,
  };
  return execFileSync(executable, [JSON.stringify(full)], { encoding: "utf8" })
    .trim()
    .split("\n");
}

test("fresh move copies, relaunches, trashes", () => {
  assert.deepEqual(move({}), [
    `plan copyHome(${homeApp})`,
    `copy ${downloads} -> ${homeApp}`,
    `open ${homeApp}`,
    `trash ${downloads}`,
    `relaunched ${homeApp}`,
    "relaunch decides proceed",
    `left ${homeApp}`,
  ]);
});

test("same-or-newer opens installed", () => {
  for (const [installed, version] of [
    ["/Applications/Yap.app", "28"],
    [homeApp, "28.0"],
    [homeApp, "29"],
    ["/Applications/Yap.app", "28.1"],
  ]) {
    const lines = move({ ownVersion: "28", installed: { [installed]: version } });
    assert.deepEqual(
      lines,
      [
        `plan openInstalled(${installed})`,
        `open ${installed}`,
        `trash ${downloads}`,
        `relaunched ${installed}`,
        "relaunch decides proceed",
        `left ${installed}`,
      ],
      `${installed} at ${version}`,
    );
  }
  // Integers, not strings: 10 is newer than 9.
  assert.equal(
    move({ ownVersion: "9", installed: { [homeApp]: "10" } })[0],
    `plan openInstalled(${homeApp})`,
  );
});

test("older installed is replaced", () => {
  assert.deepEqual(move({ ownVersion: "28", installed: { "/Applications/Yap.app": "27" } }), [
    "plan replace(installed: /Applications/Yap.app)",
    "trash /Applications/Yap.app",
    `copy ${downloads} -> /Applications/Yap.app`,
    "open /Applications/Yap.app",
    `trash ${downloads}`,
    "relaunched /Applications/Yap.app",
    "relaunch decides proceed",
    "left /Applications/Yap.app",
  ]);
  // 9 is older than 10, and a bundle without a readable version counts as older.
  assert.equal(
    move({ ownVersion: "10", installed: { [homeApp]: "9" } })[0],
    `plan replace(installed: ${homeApp})`,
  );
  assert.equal(
    move({ ownVersion: "10", installed: { [homeApp]: "" } })[0],
    `plan replace(installed: ${homeApp})`,
  );
});

test("the copy agents use is the one compared", () => {
  // The launcher looks in $HOME/Applications before /Applications, so that copy decides.
  const both = { [homeApp]: "27", "/Applications/Yap.app": "30" };
  assert.equal(move({ installed: both })[0], `plan replace(installed: ${homeApp})`);
});

test("move never runs twice", () => {
  // Probe P5: the relaunched copy sits in an Applications folder, so its own launch proceeds
  // instead of offering another move, whatever the plan was.
  for (const installed of [{}, { [homeApp]: "30" }, { "/Applications/Yap.app": "27" }]) {
    assert.ok(move({ installed }).includes("relaunch decides proceed"), JSON.stringify(installed));
  }
});

test("never trashes before the copy exists", () => {
  assert.deepEqual(move({ copyFails: true }), [
    `plan copyHome(${homeApp})`,
    `copy ${downloads} -> ${homeApp}`,
    "failed",
    `left ${downloads}`,
  ]);
  // A copy that reports success but left nothing behind is a failure too.
  assert.deepEqual(move({ copyLeavesNothing: true }), [
    `plan copyHome(${homeApp})`,
    `copy ${downloads} -> ${homeApp}`,
    "failed",
    `left ${downloads}`,
  ]);
});
