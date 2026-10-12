# App-managed install

Agents are the only install route. An agent downloads, verifies and places
`Yap.app`, then opens it; the app installs and keeps current everything else:
the `yap` command, the consumer skill and the PATH line. Before this, opening the
app installed only the skill, so a fresh app gave agents a skill without a command.

## Next Agent Prompt

*Last updated 2026-10-12.* You are resuming this feature. Read this README, then
the slice you pick up. Pre-launch: no users, no migrations, no compatibility shims.

**Status.** Slices 01 (packaging and launcher) and 02 (operations) are implemented
in the working tree, uncommitted, with their tests green. Everything else is open.

**Pick up at slice 00 (probes)**, then build 03 → 08 in order. Each slice names
its tests; run only those. Run the full check once, after slice 08, then release
with the `release` skill (the user delegated tagging).

**Warnings.**
- The release kit still contains a top-level `yap`; slice 03 removes it.
- `skills` installer: set `DISABLE_TELEMETRY=1` when the app runs it (probe P7).
- Codex was at capacity during planning; all three drafts were Claude. A Codex
  review of the finished diff is the substitute second-family check.

**TODO**
- [ ] 00 Probes — [slices/00-probes.md](slices/00-probes.md)
- [x] 01 Packaging and launcher — [slices/01-packaging.md](slices/01-packaging.md)
- [x] 02 Operations — [slices/02-operations.md](slices/02-operations.md)
- [ ] 03 Kit is the app only — [slices/03-kit.md](slices/03-kit.md)
- [ ] 04 Home lifecycle: command, skill, PATH — [slices/04-home-lifecycle.md](slices/04-home-lifecycle.md)
- [ ] 05 Settings: one "Set up my agents" row — [slices/05-settings.md](slices/05-settings.md)
- [ ] 06 Launch decision: location and one copy — [slices/06-launch-decision.md](slices/06-launch-decision.md)
- [ ] 07 Move to Applications — [slices/07-move.md](slices/07-move.md)
- [ ] 08 Docs, skill, site — [slices/08-docs-site.md](slices/08-docs-site.md)
- [ ] Full check, Codex review, release, release-day checklist (below)

Update this section before ending your pass.

## Contracts

- **Release kit.** `Yap-macos-arm64.zip` (fixed name) contains `Yap.app` and
  `release.json` only. `releases/latest/download/Yap-macos-arm64.zip` always
  resolves; consumers find the kit as the ZIP that `SHA256SUMS` names.
- **Bundle.** Release apps carry the signed launcher at `Contents/Resources/bin/yap`.
  Every build carries `Contents/Resources/skills-installer/cli.mjs` (pinned
  `skills@1.7.0`, single file), run with the bundled Node.
- **Operations.** `cli.status`, `cli.install`, `cli.uninstall` (synchronous, `{}`)
  beside `skill.status/install/update/uninstall`. Status JSON:
  `{ state: installed|missing|different|unavailable|needs_attention, path, onPath, profile?, error? }`.
- **Preference.** One key, `setUpAgents` (default on), replaces `installSkill`.
  Settings shows one row, "Set up my agents", with one status line.
- **Launcher lookup.** `$YAP_APP`, `$HOME/Applications/Yap.app`, `/Applications/Yap.app`, after the shared lock.
- **Shell profile block**, added only when no startup file already puts
  `.local/bin` on PATH, removed exactly on uninstall:
  `# >>> yap >>>` / `export PATH="$HOME/.local/bin:$PATH"` / `# <<< yap <<<`.
- **Agent prompt** (the README "Get started" quote must match; the site build checks):
  "Install Yap (the Mac app, which sets up the yap CLI and skill) by following https://justyap.io/llms.txt".

## Single owners

Each concept has one owner; no slice adds a second.

