# 06 Error and admission paper cuts

Four independent fixes, one commit each. They share no contract. Each red test
reuses a retained receipt.

Fix (a) stays a refusal, because the input is malformed: a clip curve with
integer keys could mean several things. The refusal becomes self-explanatory.
Fixes (b) and (c) follow slice 02: a partly valid range is clamped and
published with an issue.

## a. The curve-clock error names the clock

`packages/composition/src/processing.ts:139–160` throws `Processing curve must
match its clock…` without saying which clock. Split clock errors from bound
errors. Details carry:
- `{ clock: "clip" | "project" | "content" }`;
- the slot;
- the expected key form: a `{numerator, denominator}` fraction in [0,1] for a
  clip, or integer microseconds otherwise.

Red: receipt 07 (integer keys on a clip curve), in
`temporal-processing.test.ts` (~L221).

## b. A source range past the asset's end is clamped, with an issue

Today `validateSourceSelection` (`packages/composition/src/model.ts:202–222`)
refuses with `Selected range exceeds source bounds`. The session hit this with
an 11.46 s placement against an 11.444 s movie (receipt 08). Placement is a
cheap, undoable edit, so under slice 02's principle:
- clamp the source range and the placement to the stream's actual support;
- record `range-clamped` in the edit receipt, with the requested range, the
  bounds and the trimmed duration;
- callers `place` and `replace.ts:33` behave the same way.

A selection that starts outside the source, or is empty after clamping, is
still malformed and refuses. The message reports the bounds.

Red: receipt 08, in the source-selection tests. The placement lands, the
receipt carries `range-clamped`, and undo restores the prior revision.

## c. Project-time reads clamp to the project, with an issue

The session asked `transcript.render.prepare` for 128–143.08 s on a project
ending at 139.73 s. The job was admitted and then failed (receipt 09). The same
rule as (b) applies to every project-time read:
- `transcript.render.prepare`;
- `audio.get`;
- `audio.measure`;
- `frame.batch`;
- `preview.get`.

A range that partly overlaps the project is clamped to it and published with
`range-clamped`. A range that doesn't overlap the project at all is malformed
and refuses at admission, with the project bounds in the message. No job is
created.

Do this in the project-window owner (`packages/core/src/project-window.ts`
~L224–229). Every read already goes through it, so `RenderedSpeech.prepare`
(`rendered-speech.ts` L95–111) must call it before `submitDeferred`. Flip the
pinned test at `apps/service/src/project-contracts.test.ts:81`.

Red:
- receipt 09 publishes, clamped to 128–139.73 s, with the issue;
- a fully outside range refuses with no job;
- one `audio.get` partial-overlap case.

## d. The CLI's `--wait` on `transcript.render.prepare` returns words

`apps/cli/src/wait.ts:52` re-reads prepare. Map it to
`transcript.render.get` pinned to the published generation, the same way it
already maps `transcript.prepare` (L180–188). The prepare/get split stays
(decided).

Red: in `apps/cli/src/wait.test.ts`, a settled render prepare yields word
rows.

**Must stay green.** Each owner's existing tests, and `wait.test.ts`'s
stdout/stderr split.

**Delegated.** Wording of the messages, and the issue code spelling.
