# 06 Ranges and messages

Four fixes. Each is one commit, with its retained receipt as the red test.

## a. One `admitRange` owner for every range

**Rule (slice 01).**
- A range that partly overlaps its domain is clamped. It's published with
  `range-clamped`, carrying the requested and applied ranges and the domain
  bounds.
- A range with no overlap, or empty after clamping, is malformed:
  `INVALID_RANGE`, with the bounds in the message.
- A single point outside its domain is malformed. A point can't be partly
  valid.

**Seam.** One function, `admitRange(requested, domain) → { range, issues } |
INVALID_RANGE`, in the composition clock owner. Every site below uses it, and
the old per-site checks are deleted.

**Read ranges:**
- `transcript-read.ts:264`;
- `audio-inspection.ts:224`;
- `project-evidence.ts:219`;
- `source-events.ts:142`;
- `capture-source-read.ts:316`;
- `transcript-processing.ts:236`;
- `apps/service/src/project-service.ts:525`;
- `portable-speakers.ts:113`;
- `project-window.ts:224–229`, which is today's "Rendering requires a
  nonempty range…" check. It moves to synchronous admission, so
  `transcript.render.prepare` clamps or refuses before a job exists.

**Authored ranges.** These clamp at authoring time, inside the edit
operation, and the issue goes on the `edit.apply` result:
- place and replace (`edits.ts`, `replace.ts:33`);
- trim (`edits.ts:1387`);
- content anchors (`model.ts:143`);
- angle validity (`model.ts:444`).

`validateSourceSelection` (`model.ts:202–222`) stays a strict validator of
*stored* documents, so a stored revision is always valid. Revision history
already keeps the requested operation (`projects.ts:356`).

**Clamping shortens rather than inventing.** A clamped placement gets shorter;
it never holds the last frame. Holding would invent picture the caller didn't
ask for.

**Job identity.** It keeps the *requested* range. The clamp issue is stored
with the output, so a later `--wait` read still shows it.

**Points stay refusals:**
- `frame-inspection.ts:548`;
- `compiler.ts:430`;
- `SourceFrameRenderer.swift:55`;
- `PresentationSource.swift:131`.

**Red tests:**
- **Receipt 08** (an 11.46 s placement against an 11.444 s movie): it lands,
  `range-clamped` is on the edit result, and undo restores the prior revision.
- **Receipt 09** (render 128–143.08 s on a project ending at 139.73 s): it
  publishes clamped, with no failed job. Flip the pinned
  `apps/service/src/project-contracts.test.ts:81`, which pinned "admit, then
  fail the job". That fits neither the old principle nor the new one.
- A wholly outside range refuses with `INVALID_RANGE` and creates no job.
- One `audio.get` partial overlap.
- One trim overrun.

**Ledger.** Remove the converted range codes from `pendingConversion`.

## b. The curve-clock error names the clock

`packages/composition/src/processing.ts:139–160` throws "Processing curve must
match its clock…". This stays a refusal, because the input is malformed:
integer keys on a clip curve could mean several things. Split clock errors
from bound errors. Details carry:
- `{ clock: "clip" | "project" | "content" }`;
- the slot;
- the expected key form: a `{numerator, denominator}` fraction in [0,1] for a
  clip, or integer microseconds otherwise.

Red: receipt 07, in `temporal-processing.test.ts` (~L221).

## c. The CLI's `--wait` on `transcript.render.prepare` returns words

`apps/cli/src/wait.ts:52` re-reads prepare. Map it to `transcript.render.get`,
pinned to the published generation, the same way `transcript.prepare` is
already mapped (L180–188). The prepare/get split stays.

Red: in `apps/cli/src/wait.test.ts`, a settled render prepare yields word
rows.

## d. Docs

- `packages/composition/README.md` L106: describe the range rule.
- `skills/yap/references/media-workflows.md`: read `range-clamped` (slice 10
  owns the skill pass).

**Must stay green.**
- Point refusals.
- Strict stored-model validation.
- `wait.test.ts`'s stdout/stderr split.

**Delegated.**
- Message wording.
- Which module file hosts `admitRange`, as long as it's in composition.
