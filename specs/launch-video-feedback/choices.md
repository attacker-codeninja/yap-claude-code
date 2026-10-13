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

## Slice 02

- **What counts as stale.** A complete transcript row is stale when this version
  can't read it, or when its `execution.recipe` or `engine.policy` isn't
  current (`currentTranscript` in `transcript.ts`). `kindPolicy` doesn't count:
  it isn't part of the job key, so a stale-by-kind row would still be the
  published answer for a current input. A word-kind change must also bump
  `transcriptPolicy`. *Confident.*
- **Pinned stale generations are historical evidence, not skipped.** The spec
  says every read skips a stale row. But a caption's text seed pins its
  transcript generation, every later edit revalidates inherited seeds, and
  export follows those pins. Skipping there would break editing and exporting
  every captioned 0.1.33 project once slice 03 bumps the recipe. So:
  - `retainedGeneration` takes `{ historical: true }` for pins an existing
    revision already holds;
  - a new seed (`text.seed`, or a newly placed seed) still needs a current
    generation, and gets `NOT_FOUND` with `stale: true`;
  - export carries a pinned stale generation with no publication;
  - import adopts it without a publication.

  Asset-level inventories, explicit `transcript.get`/`sourceStatus` reads and
  cleanup treat stale rows as the spec says. *Confident; it's the only reading
  that keeps 0.1.33 projects working.*
- **Skipped list instead of an issue (01c/01d pending).** There's no TODO in
  code. The skipped list travels as data, ready for the issue surface:
  - `TranscriptStore.portableGenerations` returns `{ generations, stale }`;
  - `PinnedProjectPackage.stale` (export) and `ValidatedProjectPackage.stale`
    (import) carry what was left out.

  Export intents persisted before this change have no `stale` field, so a
  reader must default it to `[]`. *Confident.*
- **The jobs layer forgets stale publications during cleanup.**
  `TranscriptProcessing.cleanupAsset` calls the new
  `JobQueue.forgetPublication` for each retained stale generation. That
  retires the artifact row together with its settled job. An active job keeps
  its publication. `reclaim` then removes the files and rows unless a revision
  references them. *Confident.*
- **A queued job from an older version retires instead of crashing.**
  `TranscriptProcessing.execute` parses the job's execution historically, so the
  existing input comparison settles it as `ARTIFACT_CHANGED` rather than a raw
  `ZodError`. *Confident.*
- **Replays and ingestion.** `ingest` accepts whatever execution the request
  names, as long as the receipt matches it, so retained replays keep their
  historical recipe. Production requests are always built by
  `speechExecution()`, which only produces the current recipe. *Confident.*
- **Normalization's implementation id was already in the prepared-audio key.**
  It reaches the key through the window manifest's processor requirements. The
  derivation now lives in one pure function, `processorImplementations` in
  `apps/service/src/audio-processing.ts`. Two tests cover it:
  - `prepared-audio.test.ts` asserts that a rename re-keys a failed job;
  - "a failed 0.1.33 normalization job re-runs after an identity bump" is
    `test.skip` in `apps/service/src/audio-processing.test.ts`, with a pointer
    to slice 04. It was verified red today (the old failed job answers) and
    green under a simulated rename. Slice 04 removes the `.skip`.

  The test observes re-execution at the prepared-audio request that
  `audio.measure` submits, not through the operation itself, which needs
  ffmpeg and native. *Confident.*
- **Known limit: adopted transcripts stay referenced.** Package adoption
  retains an asset → transcript-generation reference for every generation the
  asset listed. Such a generation is never reclaimed even once stale, although
  reads still skip it. Changing that means changing asset dependency retention,
  which this slice didn't need. *Open; revisit if recipient libraries grow.*
- **An unreadable pinned generation can't be exported.** It refuses with
  `NOT_FOUND`, because the package can't carry evidence it can't read. No
  0.1.33 row is unreadable, so this is theoretical. *Confident.*

