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

## Slice 03

- **No seam shift.** Probe 1 decoded both seams shifted ±0.25 s and ±0.5 s.
  Only −0.25 s resolved both, and a shift changes the recognized words
  themselves, so it re-rolls evidence instead of settling it. A shifted
  boundary would also need a 28.25 s decode or a new ownership plan.
  Unresolved words go straight to start ownership. *Confident.*
- **Every unresolved guarded observation gets an issue, published or not.** A
  published one carries `at: { word }`. One that its own window doesn't
  publish (it starts in the other core) carries `at: { range }` and
  `published: false`, because that is where a word could be lost. Points that
  aren't published have no `at`. *Moderately confident; it doubles the issue
  count at a lexical disagreement such as "video"/"videos".*
- **A pair with an ambiguous member, or one that crosses an accepted pair, is
  unresolved on both sides**, rather than accepted. That keeps the old
  refusal's uniqueness rule as the line between pairing and flagging.
  *Confident.*
- **The end-of-media expectation was wrong.** The overruns in receipts 02 and
  04 are the trailing `.` token, and the published word is timed by its
  speech-bearing tokens, so nothing published is clamped. The old refusal came
  from a check on every raw token, which is deleted. Clamping applies to the
  published spoken extent, and an issue is raised only when a published word
  was clamped. The end-to-end run shows no `timing-clamped`. *Confident: probe
  2 and the run agree.*
- **A malformed token drops its whole word, not just the token.** Dropping one
  token would publish altered text. The issue names the first malformed token;
  `at` is the window's owned range, because the word's own time may be
  nonfinite. Raw JSON spells nonfinite values `"NaN"`/`"Infinity"`
  (`nonConformingFloatEncodingStrategy`); finite output is byte-identical.
  *Confident.*
- **`INVALID_SPEECH_TIMING` stays as `malformed` for two invariants.** One is
  an unrepresentable raw line. The other is a merged word without a span,
  which the merger can't produce. *Confident.*
- **Issue codes are `boundary-unresolved`, `timing-clamped` and
  `word-dropped`.** Their evidence names `window` (the decoded window's
  ordinal) and `observation` or `token`, so a caller can find the candidate in
  `raw.jsonl`. *Confident.*
- **Raw lines carry `issues`, with `word` local to the line.** Core turns
  `word` into the transcript ordinal at index time and validates the result
  against the composition `issueSchema`. A malformed raw issue fails the
  attempt as `INVALID_RESPONSE` ("Raw transcript issue is malformed"), like
  any other malformed raw line. *Confident.*
- **Word rows read issues by transcript generation.** A transcript generation
  is the `attemptId` that published it, both for asset jobs and for rendered
  recognition, so `TranscriptStore.wordRecords` looks up `output_issues` by
  that id and `json_extract(issue,'$.at.word')`. The rows then reach
  `transcript.get`, `transcript.review`, `transcript.render.get` and project
  rows, which spread source rows. `TranscriptStore` creates the
  `output_issues` table itself (table only; the retirement triggers stay with
  the job queue), so stores that run without a queue can read it.
  *Moderately confident; it couples the transcript store to the publication
  key rule from 01c.*
- **`TranscriptStore.ingest` returns `{ transcript, issues }`.** The issues
  must reach `StagedJobResult.issues`, and the store has no job generation to
  write them itself. The transcript job now returns a `StagedJobResult`.
  Rendered recognition reports the transcript's issues as its own.
  *Confident.*
- **Package import re-derives issues.** `stagePortable` returns the issues it
  indexed, and `adoptArtifact` takes them, so the package format is
  unchanged. A generation the recipient already holds isn't re-indexed, so it
  contributes none; its local publication, if any, already has them. *Open:
  untested through a real package round trip.*
- **Harness literals.** `editing/synchronization/recognition.mjs` sends a
  fresh native request, so it now names recipe v3. The retained protocol
  assertion in `full-domain-lexical-replay.mjs` keeps v2 as historical
  evidence. *Syntax-checked only.*

## Slice 04

- **Issues are derived from the processing evidence alone.**
  `audioProcessingIssues` in `packages/core/src/audio-measurement.ts` is the one
  rule. Producers publish exactly its output, and retained reads, imports and
  movies re-derive it. A stored issue list that differs is `ARTIFACT_CHANGED`
  (read) or `INVALID_PACKAGE` (import). So 0.1.33 evidence, which only exists
  because it met its targets, derives no issues and reads as before.
  *Confident.*
