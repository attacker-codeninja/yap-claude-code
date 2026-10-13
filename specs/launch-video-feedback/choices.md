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
