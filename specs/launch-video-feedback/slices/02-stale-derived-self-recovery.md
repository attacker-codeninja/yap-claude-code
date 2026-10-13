# 02 Stale derived generations self-recover

**Unlocks.** A transcript row whose recipe or policy identity isn't current is
*stale*:
- every read and inventory skips it;
- cleanup can reclaim it;
- the next request regenerates it.

0.1.33 libraries and recordings open unchanged, so later slices can bump
identities safely.

**Why first.** `metadata()` (`packages/core/src/transcript.ts` ~L1216) parses
`execution` against a strict literal of the *current* recipe. Bump the recipe
today and every old row throws a ZodError in each of these:
- `retainedGeneration` (text seeds);
- `portableGenerations` (project package export,
  `apps/service/src/project-packages.ts` ~L501);
- package staging (`transcript.ts` ~L563).

Fresh lookups already recover. `sourceStatus` keys jobs by an input hash that
includes the recipe (`transcript-processing.ts:110–128`), and
`transcript.review` re-prepares `not_requested`
(`apps/service/src/project-service.ts:1940`). But retained artifact rows keep
their attempts, so cleanup never reclaims them.

**Seam.**
- `transcript.ts` reads `metadata()` with `safeParse`. A row that fails or
  carries a foreign recipe/policy is stale and is filtered from:
  - `retainedGeneration`;
  - project transcript reads;
  - `portableGenerations`;
  - package staging.
- The jobs layer forgets artifact rows whose input policy is stale, so
  `cleanupAsset` reclaims them.
- On package import, a stale transcript is dropped and regenerated rather
  than refusing the package (decided; see README).
- Normalization's `implementationId` (`apps/service/src/audio-processing.ts`
  ~L48) must be part of the prepared-audio job key
  (`apps/service/src/prepared-audio.ts` ~L254). Assert it, so slice 04's
  rename re-keys failed jobs.
- **Firewall:** no `catalogFormat` bump; additive tables only.

**Rules that every later slice relies on.**
- **Every converted refusal bumps its producer's identity in the job input.**
  This covers the speech recipe and policy, and the normalization and limiter
  implementation ids (`apps/service/src/audio-processing.ts` ~L48).
  - Jobs are keyed by input.
  - A failed, non-retryable 0.1.33 job keeps answering for that input:
    `submitJob` reuses it, and `status` reports `failed`
    (`packages/core/src/jobs.ts` L565–622, L897–918).
  - `prepareSource` only submits when `not_requested`
    (`transcript-processing.ts` L283).
  - Without a bump, a fixed gate would still answer "failed" for every old
    input.
- **Retained reads parse execution with a historical schema.** It accepts any
  recipe string and marks the row stale. Only newly produced rows must match
  the current recipe. `metadata()` (`transcript.ts` ~L1226) must never throw a
  raw ZodError.
- **Export.** Project export leaves stale derived generations out and says so
  with an issue (slice 01), instead of crashing in `portableGenerations`.
- **Import.** A stale derived resource is skipped with an issue and
  regenerated, instead of failing the package with `INVALID_PACKAGE`
  (`project-package.ts` ~L118).
- **Replays.** Retained evidence keeps its historical recipe
  (`packages/test-harness/speech/timing-replay.mjs` over
  `08-bounded-speech/replay-cases.json`). Replays admit historical recipes as
  evidence and never relabel them.

**Red tests first.**
- `packages/core/src/transcript-ownership.test.ts`:
  1. Publish a generation, then rewrite its stored `execution.recipe` to a
     foreign id.
  2. Call each of these:
     - `transcript.review` for an asset and for a project;
     - `transcript.get` with that generation;
     - project package export;
     - text seeding.
  3. Expected today: a ZodError. Expected after: the generation is
     skipped or regenerated, and `cleanupAsset` reclaims it.
- `portable-assets.test.ts` / `apps/service/tests/project-package-export.mjs`:
  exporting with a stale generation succeeds, with an issue. Importing a
  0.1.33-shaped package succeeds, skips the stale transcript, and
  regenerates it.
- A scratch catalog seeded with a failed 0.1.33 `NORMALIZATION_NOT_FEASIBLE`
  job. After the slice 04 identity bump, `audio.measure` re-runs instead of
  answering "failed". Write this test here; it turns green in slice 04.
- `timing-replay.mjs` still admits the retained v2 cases.
- The prepared-audio key includes `implementationId`.

**What a human can see.** Point the dev service at a copy of a 0.1.33 library.
`transcript.review` on an old asset returns a fresh generation, not an error.

**Must stay green.** Every existing `transcript*.test.ts`, `catalog` tests,
and capture-store tests.

**Delegated.** How a stale row is detected (parse failure versus identity
comparison), as long as both foreign recipe and foreign policy count, and the
helper's name.

**Would change this slice.** If recovery turns out to need a catalog shape
change, stop and ask the user. Their rule outranks the plan.