- **The limiter's sample peak joins its evidence.** A limiter issue can't be
  derived without the measured peak, so evidence gains an optional
  `limiter: { samplePeak }` (linear, compared exactly as the old gate did). 0.1.33
  limiter evidence omits it and derives no issue; its bytes and strict schema are
  unchanged. This is the one additive field in retained evidence. *Confident.*
- **One `normalization-target-unmet` issue per domain, listing each missed
  target.** `missed[]` carries `target`, `requested`, `achieved` and `excess`
  (distance past the requested value, not past the tolerance; the tolerance only
  decides whether the target is listed). Gain-only adds `requestedGainDb`,
  `gainDb`, `peakToLoudnessDb` and `maximumFeasibleTargetLufs`; dynamic adds
  `attempts`, `selectedAttempt` and `stopReason`. The domain is named by
  `domainIndex` in evidence, because compiled domains carry no step id.
  *Confident.*
- **"Best" keeps the old choice among passing candidates.** The rank is the total
  miss beyond tolerance, then integrated error, then index. A candidate that meets
  every target has zero miss, so among those the closest to the loudness target
  wins, exactly as before; the spec's "smallest total excess, ties by index" only
  decides among candidates that miss. A literal "ties by index" would have made the
  correction loop pointless whenever its first candidate already passed. Retained
  reads check that `selectedAttempt` is this choice. *Confident.*
- **The correction loop's step is one pure function.** `normalizationStep` decides
  the next offset or the stop reason; the service loop and the issue derivation
  both use it, so a stop reason is re-derivable from retained attempts. It adds
  `target-reached`, which the old chain lacked but never needed to name. Evidence
  whose last attempt the rule would have continued is `INVALID_RESPONSE`.
  *Confident.*
- **Unmeasurable means passing through at unity, in both modes.** A signal with no
  integrated loudness, range or true peak, or a dynamic first pass with non-finite
  statistics, renders through `volume=1` and records one attempt with a null
  offset. `normalization-unmeasurable` names the measurement and reason. Short
  domains (under 3 s) have no loudness range, so they now pass through instead of
  refusing. *Confident.*
- **Jobs without staged files return `{ result, issues }`.** `StagedJobResult`'s
  `publish` and `close` became optional so the audio inspection, preview (movie),
  encoded-audio and export jobs can publish issues without staging hooks.
  *Confident.*
- **Exports inherit their rendition's issues.** This settles slice 01's open
  item for video and audio exports: the export intent's pinned rendition
  (`preview`) records the issues of the preview or PCM it copies, and the export
  job publishes them. An M4A inherits its PCM's issues. Intents admitted before
  this change have no `issues` and inherit none. The status reads `committed` as
  soon as the receipt lands; the issues appear once the export job publishes.
  *Confident for video and audio; caption and package exports carry none.*
- **Prepared-audio packages carry `issues`.** `portablePreparedAudioSchema`
  gains an optional `issues`; an absent field (a 0.1.33 package) means none.
  Import compares it with the re-derived list and adopts the publication with
  those issues (`JobQueue.adoptArtifact` takes them). *Confident.*
- **Audio extraction doesn't carry treatment issues yet.** An extraction of
  processed project audio (rendered speech) re-renders through the same path but
  publishes none of the treatment's issues. *Open; it needs a rule for derived
  artifacts that consume treated audio.*
- **`SourceChannelPCM` `UNAVAILABLE_SUPPORT` was not converted.** Core admission
  (`selectSourceChannelRange`, `packages/core/src/source-selection.ts`) refuses
  the same gap before native runs, so converting only the native sink changes
  nothing a caller can reach. Its consumers are the speaker model (its admission
  requires a complete 30 s span) and alignment, which needs a contiguous model
  input. Publishing supported samples "never as silence" therefore means either
  shifting alignment timing by concatenating runs or aligning each run
  separately. That's a design decision for the providers, not a gate flip. The
  code stays in `pendingConversion`. *Open; needs the owner's call.*
## Slice 05

- **Stopped at the probe; no field was built.** One RMS over the whole
  "okay?" word drops only 3.4 dB from the dry tap to the processed tap; the
  bar was about 10 dB. Denoise removes the word's soft onset and tail (10–16
  dB per 20 ms bucket) but keeps its loud middle, and a whole-word average
  is dominated by that middle. `waveform.get` already reports per-bucket RMS
  for each channel on any tap and range, and it shows the loss. A new
  `rmsDbfs` would be a second owner of RMS that reads the wrong way here. The
  details are under "Probe result" in the slice. *Confident in the numbers.
  Closing the slice versus reshaping it is the owner's call.*
