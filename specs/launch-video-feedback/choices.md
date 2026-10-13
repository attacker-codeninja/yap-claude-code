# Choices ledger

Decisions made during implementation where the spec was silent or was
overridden. Each entry: the choice, why, and how confident.

## Slice 01

- **No protocol re-export of the issue type (01b).** The spec said
  `packages/protocol` re-exports `issues.ts`. Every protocol consumer that
  needs it already depends on `@yap/composition`, so a re-export would give
  one concept two import paths. Add it only if a package without the
  composition dependency (for example the CLI) needs the type. *Confident.*
- **The truncation rule checks only the tail (01b).** `issuesSchema` requires
  that anything past `issueLimit` ends in `issues-truncated`; it doesn't
  forbid that code elsewhere. Forbidding it added nothing the length rule
  doesn't already guarantee. *Confident.*
- **The ledger classifies literals, not constructor calls (01a).** Refusals
  are raised through helpers (`invalid(...)`, `notReady(...)`), so
  constructor scanning misses them. Every UPPER_SNAKE literal is classified,
  including non-refusals (`not-a-refusal`, `issue-code`), with exact per-file
  counts. Gates behind generic codes are tracked by message text in
  `pendingSites`. *Confident.*
- **Seeded categories came from name heuristics, then a manual review
  (01a).** Borderline calls: `TOO_SHORT` and `GAIN_UNREPRESENTABLE` as
  malformed (slice 07h converts the dialogue-proposal ones);
  `UNSUPPORTED_MEDIA` as missing-prerequisite (its font and HDR uses are
  tracked separately). *Moderately confident; slice 07 revisits each.*
- **Job publications key issue rows by attempt (01c).** `output_issues` rows
  for job output use `outputKind = "artifact"` and `outputId` = the publishing
  `attemptId`, with the published generation. An attempt publishes at most
  once, `artifacts.attemptId` already names it, and retained reads (portable
  transcript generations, index frames) resolve publications by attempt, so
  every read path finds the same rows. *Confident.*
- **Triggers retire issue rows with their artifact (01c).** Two `IF NOT
  EXISTS` triggers on `artifacts` delete an attempt's rows when its artifact
  row is deleted or replaced by another attempt. One rule covers regenerate,
  forget, owner deletion and settlement replacement instead of four call
  sites, and it adds schema objects without altering the table. *Moderately
  confident; the repo had no production triggers before.*
- **Invalid issues fail the attempt (01c).** A producer's issues are bounded
  with `boundedIssues`, then parsed with `issuesSchema` inside the
  settlement transaction. A malformed issue is a producer bug, so the attempt
  fails like any other publication error rather than publishing unreported
  problems. *Confident.*
- **Issues travel on the queue publication (01d).** `ArtifactStatus.published`
  carries `issues`, and each core domain owner copies them next to
  `generation` into its own published shape. That keeps one source for
  `publishedOutput()` instead of a service-side lookup by job ID, which would
  miss publications read without a job (retained transcript generations,
  index frames). *Confident.*
- **Package context jobs publish no issues (01d).** In-memory package context
  executors return only a result string, so their envelopes carry `issues: []`
  through one `contextPublication` helper. Add a channel when a context
  producer has issues to report. *Confident.*
- **Export status carries only the export job's own issues (01d).** The spec
  also names issues inherited from pinned inputs; that needs a rule for which
  inputs count, so it waits for the first export producer that emits issues.
  *Open.*
- **The CLI `--wait` exit code is unchanged (01d).** A ready output already
  exits 0, and issues never feed `waitSucceeded`. A failed job with an older
  retained publication still exits 1, because the requested generation was
  not produced. *Confident.*
