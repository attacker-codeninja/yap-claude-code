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
            let shell = arguments[3]
            let files = try JSONDecoder().decode([String: String].self, from: Data(input.utf8))
            print(ShellProfile.covered(files: files.filter { ShellProfile.files(shell: shell).contains($0.key) }))
        case "add": print(ShellProfile.adding(to: input), terminator: "")
        case "remove": print(ShellProfile.removing(from: input), terminator: "")
        case "target":
            let existing = Set(arguments[3].split(separator: ",").map(String.init))
            print(ShellProfile.target(shell: input, existing: existing) ?? "none")
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

const call = (name, input = "", extra = "") =>
  execFileSync(driver, [name, input, extra], { encoding: "utf8" });
const covered = (files, shell = "/bin/zsh") =>
  call("covered", JSON.stringify(files), shell).trim() === "true";
const target = (shell, existing = []) => call("target", shell, existing.join(",")).trim();

test("an uncommented PATH .local/bin line in the login shell's own startup files suppresses the block", () => {
  const line = '  path=($HOME/bin $path)\n  export PATH="$HOME/.local/bin:$PATH"\n';
  for (const file of [".zshenv", ".zprofile", ".zshrc"])
    assert.equal(covered({ [file]: line }), true, file);
  for (const file of [".bash_profile", ".bash_login", ".profile", ".bashrc"])
    assert.equal(covered({ [file]: line }, "/bin/bash"), true, file);
});

test("startup files another shell reads do not count", () => {
  const line = 'export PATH="$HOME/.local/bin:$PATH"\n';
  assert.equal(
    covered({ ".bash_profile": line, ".profile": line }),
    false,
    "zsh ignores bash files",
  );
  assert.equal(covered({ ".zshrc": line }, "/bin/bash"), false, "bash ignores zsh files");
  assert.equal(
    covered({ ".zshrc": line, ".profile": line }, "/opt/homebrew/bin/fish"),
    false,
    "fish",
  );
});

test("covered heuristics", () => {
  assert.equal(covered({ ".zshrc": "export PATH=~/.local/bin:$PATH" }), true);
  assert.equal(covered({ ".zshrc": "alias ll='ls -l'\n", ".profile": "" }), false);
  assert.equal(
    covered({ ".zshrc": 'export PATH="$HOME/bin:$PATH"\n' }),
    false,
    "PATH without .local/bin",
  );
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

test("bash edits the login file it already reads, never shadowing ~/.profile", () => {
  assert.equal(target("/bin/bash"), ".bash_profile");
  assert.equal(target("/opt/homebrew/bin/bash", [".profile"]), ".profile");
  assert.equal(target("/bin/bash", [".bash_login", ".profile"]), ".bash_login");
  assert.equal(target("/bin/bash", [".bash_profile", ".profile"]), ".bash_profile");
});

test("zsh targets .zprofile; other shells get no edit", () => {
  assert.equal(target("/bin/zsh"), ".zprofile");
  assert.equal(target(""), ".zprofile");
  assert.equal(target("/opt/homebrew/bin/fish"), "none");
});
