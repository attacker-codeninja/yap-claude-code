# 06 Error and admission paper cuts

Four independent fixes, one commit each. They share no contract. Each red test
reuses a retained receipt.

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

## b. The source-bounds error reports the asset's end

`validateSourceSelection` (`packages/composition/src/model.ts:202–222`) adds
`{ clipId, requested, bounds }` to its details and message. No opt-in clamp:
authored ranges stay exact (decided).

Red: receipt 08 (an 11.46 s request against an 11.444 s movie), in the
source-selection tests.

## c. `transcript.render.prepare` refuses an out-of-project range up front

Today it is admitted as a job and then fails inside it. Instead, run the same
project-window admission that `audio.get` and `audio.measure` already run
synchronously, before `submitDeferred` (`packages/core/src/rendered-speech.ts`
L95–111). The result is `ok:false INVALID_PARAMS` and no job is created. The
job-time check in `project-window.ts:224–229` stays as defense.

Flip the pinned test at `apps/service/src/project-contracts.test.ts:81`; it
pins an inconsistency, not a decision.

Red: receipt 09, plus a unit test in `rendered-speech.test.ts`.

## d. The CLI's `--wait` on `transcript.render.prepare` returns words

`apps/cli/src/wait.ts:52` re-reads prepare. Map it to
`transcript.render.get` pinned to the published generation, the same way it
already maps `transcript.prepare` (L180–188). The prepare/get split stays
(decided).

Red: in `apps/cli/src/wait.test.ts`, a settled render prepare yields word
rows.

**Must stay green.** Each owner's existing tests, and `wait.test.ts`'s
stdout/stderr split.

**Delegated.** Wording of the messages.
