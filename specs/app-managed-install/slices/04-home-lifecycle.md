# 04 Home lifecycle: command, skill, PATH

**Contract.** With `setUpAgents` on, every launch of an app in an Applications
folder leaves `~/.local/bin/yap` byte-identical to the bundled launcher (release
builds), every global `yap` skill replaced by the bundled one, and the PATH block
present only when needed. No host Node, npm or network. `cli.*` and `skill.*`
answer through one owner.

**Seams** (all under `apps/macos/Sources/Yap/`):
- `AppResources` — `{ node, launcher?, skillSource?, skillsInstaller? }` from
  `Bundle.main`, `init(root:)` for tests. Replaces `SkillManager.bundledSource()`.
- `HomeLifecycle` — `handle(_ operation) -> Result<Data, ServiceFailure>` routing
  `skill.*` and `cli.*`; `reconcile(enabled:)` at launch; `setEnabled(_:)` from
  Settings; `summary() -> String` for the Settings status line.
- `SkillArtifact` (was `SkillManager`) — runs `<node> <skillsInstaller> add|ls …`
  with `DISABLE_TELEMETRY=1`; `npxExecutable` deleted; behavior otherwise unchanged
  (replaces every global `yap`, backup restored on failure).
- `CommandArtifact` — install: read launcher bytes, write `yap.installing-<pid>`
  in `~/.local/bin`, chmod 755, rename. Uninstall: remove only while byte-identical,
  remove only the marked block. `unavailable` with no bundled launcher or when the
  launch decision (slice 06) says the app is outside an Applications folder;
  until slice 06 lands that input is `true`.
- `ShellProfile` (pure) — `covered(files: [String: String]) -> Bool`,
  `adding(to:)`, `removing(from:)`, `target(shell:)` (`.zprofile`, bash `.bash_profile`).
- `main.swift` routes by prefix (`skill.`, `cli.`) instead of a hard-coded list;
  `RecordingControls` holds one `HomeLifecycle`.
- Home: `accountHome()` per probe P8.

**Tests** (swiftc + stub + temp HOME, like today's `skill-lifecycle.test.mjs`):
- `cli-lifecycle.test.mjs`: "install writes fresh bytes without quarantine",
  "install replaces a different file", "uninstall keeps a modified command",
  "status is unavailable without a bundled launcher".
- `shell-profile.test.mjs`: "an uncommented PATH .local/bin line in any startup file suppresses the block",
  "a commented line does not count", "add is idempotent", "remove deletes exactly the block", "bash targets .bash_profile".
- `skill-lifecycle.test.mjs`: "installs with no npx on PATH" (a poisoned `npx` stays unused), plus the existing discovery case.
- `home-lifecycle.test.mjs`: "routes skill and cli by prefix", "reconcile installs both when enabled".

**Firewall.** No Settings UI, no location logic, no docs.
**Delegated.** Internal names below the seam, error wording.
