# 01 Stale derived generations self-recover

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
  (`apps/service/src/prepared-audio.ts` ~L254). Assert it, so slice 03's
  rename re-keys failed jobs.
- **Firewall:** no `catalogFormat` bump; additive tables only.

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
- `portable-assets.test.ts`: importing a package that holds a stale-recipe
  transcript succeeds, and the transcript regenerates.
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
