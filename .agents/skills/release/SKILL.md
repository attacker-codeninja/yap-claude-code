---
name: release
description: Release this repository's current work to everyone. Use when the user asks to ship a version, push to main and tag, or publish an app update.
---

# Release

Carry the scoped work through review, main integration and a published release.
Read the [release guide](../../../scripts/README.md#versioned-github-releases)
for the process; use its linked code as the authority for commands and packaging.

1. Fetch main and tags. Preserve unrelated work and integrate the intended changes
   with current main. Run [review](../review/SKILL.md) over the complete release diff;
   reuse valid checks and verify integration fixes narrowly.
2. Before changing the version or pushing a tag, read the release guide credential
   section and run `releaseSigningInputs()` itself. On a suitable Apple Silicon Mac,
   local signing is mandatory: inspect the documented ignored credential directory
   before considering any fallback. Do not infer missing credentials from the shape
   of the helper's return object, and do not push a tag until the local signed
   package and both relocated smoke checks pass.
3. Choose the next unused version from the manifest and published releases unless
   the user supplied one. Update the [app manifest](../../../apps/macos/package.json)
   and [release notes](../../../scripts/release-notes.md), then commit.
4. Validate version/tag agreement through the release tool. Push main first, then
   push an annotated version tag only after the local package gates pass. Never
   force-push main, move a published tag or replace published assets.
5. Build on the available Apple Silicon Mac and upload the verified package
   directly to GitHub Releases through the local publication owner. Generate the
   per-version `NOTES.md` with `node scripts/release-notes.mjs TAG`, then run
   `node scripts/release-publish.mjs dist/release TAG REVISION`. A tag push must
   not be used to select a competing GitHub build. The tag workflow is manual
   fallback infrastructure only, for an unavailable local Mac or an explicit
   request to use Actions.
6. Build from the tag's exact commit. If main advances, use a temporary checkout
   pinned to the tag; preserve unrelated work. Reuse valid prepared dependencies,
   keep build output private to its source checkout, and verify the package receipt
   matches the tag before publishing the complete asset set. Remove the temporary
   checkout afterward.
7. Verify the public release and its assets. If installation was requested,
   follow the consumer installation procedure linked by the release guide, using
   the downloaded published kit; verify checksums, installed version and service
   health without recording or granting capture permissions.
8. Finish with the version, main commit and release URL. A pushed tag alone is
   not a published update; report any publication blocker and unverified limits.

## Signing credentials

- The local release path reads `.release-signing/` automatically when environment
  variables are unset. This path is the normal release path on a suitable local
  Mac; GitHub Actions is a manual fallback, not an automatic substitute.
- Reuse the production signing certificate and Sparkle key. A product or repository
  rename does not require rotating either, even if the certificate subject carries
  the old name. Missing local credentials are a restore task, not a reason to
  generate replacements. GitHub Actions secrets cannot be read back for local use.
- Follow the release signing owner for credential inputs. Keep secret files
  restricted and pass secrets without printing them or placing them in shell
  history, logs, source control or release assets. Keep personal backup locations
  and private restore instructions outside the repository.
- Rotate only when necessary. If credentials change, update the private backup
  and restore instructions, GitHub credentials and public fingerprints together;
  verify a future developer can restore and sign, and preserve update trust.
