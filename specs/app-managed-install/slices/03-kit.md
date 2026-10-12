# 03 Kit is the app only

**Contract.** `Yap-macos-arm64.zip` contains `Yap.app` and `release.json`; no top-level `yap`.

**Seams.** `scripts/release.mjs` (drop the kit copy), `scripts/release-smoke.mjs`
(verify the bundled launcher, assert no top-level `yap`), `scripts/installed-update-lab.mjs`
(`--launcher` comes from the app's `Contents/Resources/bin/yap`).

**Tests.** `release-smoke.test.mjs`: "kit holds only the app and its receipt",
"bundled launcher verifies". Existing release tests stay green.

**Firewall.** No Swift, no docs. **Delegated.** Fixture layout.
