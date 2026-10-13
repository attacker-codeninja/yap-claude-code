import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Output by default: a refusal is legitimate only for malformed or ambiguous input, conflicts,
// resource bounds, missing prerequisites, destructive actions or execution failures. Every code
// literal in product source is classified here so a new quality gate cannot appear unnoticed.
// UPDATE_REFUSAL_LEDGER=1 refreshes per-file counts; new codes still need a category by hand.

const root = join(import.meta.dirname, "../../..");
const ledgerPath = join(import.meta.dirname, "refusal-ledger.json");
const sourceRoots = [
  ...["packages", "apps"].flatMap((parent) =>
    readdirSync(join(root, parent)).map((name) => join(parent, name, "src")).filter((dir) => exists(dir)),
  ),
  "helpers/mac/Sources",
  "skills/yap/scripts",
];
const refusalCategories = new Set([
  "malformed",
  "ambiguous",
  "conflict",
  "resource-bound",
  "missing-prerequisite",
  "destructive",
  "execution-failure",
]);
const categories = new Set([...refusalCategories, "issue-code", "not-a-refusal", "pending-conversion"]);
const gateWords = /UNMET|FEASIBLE|DISAGREEMENT|TOLERANCE|THRESHOLD|QUALITY/;

type Ledger = {
  rules: string;
  pendingConversion: Record<string, string>;
  pendingSites: { slice: string; file: string; text: string; why: string }[];
  refusedStatus: { allowed: Record<string, string>; pending: Record<string, string> };
  messageCodes: { pending: Record<string, string> };
  codes: Record<string, { category: string | null; files: Record<string, number> }>;
};

function exists(dir: string) {
  try {
    return statSync(join(root, dir)).isDirectory();
  } catch {
    return false;
  }
}

function productFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|swift|mjs)$/.test(name) && !/\.(test|fixture)\./.test(name)) out.push(relative(root, path));
    }
  };
  for (const dir of sourceRoots) walk(join(root, dir));
  return out.sort();
}

const files = productFiles();
const text = new Map(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));

function scan() {
  const codes = new Map<string, Record<string, number>>();
  for (const [file, source] of text) {
    for (const [, code] of source.matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g)) {
      const perFile = codes.get(code!) ?? {};
      perFile[file] = (perFile[file] ?? 0) + 1;
      codes.set(code!, perFile);
    }
  }
  return codes;
}

const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as Ledger;
const scanned = scan();

if (process.env.UPDATE_REFUSAL_LEDGER === "1") {
  const codes: Ledger["codes"] = {};
  for (const code of [...scanned.keys()].sort()) {
    codes[code] = { category: ledger.codes[code]?.category ?? null, files: Object.fromEntries(Object.entries(scanned.get(code)!).sort()) };
  }
  writeFileSync(ledgerPath, `${JSON.stringify({ ...ledger, codes }, null, 1)}\n`);
  Object.assign(ledger, { codes });
}

describe("refusal ledger", () => {
  it("classifies every code literal in product source with exact per-file counts", () => {
    const actual = Object.fromEntries([...scanned].map(([code, perFile]) => [code, Object.fromEntries(Object.entries(perFile).sort())]));
    const recorded = Object.fromEntries(Object.entries(ledger.codes).map(([code, entry]) => [code, entry.files]));
    expect(actual).toEqual(recorded);
    const unclassified = Object.entries(ledger.codes).filter(([, entry]) => !entry.category || !categories.has(entry.category));
    expect(unclassified.map(([code]) => code)).toEqual([]);
  });

  it("never names a quality gate as a refusal", () => {
    const gates = Object.entries(ledger.codes)
      .filter(([code, entry]) => gateWords.test(code) && entry.category !== "pending-conversion")
      .map(([code]) => code);
    expect(gates).toEqual([]);
  });

  it("keeps pending conversions exactly in step with the source", () => {
    for (const [code, slice] of Object.entries(ledger.pendingConversion)) {
      expect(ledger.codes[code]?.category, `${code} (slice ${slice}) was converted: drop it from pendingConversion`).toBe(
        "pending-conversion",
      );
    }
    const pending = Object.entries(ledger.codes).filter(([, entry]) => entry.category === "pending-conversion");
    expect(pending.map(([code]) => code).sort()).toEqual(Object.keys(ledger.pendingConversion).sort());
    for (const site of ledger.pendingSites) {
      expect(text.get(site.file)?.includes(site.text), `${site.file}: "${site.text}" (slice ${site.slice}) was converted: drop it`).toBe(
        true,
      );
    }
  });

  it("hides no code inside a message", () => {
    const embedded = new Set<string>();
    for (const source of text.values()) {
      for (const [, code] of source.matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+): /g)) embedded.add(code!);
    }
    expect([...embedded].sort()).toEqual(Object.keys(ledger.messageCodes.pending).sort());
  });

  it("uses a refused status only for caller-authored verdicts", () => {
    const users = [...text].filter(([, source]) => source.includes('"refused"')).map(([file]) => file);
    expect(users.sort()).toEqual(Object.keys({ ...ledger.refusedStatus.allowed, ...ledger.refusedStatus.pending }).sort());
  });
});
