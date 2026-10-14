# 03 — caption proposal contract

## Contract unlocked

An agent can request caption drafts without assembling transcript pagination and
caption grouping itself. Drafting remains separate from applying captions.

## API seam

Expose `caption.propose` as a read-only operation over the existing compact
transcript and `caption-proposals.mjs` owners. Its request pins project/revision,
explicit word-row selection, track, canvas, exact font/style, corrections and
constraints. Its response returns versioned ordinary text clip drafts, transcript
generation and occurrence pins, timed-word mappings, bounded issues and readiness.

It refuses source-only or incomplete transcript evidence and never transcribes,
prepares a model, calls `text.seed` or claims pixel-fit. `text.seed` remains the
only mutation: it receives copied proposal cues plus `requestId` and
`expectedRevisionId`, then publishes one new revision atomically.

## Tests and checkpoint

Extend caption vectors for instant, partial, discontinuous, corrected and
unsupported rows. Prove no project, job or model write occurs during proposal,
and prove stale revisions refuse rather than silently retargeting.

Playable checkpoint: an agent requests a proposal, sees exact pins/issues, and
must make a separate explicit `text.seed` call to add captions.

## Delegated freedom

The implementer may choose response presentation grouping, but operation meaning,
bounds, identity pins and read-only behavior are fixed.