- **The probe read PCM, not an unbuilt field.** `audio.get` returns the exact
  selected PCM that the meter would read, so its RMS is the value `rmsDbfs`
  would have reported. That kept the probe ahead of any code. *Confident.*

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

### 06b: read ranges, render admission and messages

- **One read-side helper, `admitReadRange(requested, domain)`, wraps
  `admitRange` for wire ranges** (`range-admission.ts`). It returns the applied
  range and `issues` (`range-clamped` or empty). A requested range that isn't a
  nonempty half-open range is `INVALID_RANGE`. Project reads share
  `admitProjectRange(durationUs, range)` in `project-window.ts`, so the project
  window, rendered recognition, project evidence and package speakers apply one
  rule. *Confident.*
- **Where the issue goes depends on what the identity holds.** Rendered
  recognition's job identity already keeps the requested range, so its clamp is
  stored with the output (`StagedJobResult.issues`) and returned by
  `transcript.render.get`. `transcript.render.prepare` admits synchronously, so a
  range with no overlap refuses before any job. The other reads (`audio.get`,
  preview, `transcript.get`/`review`, source and capture `timeline.events`/
  `cursor.raw`, project evidence, package speakers) keep the *applied* range in
  their cached identity and report the clamp as the result's top-level `issues`.
  Every re-read of the same request, including a CLI `--wait` poll, recomputes
  it, and a request for the applied range shares the same cached output. This
  avoids changing those identities, which exports and extractions pin.
  *Confident; it departs from the slice's "identity keeps the requested range"
  for these reads, so review it.*
- **The CLI's ready marker counts a read's `issues` plus its published
  output's `issues`.** It used to read `data.issues ?? published.issues`; an
  always-present empty `data.issues` would hide published issues. *Confident.*
- **Continuations keep the requested range.** A transcript page cursor stores the
  requested range and re-admits it on each page, so every page reports the same
  clamp. Event and evidence cursors digest the applied range. *Confident.*
- **Integer-microsecond sites keep their own integer check** (transcript pages,
  source and capture events) and refuse a fractional range with `INVALID_RANGE`,
  as before. *Confident.*
- **The trim pin "Trim range must stay within the clip's resolved interval" is
  retired.** The kept range is admitted against the clip's resolved interval;
  `edits.test.ts` dropped that refusal assertion and `range-admission.test.ts`
  owns the clamp. *Confident.*
- **Left as refusals, with reasons:**
  - content anchors (`model.ts` ~143) and angle validity (`model.ts` ~444) are
    stored-document validators. Clamping them at authoring time means clamping
    inside place, reanchor and `angle.declare`, composed with the source clamp,
    and that isn't straightforward. *Deferred; resolved in 06e (clamped when
    authored).*
  - the transcript execution range (`transcript-processing.ts` ~236) is part of
    the stored speech-execution identity that native receipts are validated
    against (`transcript.ts` ~850). It belongs with slice 03's seam work.
    *Deferred; resolved in 06e (clamped before the identity forms).*
  - the project alignment range (`project-service.ts` ~525) aligns caller text to
    that range. Clamping the audio while keeping the full text needs a decision,
    and the only test seam needs a prepared tap and the native aligner.
    *Deferred; resolved in 06e (the text aligns against the applied range).*
- **6b splits the curve error three ways:** a clock error (details `clock`,
  `slot`, `expectedKey`: `fraction` or `microseconds`), a malformed curve
  (details `reason`), and a bound error (details `slot`, `bounds`). All three
  stay `INVALID_COMPOSITION` refusals inside `INVALID_EDIT`. *Confident.*
- **6c maps `transcript.render.prepare` and `.retry` `--wait` to
  `transcript.render.get`** with only `projectId`, `revisionId` and the
  generation: the job's `attemptId`, or the already-published output's
  generation. *Confident.*


## Slice 06e (deferred range sites)

- **The transcription clamp is reported per request, not stored with the
  generation.** The plan said the job's published issues. But the clamped range
  forms the same identity as a request for the applied range, so both share one
  generation. A stored clamp would show on the exact request, and a clamped
  request that joined a finished generation wouldn't see it. So
  `transcript.prepare`/`retry` (and `transcript.review`, which passes its range
  as the execution range) return `range-clamped` in the status's top-level
  `issues`, recomputed on every call, like the 06b reads. *Confident; this
  departs from the decision's wording, so review it.*
