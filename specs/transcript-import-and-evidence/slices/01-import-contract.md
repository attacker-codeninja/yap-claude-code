# Slice 01 — Imported transcript provenance

## Contract

`transcript.import` accepts SRT, VTT and one explicitly supported JSON schema
from a local path or admitted byte delivery. It stores raw bytes and a digest,
format/parser identity, cue IDs and order, verbatim text, original timestamp
operands, normalized source ranges, supplied word ranges when present, supplied
speaker names and unknown metadata.

`timingPolicy` defaults to `"supplied"`. This branch performs no alignment and
does not manufacture word timings from cue durations. Cue-only rows remain
cue/phrase evidence. Malformed input refuses deterministically; legal overlaps
and ordering remain evidence with typed issues rather than being silently
rewritten.

## Ownership and tests

Use the existing transcript persistence/publication owner or extend it with a
tagged imported generation; do not create a second project/revision store. Add
golden fixtures for each format, Unicode, markup, offsets, overlaps, cue-only
versus word-timed JSON, supplied speakers and malformed schemas. Test raw-byte
round trip, restart, replay identity, bounded reads and failure isolation.

## Checkpoint

Run the CLI and MCP with the same request, read the returned generation and show
origin, timing basis, cue/word rows and speaker labels. No model preparation or
project edit is allowed in this slice.
