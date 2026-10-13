# 01 Output by default: one `issues` contract and a refusal ledger

**The principle (set by the product owner, 2026-10-12).** If an operation can
produce an output, it produces it. Every problem is reported as an issue
attached to that output.

Refusal is reserved for:
- **malformed input:** wrong shape or clock, a value outside the domain, or a
  single point outside the source;
- **ambiguous input:** for example, a non-unique match or an unverified
  layout;
- **identity or revision conflicts;**
- **resource bounds;**
- **missing prerequisites;**
- **destructive or irreversible actions.**

On cheap, undoable work, a quality, tolerance or target miss is an issue, not
a refusal. Cheap, undoable work means derived artifacts, revisions, previews,
measurements, and exports to new files. Tolerances decide whether an issue is
raised, never whether output exists.

Output by default means *flagged* output, never output altered quietly. Every
clamp, fallback, dropped word or unmet target:
- names what was requested;
- names what was produced;
- keeps the raw evidence.

This is compatible with the product boundary (zero editorial decisions).

## Order (fog audit: one seam per step, each with its own red test)

1. **01a Ledger, red.** `refusal-ledger.test.ts` + `refusal-ledger.json` with
   today's codes classified and `pendingConversion` listing every audit gate.
   Changes no product behaviour; it fails only on rules 2, 4 and 5 until the
   later steps land, which is the expected red.
2. **01b Type.** `issues.ts` schema, registry, truncation; protocol re-export.
3. **01c Storage.** `output_issues` table, written in the publication
   transaction.
4. **01d Surfaces.** `publishedOutput`, synchronous `data.issues`, export
   status, CLI stderr line, MCP, and the cross-surface parity fixture.
5. **01e Docs.** `AGENTS.md` (after audit-agents), `README.md`,
   `packages/protocol/README.md`, the archive pointer.

## Seam

**Owner:** `packages/composition/src/issues.ts`.
- Composition is the root package: protocol, core and service depend on it,
  and it holds caption sidecars and subject framing.
- `packages/protocol` re-exports it. No other package defines an issue type.

**Schema:**
- `issueCodes` is the only registry.
- `issueSchema` is a union keyed on `code`.
- Each issue is `{ code, message, at?, evidence }`:
  - `code` is kebab-case. Refusal codes stay `UPPER_SNAKE`, so the two
    vocabularies never collide.
  - `at` is an optional subject: a range, word ordinal, step id or channel.
  - `evidence` is typed per code. A clamp carries requested and applied
    values. An unmet target carries the target, the measured value and the
    tolerance.
- No severity levels: ranking problems would be an editorial call.
- At most 1000 issues per output. Past that, a final `issues-truncated
  {omitted}` issue reports how many were dropped.

**Storage:**
- Additive table `output_issues(outputKind, outputId, generation, ordinal,
  issue)`, created with `IF NOT EXISTS`, in a new
  `packages/core/src/issues.ts`. Rows are written in the same transaction as
  the output.
- Retained evidence objects are not changed. That keeps strict schemas and
  deep-equality checks over 0.1.33 data valid (`audio-inspection.ts:905`,
  `prepared-audio.ts:50`).
- Portable package schemas read a missing `issues` as `[]`.
- No `catalogFormat` bump. `catalog.ts` allows additive tables, and nothing in
  the repo uses `ALTER TABLE`.

**Surfaces:**
- **Published job outputs:** `publishedOutput()` and `publishedOutputSchema`
  (`packages/protocol/src/work.ts`) gain a required `issues`. This covers
  roughly 18 call sites in `project-service.ts`.
- **Synchronous results:** a `data.issues` that is always present (empty when
  clean).
- **Export status:** the export's own issues plus those inherited from pinned
  inputs.
- **CLI:**
  - Exit 0 whenever an output exists.
  - The settled stderr line reads `op: ready (N issues)` (`apps/cli/src/wait.ts:269`).
  - Stdout stays exactly the envelope.
- **MCP:** `isError` stays `!ok`. `structuredContent` already carries the
  envelope.
- **Skill scripts:** they emit the same shape. A protocol test validates it.
- **Native Swift:** returns issues parsed at the TS boundary. An unknown code
  is `INVALID_NATIVE_RESPONSE`.

**Not migrated:**
- `unavailable: SelectionRange[]`, which is a support map, not a diagnostic;
- per-item states such as `too_short`, `timingReason` and `prediction.state`.

## The regression oracle (written first, red)

New test `packages/protocol/src/refusal-ledger.test.ts`:
1. **Every refusal code is classified.** Scan non-test TS, Swift and
   skill-script sources for code literals in constructor position. Each code
   must appear in `refusalCodes` with one category: `malformed`,
   `ambiguous`, `conflict`, `resource-bound`, `missing-prerequisite`,
   `destructive` or `execution-failure`.
2. **Gate words are banned in refusal codes:**
   `/UNMET|FEASIBLE|DISAGREEMENT|TOLERANCE|THRESHOLD|QUALITY/`.
3. **A per-file ratchet.** `refusal-ledger.json` counts code occurrences per
   file. A new gate hiding behind a generic code like `NOT_READY` or
   `UNSUPPORTED_MEDIA` changes a count and fails until it's classified.
   `UPDATE_REFUSAL_LEDGER=1` rewrites the counts, but new entries get a null
   category and still fail.
4. **No codes hidden in messages.** A message starting with `UPPER_SNAKE`
   (for example `FONT_SUBSTITUTED` inside `UNSUPPORTED_MEDIA`) must become a
   real code.
5. **No `"refused"` status in product results.** The only allowed uses are
   caller-authored verdicts (`correspondence.ts:71`, `schema.ts:615`) and
   frozen evidence under `packages/test-harness/editing/**`.
6. **Issue registry hygiene.** Every issue code is used in source and asserted
   in at least one test, and no issue code equals a refusal code.
7. **A conversion ratchet.** `pendingConversion` starts as today's gate codes,
   listed in [refusal-audit.md](../assets/refusal-audit.md). Slices 03, 04, 06
   and 07 each remove their entries. Slice 11 asserts the list is empty.

**Cross-surface parity:** one fixture produces deep-equal `issues`, exit 0 and
`isError: false` through all three of:
- the service handler;
- CLI `--wait` (`apps/cli/src/wait.test.ts`);
- MCP (`mcp-media.test.ts`).

## Docs (this slice)

**`AGENTS.md`, Product boundary.** Run
[audit-agents](../../../.agents/skills/audit-agents/SKILL.md) first. Add:

> **Output by default.** If an operation can produce its output, it does, and
> reports every problem as an issue on that output. Refusal is for malformed
> or ambiguous input, identity or revision conflicts, resource bounds, missing
> prerequisites, and destructive actions. Each clamp, fallback, dropped word or
> unmet target names what was requested and what was produced, and keeps the
> raw evidence. Tolerances decide whether an issue is raised, never whether
> output exists.

**Other docs:**
- `README.md` "Product boundary": one pointing sentence.
- `packages/protocol/README.md`: add an Issues section.
- `specs/done/video-editing-feedback/README.md`: add one dated "superseded
  for cheap, undoable work by…" pointer only. Archives keep their original
  role.

Site-specific doc rewrites belong to the slice that converts each site.

## Red tests first

- the ledger (it is red today because of `pendingConversion` hygiene and the
  missing registry);
- `issues.test.ts` round-trips, including truncation;
- `output_issues` writes in the publication transaction;
- `publishedOutput` always carries `issues`;
- the cross-surface parity fixture.

**Must stay green.** Every class-A refusal test.

**Delegated.** Field names inside `evidence`, and how the ledger scanner
tokenizes Swift.
