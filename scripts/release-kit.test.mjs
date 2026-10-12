import assert from "node:assert/strict";
import { test } from "node:test";
import { kitName } from "./release-kit.mjs";

const sum = "0".repeat(64);

test("the install kit is the one ZIP that SHA256SUMS names, fixed or versioned", () => {
  assert.equal(
    kitName(`${sum}  Yap-macos-arm64.zip\n${sum}  release.json\n`),
    "Yap-macos-arm64.zip",
  );
  assert.equal(
    kitName(`${sum}  Yap-v0.1.28-macos-arm64.zip\n${sum}  release.json`),
    "Yap-v0.1.28-macos-arm64.zip",
  );
});

test("checksums naming no ZIP or several are refused", () => {
  assert.throws(() => kitName(`${sum}  release.json\n`), /exactly one/);
  assert.throws(() => kitName(`${sum}  a.zip\n${sum}  b.zip\n`), /exactly one/);
});
