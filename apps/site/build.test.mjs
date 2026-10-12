import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "./build.mjs";
import { agentPrompt } from "./content.mjs";

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const siteUrl = "https://yap.example";

function built(options = {}) {
  const out = mkdtempSync(join(tmpdir(), "yap-site-"));
  build({ out, siteUrl, readme, ...options });
  return (name) => readFileSync(join(out, name), "utf8");
}

test("humans and agents are handed the same install prompt", () => {
  const file = built();
  assert.ok(file("index.html").includes(agentPrompt), "page shows the prompt");
  assert.ok(file("llms.txt").includes(agentPrompt), "llms.txt carries the prompt");
});

test("the agent view on the page is the llms.txt text", () => {
  const file = built();
  const escaped = file("llms.txt")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  assert.ok(file("index.html").includes(escaped));
});

test("the build refuses a prompt that has drifted from the README", () => {
  assert.throws(() => built({ readme: readme.replaceAll("yap CLI", "yap tool") }), /README/);
});

test("the one indexed page is sitemapped, allowed and canonical at the production origin", () => {
  const file = built();
  assert.match(file("sitemap.xml"), /<loc>https:\/\/yap\.example\/<\/loc>/);
  assert.match(file("robots.txt"), /Allow: \//);
  assert.match(file("robots.txt"), /Sitemap: https:\/\/yap\.example\/sitemap\.xml/);
  assert.match(file("index.html"), /<link rel="canonical" href="https:\/\/yap\.example\/">/);
  assert.doesNotMatch(file("index.html"), /noindex/);
});
