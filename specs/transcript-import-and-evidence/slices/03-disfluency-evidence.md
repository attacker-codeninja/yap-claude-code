# Slice 03 — Missed-filler and disfluency evidence

## Contract

Add a read-only disfluency evidence operation over a pinned source/project
selection. It may return emitted filler/vocalization rows from the existing
lexical policy and separately measured missed-disfluency candidates when a
provider supports them. Each row names its kind, source range, word IDs when
present, method/model identity, confidence or threshold, coverage and unknown
reason.

Absence of a word or low energy alone is never a missed filler. No candidate
mutates a project or authorizes a cut. Preserve imported and native transcript
generations separately.

## Tests and checkpoint

Test observed versus candidate versus unknown, generation pins, overlap/gap
coverage, bounded paging and no mutation. The checkpoint reads a fixture and
returns evidence that an agent can target with an ordinary explicit edit.
