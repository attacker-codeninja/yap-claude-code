# 05 Settings: one "Set up my agents" row

**Contract.** One row, "Set up my agents", one toggle (preference `setUpAgents`,
default on, replacing `installSkill`), and one status line from `HomeLifecycle.summary()`,
e.g. "yap command + skill, kept current. All good ✓" or a short problem.
Toggling calls `HomeLifecycle.setEnabled`.

**Seams.** `YapControls/Preferences.swift`, `SettingsWindow.swift` (the `SkillLifecycle`
protocol becomes the `HomeLifecycle` interface the model calls).

**Tests.** `update-settings.test.mjs`: "agent setup defaults on and turns both off and on";
`SettingsTests.swift`: the preference persists. Offscreen shot via
`apps/macos/tests/settings-view-shots.mjs`; run **screenshot-critique** on it as the
last check, and **compare-screenshots** against the previous General section shot.
Non-blocking review: open the shot with preview-shots, wait ~5 min, then decide and record.

**Firewall.** No lifecycle behavior changes.
