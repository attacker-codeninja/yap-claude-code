# Slice 00 — API audit and contract freeze

## Contract

Record the explicit-intent and reversible-default rules in the feature's owning
spec and verify that the current public surface already follows them. Do not
change unrelated operations during this slice.

## Audit surface

Inspect `packages/protocol/src/operations.ts`, the operation-name/help derivation,
`packages/composition/src/edits.ts`, transcript/speaker owners in `packages/core`,
and CLI/MCP parity tests. Confirm:

- `edit.apply`, `edit.undo` and `edit.restore` are the only project mutation
  paths needed for these writes;
- `revision.get` and `revision.history` expose the resulting identities;
- transcript, frame, audio, timeline and preview reads do not mutate projects;
- `transcript.review` is explicit convenience with readiness side effects, while
  `transcript.get/search` remain retained reads;
- CLI and MCP derive one operation catalog.

## Deliverable

The materialized README and this audit record. Any API behavior that violates the
principles becomes a named follow-up slice; do not fix it opportunistically here.

## Verification

Run the narrow protocol/help and existing CLI/MCP parity tests. No media run is
needed. `git diff --check` must pass.