## Slice 06 (authored ranges, done ahead of the read ranges)

- **The clamp keeps the same fraction of the placement.** A placement maps
  linearly onto its source (`projectTime`), so the kept part of the source
  maps to the same fraction of a project range, a content source range, or
  clip-anchor fractions. A retimed clip keeps its rate. *Confident.*
- **Replace clamps before its fit applies.** The fit then decides what a
  shorter source means: hold and silence pad, exact refuses, trim trims. The
  pinned edits test "trim past the stream's end refuses" now expects a
  clamped, trimmed replacement with `range-clamped`. *Confident: this is the
  slice's intended contract.*
- **The `Selected range exceeds source bounds` pending site is retired while
  its text remains.** The text now belongs only to strict validation of
  *stored* documents (class A); authored selections never reach it.
  *Confident.*
- **Holds and image streams are untouched.** A hold is a point, and a point
  outside its domain is malformed. *Confident.*
## Slice 09

- **The variable is `FIXTURE_LABEL`, and `omit` is its only value.** Any
  other non-empty value fails before Swift compiles, so a typo can't
  silently produce labelled shots. *Confident.*
- **The runner passes the label as an argument, not through the
  environment.** The shared `fixtureLabel()` in `fixtures/swift-controls.mjs`
  reads the variable once. Each runner passes the result as a trailing
  argument, the same way the fixtures already take their output directory.
  Without that, the Swift side would depend on inheriting the environment.
  *Confident.*
- **The unlabelled Library title is "Library".** That's the production
  window title (`LibraryWindow.swift`), not an empty bar. *Confident.*
- **`settings-view-shots` doesn't honour the variable.** It draws no label,
  so there's nothing to omit. *Confident.*
- **The harness test runs a copy of `harness.mjs`.** The copy sits in a
  scratch tree where no `dist/` exists, so the missing-app message is proven
  whether or not this checkout has a build. *Confident.*
- **The label test checks pixels, not fixture metadata.** It decodes both
  PNGs with ffmpeg, which the macOS tests already use, so it adds no PNG
  dependency. It requires a difference, and only inside the label's region.
  The region is derived from the fixture's reported backing scale and
  content height. *Confident.*

## Slice 07

- **07c angle groups.** Refused evidence no longer vetoes an angle group: the
  offsets are caller-authored, and the evidence is a reference. Stored-document
  validation dropped the check, and `angle.declare` reports
  `synchronization-evidence-refused`. *Confident.*
- **07g framing collapses every unmet constraint into one issue code,
  `framing-constraint-unmet`**, with `evidence.constraint` naming it. This
  avoids registering seven near-identical codes. The plan is `ready`
  (geometry plus issues) or `unavailable` with a reason: subject missing,
  ambiguous or out of bounds, or no feasible uniform crop. *Confident.*
- **07g's harness consumer (`subject-observations.mjs`) keeps its old
  semantics.** "Accepted geometry" now means ready *with no issues*. Only a
  syntax check was possible: the script is a research harness over real
  media that no suite runs. *Unverified by execution.*
- **07h dialogue proposals drop `peakPolicy` and the "constrained" status.**
  Statuses are `proposed` (a gain draft, possibly with `gain-constrained`
  issues naming the limit) or `unavailable` (a `proposal-unavailable` issue
  naming the reason). The gain bounds now *clamp* rather than refuse,
  consistent with the governing principle; the true-peak ceiling wins when it
  conflicts with the minimum bound. `targetMet` is removed because the issues
  carry it. *Confident.*
- **07h shape validation lives in `packages/protocol/src/skill-issues.test.ts`.**
  Skill helpers can't import the vocabulary at runtime; the protocol package
  can, and imports the helper by relative path. *Confident.*
- **07h harness consumer `dialogue-matching.mjs` only lost `peakPolicy`.**
  Syntax-checked; it's a real-media harness that isn't run here. *Unverified
  by execution.*