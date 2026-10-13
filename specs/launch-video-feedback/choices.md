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
