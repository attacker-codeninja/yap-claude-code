import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const source = new URL("../Sources/Yap/ShellProfile.swift", import.meta.url).pathname;
const block = '# >>> yap >>>\nexport PATH="$HOME/.local/bin:$PATH"\n# <<< yap <<<\n';
let scratch;
let driver;

before(() => {
  scratch = mkdtempSync(join(tmpdir(), "yap-shell-profile-"));
  const main = join(scratch, "Driver.swift");
  // Each call names one pure function; file contents arrive as JSON so whitespace survives.
  writeFileSync(
    main,
    String.raw`import Foundation
@main struct Driver {
    static func main() throws {
        let arguments = CommandLine.arguments
        let input = arguments.count > 2 ? arguments[2] : ""
        switch arguments[1] {
        case "covered":
            let files = try JSONDecoder().decode([String: String].self, from: Data(input.utf8))
            print(ShellProfile.covered(files: files))
        case "add": print(ShellProfile.adding(to: input), terminator: "")
        case "remove": print(ShellProfile.removing(from: input), terminator: "")
        case "target": print(ShellProfile.target(shell: input))
        default: fatalError("unknown call")
        }
    }
}
`,
  );
  driver = join(scratch, "driver");
  execFileSync("swiftc", ["-swift-version", "6", "-parse-as-library", source, main, "-o", driver], {
    stdio: "pipe",
    timeout: 120_000,
  });
});
after(() => rmSync(scratch, { recursive: true, force: true }));

const call = (name, input = "") => execFileSync(driver, [name, input], { encoding: "utf8" });
const covered = (files) => call("covered", JSON.stringify(files)).trim() === "true";

test("an uncommented PATH .local/bin line in any startup file suppresses the block", () => {
  for (const file of [".zshenv", ".zprofile", ".zshrc", ".bash_profile", ".bashrc", ".profile"]) {
    assert.equal(covered({ [file]: '  path=($HOME/bin $path)\n  export PATH="$HOME/.local/bin:$PATH"\n' }), true, file);
  }
  assert.equal(covered({ ".zshrc": "export PATH=~/.local/bin:$PATH" }), true);
  assert.equal(covered({ ".zshrc": "alias ll='ls -l'\n", ".profile": "" }), false);
  assert.equal(covered({ ".zshrc": 'export PATH="$HOME/bin:$PATH"\n' }), false, "PATH without .local/bin");
  assert.equal(covered({}), false);
});

test("a commented line does not count", () => {
  assert.equal(covered({ ".zprofile": '# export PATH="$HOME/.local/bin:$PATH"\n' }), false);
  assert.equal(covered({ ".zprofile": '   #export PATH="$HOME/.local/bin:$PATH"\n' }), false);
});

test("add is idempotent", () => {
  assert.equal(call("add", ""), block);
  const once = call("add", "export EDITOR=vim\n");
  assert.equal(once, `export EDITOR=vim\n${block}`);
  assert.equal(call("add", once), once);
  assert.equal(call("add", "export EDITOR=vim"), `export EDITOR=vim\n${block}`);
});

test("remove deletes exactly the block", () => {
  const before = "export EDITOR=vim\n";
  const after = "alias ll='ls -l'\n";
  assert.equal(call("remove", `${before}${block}${after}`), `${before}${after}`);
  assert.equal(call("remove", call("add", before)), before);
  // A person's own lines that merely resemble the block stay.
  const own = 'export PATH="$HOME/.local/bin:$PATH"\n# <<< yap <<<\n';
  assert.equal(call("remove", own), own);
});

test("bash targets .bash_profile", () => {
  assert.equal(call("target", "/bin/bash").trim(), ".bash_profile");
  assert.equal(call("target", "/opt/homebrew/bin/bash").trim(), ".bash_profile");
  assert.equal(call("target", "/bin/zsh").trim(), ".zprofile");
  assert.equal(call("target", "/opt/homebrew/bin/fish").trim(), ".zprofile");
  assert.equal(call("target", "").trim(), ".zprofile");
});