| Concept | Owner |
|---|---|
| Release kit contents and name | `scripts/release.mjs` |
| Which `Yap.app` a command uses | `scripts/launcher/main.c` |
| Bundled resource locations | `AppResources` (new, slice 04) |
| Things the app installs into home (command, skill, PATH block) and their reconcile | `HomeLifecycle` (new, slice 04); `SkillArtifact` and `CommandArtifact` are its parts |
| Whether this launch proceeds | `LaunchDecision` (new, slice 06): update relaunch, location, one copy — one ordered function |
| Personal-build `~/.local/bin/yap` | `scripts/install-personal.mjs` (dev builds carry no launcher, so the app reports `unavailable` and never touches it) |
| Human and agent install text | README agent setup + `skills/yap/references/installation.md`; the site's `llms.txt` links to them |

## Decisions

From the quadrant walk. *Agent default* marks choices made on the user's behalf
and disclosed at the time; everything else the user chose.

| | Decision | Why |
|---|---|---|
| D1 | Agents are the only install route; the site has no download button | Agent downloads carry no quarantine, so no Gatekeeper step; one installer |
| D2 | The prompt points at `https://justyap.io/llms.txt`, wording P2 (above) | One owner for agent text |
| Q1 | The command is written as fresh bytes (temp file + rename), never a copy keeping xattrs | Measured: a quarantine-preserving copy stays blocked after the app is approved; fresh bytes run |
| Q1b | No notarization now | Paid membership deferred; agent installs avoid the prompt anyway |
| Q2 | Every launch replaces every global skill named `yap` with the bundled one; no other skill touched | A skill named yap is always the official one once the app is installed |
| Q2b | The skill warns about a project-level `yap` copy in the current folder; never deletes | The app cannot scan every project |
| Q3 | Site: sticky note with Open in Claude Code (`claude-cli://open?q=`), Open in Codex (`codex://new?prompt=`), Copy prompt | Both links pre-fill without sending (Codex verified on a real Mac); copy always works |
| Q4 | Bundled pinned installer, run with the app's Node; host `npx` search deleted | No Node or npm needed; proven to make no shell-outs |
| Q5 | PATH block only when no startup file has an uncommented line naming `PATH` and `.local/bin`; the skill falls back to `~/.local/bin/yap` | Predictable, runs nothing; Dock-launched agents read no profile |
| Q6 | A release build (has `SUFeedURL`) outside `/Applications` or `~/Applications` shows a playful modal ("Almost there!" / Move it home / Quit); Move copies to `~/Applications`, relaunches, trashes the original; a same-or-newer installed copy is opened instead; an older one is replaced (old to Trash) | A command pointing at a translocated path breaks; dev builds in `dist/` are exempt |
| Q7 | One copy at a time: a second copy activates the running one and quits; an update relaunch waits for the exiting copy instead | A losing copy otherwise runs serviceless forever (observed) |
| Q8 | One spec, committed slices, one release | `main`'s install docs must never describe behavior the latest release lacks |
| R3 | One Settings row and one preference for command + skill, with a status line | User pick; operations stay separate for agents |
| A2 | The agent's install report is a short checklist | User pick |
| C1 | *Agent default:* a release app always makes `~/.local/bin/yap` its bundled launcher; uninstall removes it only while byte-identical | Same intent as Q2; no adoption machinery pre-launch |
| K1 | The kit drops its top-level `yap` | Two drafts independently: the app is the only installer of the command |

Context: the audience is developers already using Claude Code or Codex; the
existing installs are the user and a few testers, so auto-update is enough.

**Rejected alternatives.** Notarizing first (blocked on enrollment). Asking the
login shell for PATH (runs user shell setup from the background). Moving
`/Applications` installs to `~/Applications` (needs admin, resets permissions).
Tracking project-level skills (disk scan). Allowing two copies with recovery.
Shipping each slice as its own release (docs in transition across releases).

## Release-day checklist (provable only with a signed release)

- A Safari-downloaded kit: approve with Open Anyway, then `~/.local/bin/yap capture.status --help` runs.
- An agent `curl` install: no Gatekeeper prompt at all.
- A Sparkle update from the previous release relaunches once, keeps one copy, and refreshes the command.
- `codesign --verify --deep --strict` on the published app.