- **The CLI's `--wait` on `transcript.prepare` carries the clamp.** Its pinned
  `transcript.get` read can't take an execution range, so the wait adds the
  preparation's `issues` to that read's `issues`. *Confident.*
- **No implementation identity bump for transcription or alignment.** An
  in-range request forms a byte-identical identity (checked), and an overrun used
  to produce nothing, so no existing generation's output changes. *Confident.*
- **The project alignment clamp publishes with its output.** That job's identity
  keeps the request, so, like rendered recognition, the issue is stored with the
  evidence. The project resolver adds `issues` to what it resolves only when it
  clamps, so unclamped identities don't change. The `alignment.prepare`
  description never stated the refusal, and lvf-07b is likely to edit it, so it
  is unchanged. *Confident.*
- **Alignment is proved in two halves.** A service test proves admission (an
  overrun now reaches the prepared-tap lookup; no overlap is `INVALID_RANGE`); a
  core test proves a resolver's issue publishes with the evidence. The native
  aligner over a clamped range was not run. *Confident in the halves; the whole is
  assumed.*
- **A placement keeps the part every domain keeps.** The media source within its
  stream and a content anchor within its parent's selected source each keep a
  fraction of the placement; the clip keeps their overlap. Each range that
  overran reports its own clamp, with the range finally stored as applied. A range
  that shrank only because the other one overran gets no issue of its own, since
  its bounds weren't the cause; the stored clip shows it. *Confident.*
- **A source and an anchor that keep disjoint parts refuse** with
  `INVALID_RANGE`, naming both requests and bounds: empty after clamping is
  malformed. *Confident.*
- **Reanchor shortens too.** An anchor past its parent's source shortens the clip
  and its source by the same fraction, and "reanchor preserves the interval" now
  means it keeps the same part of the old interval. A child content-anchored to
  the shortened clip, or an angle validity range on it, isn't clamped in turn; if
  it no longer fits, stored validation refuses the batch. *Fairly confident; that
  cascade is rare and left strict.*
- **Angle validity clamps per range; the offset never moves.** Each piecewise
  segment is clamped on its own, and a segment wholly outside its member refuses
  rather than being dropped. *Confident.*
- **No pinned test asserted these four refusals**, so none flipped. *Checked by
  search.*


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
  by execution.*- **07d: an SRT timing line stays a refusal; markup publishes.** Markup,
  entities and ASS tags only risk being rendered as formatting, so they get
  `srt-literal-markup`. A literal timing line inside a cue makes readers split
  the file into an unintended extra cue, which is malformed for SRT. It keeps
  `UNSUPPORTED_FORMAT`, with its own message. *Confident.*
- **07k: caption diagnostics ride on the export job's publication.** The
  sidecar returns `issues` (`caption-omitted`, `caption-overlap-added`,
  `caption-styling-discarded`, `srt-literal-markup`). The exporter returns
  them as the job's staged issues, so export status shows them through the
  01d path. The status snapshot no longer projects `omitted`,
  `addedOverlaps` and `discardedStyling`. Exports committed by 0.1.33 keep
  those fields in their stored snapshot, but status no longer shows them.
  That's a derived view, accepted under the no-compat rule. *Confident.*
- **07k issues appear on publication, not at admission.** The harness's
  admission-time overlap assertion moved to the committed status. *Confident.*
- **07i face status words become `unavailable`.** `face.trajectory.get`
  returns `state: "unavailable"` when observations are missing, and linear
  prediction reports `state: "unavailable"`. Both are computed at read time,
  so nothing retained changes. *Confident.*
- **07f and 07j: verdict vocabularies stay (deviation from the slice
  table).** The speaker-continuity receipt's accepted/refused verdict and
  the alignment worker's `conditionalStatus` are evaluation verdicts stored
  in retained evidence, like synchronization evidence. Renaming them, or
  turning `failedGates` into issues, would break strict reads of retained
  0.1.33 receipts and need an identity bump, for vocabulary alone. They're
  allow-listed in the ledger with reasons. `failedGates` stays the gate
  results inside the verdict. *Moderately confident: revisit if a consumer
  reads these as operation refusals.*
- **07e HDR stays a refusal, with what it saw.** Both HDR qualification
  refusals carry their evidence in `details`: the container declarations and
  FFmpeg's reading, or the codec and inspection facts. The caller can see
  which declarations disagree. *Confident.*
  by execution.*