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
