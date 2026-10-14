# Slice 05 — Caller-authored speaker corrections

## Contract

Add an explicit project edit for speaker attribution corrections, using the
existing atomic revision reducer and `requestId`/`expectedRevisionId` seam. The
target is pinned occurrence/word identity or an exact range; the correction may
name a supplied speaker, acoustic slot, unknown or overlap and carries its
provenance.

Keep base acoustic observations and imported labels unchanged. Reads expose base,
correction and effective attribution so an agent can explain the change. Do not
propagate by display name, proximity or neighboring turns unless the request
names those targets. One batch is one revision and one undo step.

## Tests and checkpoint

Test supplied names, unknown/overlap, per-word and contiguous targets, stale
revision, replay, partial failure atomicity, undo/restore/history and CLI/MCP
parity. Verify source media and transcript generations remain unchanged.
