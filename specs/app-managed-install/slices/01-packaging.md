# 01 Packaging and launcher (done, uncommitted)

**Contract.** Release apps carry the signed launcher at `Contents/Resources/bin/yap`;
every build carries `Contents/Resources/skills-installer/cli.mjs`; the launcher
looks up `$YAP_APP`, `$HOME/Applications`, `/Applications`.

**Seams.** `scripts/launcher/main.c` (`YAP_SYSTEM_APPLICATIONS` compile-time override),
`scripts/skills-installer.mjs` (`bundleSkillsInstaller(root, resources)`),
`scripts/release.mjs`, `scripts/build-macos.mjs`, `apps/macos/package.json` (`skills` 1.7.0).

**Tests.** `node --test scripts/launcher.test.mjs scripts/skills-installer.test.mjs scripts/release*.test.mjs` (24 pass).
