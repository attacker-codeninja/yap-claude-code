import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { after, before, test } from "node:test";

const source = new URL("../Sources/Yap/LaunchDecision.swift", import.meta.url).pathname;
let scratch;
let executable;

// The stub reads one launch as JSON and prints the decision, so each case asserts on the
// decision a caller would act on.
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "yap-launch-decision-"));
  const stub = join(scratch, "Stub.swift");
  writeFileSync(
    stub,
    `import Foundation
struct Launch: Decodable {
  let bundle: String; let home: String; let isRelease: Bool; let arguments: [String]
  let running: [Int32]; let translocated: String?; let original: String?
}
@main struct Check {
  static func main() throws {
    let launch = try JSONDecoder().decode(Launch.self, from: Data(CommandLine.arguments[1].utf8))
    let translocation: Translocation = launch.translocated == nil ? .notTranslocated
      : launch.original.map { .resolved(URL(fileURLWithPath: $0)) } ?? .unresolved
    let decision = LaunchDecision.decide(
      bundle: URL(fileURLWithPath: launch.bundle), home: URL(fileURLWithPath: launch.home),
      isRelease: launch.isRelease, arguments: launch.arguments,
      running: launch.running.map { RunningCopy(pid: $0, bundleURL: URL(fileURLWithPath: "/Applications/Yap.app")) },
      translocation: translocation)
    switch decision {
    case .proceed: print("proceed")
    case .offerMove(let original): print("offerMove \\(original?.path ?? "nil")")
    case .handOff(let pid): print("handOff \\(pid)")
    }
    if CommandLine.arguments.count > 2 {
      let state = Translocation.of(URL(fileURLWithPath: CommandLine.arguments[2]))
      print("translocation \\(state)")
    }
  }
}
`,
  );
  executable = join(scratch, "check");
  execFileSync(
    "swiftc",
    ["-swift-version", "6", "-parse-as-library", source, stub, "-o", executable],
    { stdio: "pipe" },
  );
});

after(() => rmSync(scratch, { recursive: true, force: true }));

function decide(launch, ...extra) {
  const full = {
    home: "/Users/someone",
    isRelease: true,
    arguments: [],
    running: [],
    translocated: null,
    original: null,
    ...launch,
  };
  return execFileSync(executable, [JSON.stringify(full), ...extra], { encoding: "utf8" }).trim();
}

test("dev build anywhere proceeds", () => {
  assert.equal(decide({ bundle: "/Users/someone/Downloads/Yap.app", isRelease: false }), "proceed");
  assert.equal(decide({ bundle: "/private/tmp/build/Yap.app", isRelease: false }), "proceed");
});

test("both Applications folders proceed", () => {
  assert.equal(decide({ bundle: "/Applications/Yap.app" }), "proceed");
  assert.equal(decide({ bundle: "/Users/someone/Applications/Yap.app" }), "proceed");
  // A nested folder is not an Applications folder.
  assert.equal(
    decide({ bundle: "/Applications/Tools/Yap.app" }),
    "offerMove /Applications/Tools/Yap.app",
  );
});

test("Downloads offers a move", () => {
  assert.equal(
    decide({ bundle: "/Users/someone/Downloads/Yap.app" }),
    "offerMove /Users/someone/Downloads/Yap.app",
  );
});

test("translocated offers a move of the original", () => {
  const mount = "/private/var/folders/xy/T/AppTranslocation/ABC/d/Yap.app";
  assert.equal(
    decide({ bundle: mount, translocated: mount, original: "/Users/someone/Downloads/Yap.app" }),
    "offerMove /Users/someone/Downloads/Yap.app",
  );
  // Without the original there is nothing to move; the caller can only offer Quit.
  assert.equal(decide({ bundle: mount, translocated: mount }), "offerMove nil");
  // A translocated launch whose original already sits in Applications is in place.
  assert.equal(
    decide({ bundle: mount, translocated: mount, original: "/Applications/Yap.app" }),
    "proceed",
  );
});

test("second copy hands off", () => {
  assert.equal(decide({ bundle: "/Applications/Yap.app", running: [4242] }), "handOff 4242");
  // A running copy wins over the move offer: moving would trash the live install it runs from.
  assert.equal(
    decide({ bundle: "/Users/someone/Downloads/Yap.app", running: [4242] }),
    "handOff 4242",
  );
});

test("dev builds never hand off, so test runs work beside an installed Yap", () => {
  assert.equal(
    decide({ bundle: "/private/tmp/build/Yap.app", isRelease: false, running: [77] }),
    "proceed",
  );
});

test("update relaunch never hands off", () => {
  const relaunch = ["/Applications/Yap.app/Contents/MacOS/Yap", "--yap-update-relaunch"];
  assert.equal(
    decide({ bundle: "/Applications/Yap.app", arguments: relaunch, running: [4242] }),
    "proceed",
  );
  assert.equal(
    decide({ bundle: "/Users/someone/Downloads/Yap.app", arguments: relaunch }),
    "proceed",
  );
});

test("`~` is $HOME", () => {
  const root = realpathSync(scratch);
  const home = join(root, "home");
  mkdirSync(join(home, "Applications"), { recursive: true });
  assert.equal(decide({ bundle: join(home, "Applications/Yap.app"), home }), "proceed");
  // The account home does not count when $HOME points elsewhere (probe P8).
  const account = join(homedir(), "Applications/Yap.app");
  assert.equal(decide({ bundle: account, home }), `offerMove ${account}`);
  // Symlinks resolve on both sides: a home reached through a link still owns its Applications.
  const link = join(root, "home-link");
  symlinkSync(home, link);
  assert.equal(decide({ bundle: join(home, "Applications/Yap.app"), home: link }), "proceed");
  assert.equal(decide({ bundle: join(link, "Applications/Yap.app"), home }), "proceed");
});

test("an ordinary bundle is not translocated", () => {
  const output = decide({ bundle: "/Applications/Yap.app" }, scratch);
  assert.match(output, /^translocation notTranslocated$/m);
});
