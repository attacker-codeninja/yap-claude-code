# App-managed install

Agents are the only install route. An agent downloads, verifies and places
`Yap.app`, then opens it; the app installs and keeps current everything else:
the `yap` command, the consumer skill and the PATH line. Before this, opening the
app installed only the skill, so a fresh app gave agents a skill without a command.

## Next Agent Prompt

*Last updated 2026-10-12.* You are resuming this feature. Read this README, then
the slice you pick up. Pre-launch: no users, no migrations, no compatibility shims.

**Status.** Shipped in **v0.1.29** (2026-10-12, `16e737ff`), built, signed and
smoke-checked locally and published; justyap.io serves the agent-only site. The full
suite passed (exit 0) before release, including fixes to pre-existing failures.

**Pick up at** the two open release-day checks below, then [close-spec](../../.agents/skills/close-spec/SKILL.md).

**Warnings.**
- Codex was at capacity throughout (planning drafts and review), so every draft and
  review was Claude, without a second model family. Two independent Claude reviews
  ran; their findings are fixed.

**TODO**
- [x] 00 Probes — [slices/00-probes.md](slices/00-probes.md)
- [x] 01 Packaging and launcher — [slices/01-packaging.md](slices/01-packaging.md)
- [x] 02 Operations — [slices/02-operations.md](slices/02-operations.md)
- [x] 03 Kit is the app only — [slices/03-kit.md](slices/03-kit.md)
- [x] 04 Home lifecycle: command, skill, PATH — [slices/04-home-lifecycle.md](slices/04-home-lifecycle.md)
- [x] 05 Settings: one "Set up my agents" row — [slices/05-settings.md](slices/05-settings.md)
- [x] 06 Launch decision: location and one copy — [slices/06-launch-decision.md](slices/06-launch-decision.md)
- [x] 07 Move to Applications — [slices/07-move.md](slices/07-move.md)
- [x] 08 Docs, skill, site — [slices/08-docs-site.md](slices/08-docs-site.md)
- [x] Full check, independent review, release v0.1.29
- [ ] Two release-day checks that need a person at the Mac (below), then close-spec

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
| Personal-build `~/.local/bin/yap` | `scripts/install-personal.mjs` (dev builds carry no launcher and never touch it; a release app on the same Mac does replace it, per C1) |
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
| Q5 | PATH block only when none of the startup files a non-interactive login shell reads (`.zshenv`/`.zprofile`; bash's `.bash_profile`/`.bash_login`/`.profile`) has an uncommented line naming `PATH` and `.local/bin`; bash gets it in the first of `.bash_profile`/`.bash_login`/`.profile` that exists; other shells get no edit; an unreadable profile is never rewritten; docs and the skill use `~/.local/bin/yap` | Predictable, runs nothing; never shadows `.profile` or corrupts a dotfile; Dock-launched agents read no profile |
| Q6 | A release build (has `SUFeedURL`) outside `/Applications` or `~/Applications` shows a playful modal ("Almost there!" / Move it home / Quit); Move copies to `~/Applications`, relaunches, trashes the original; a same-or-newer installed copy is opened instead; an older one is replaced (old to Trash) | A command pointing at a translocated path breaks; dev builds in `dist/` are exempt |
| Q7 | One release copy at a time: a second copy activates the running one and quits, before any move offer; an update relaunch proceeds; dev builds are exempt | A losing copy otherwise runs serviceless forever (observed); a move must never trash a running install; test runs use their own home |
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

Done on 2026-10-12 against the published v0.1.29:
- [x] `codesign --verify --deep --strict` on the published app, and `--strict` on its
  bundled launcher (probe P9 holds).
- [x] A `curl` download carries no quarantine attribute, so an agent install meets no
  Gatekeeper prompt.
- [x] A Sparkle update from 0.1.28 installed and relaunched once (one copy, started with
  `--yap-update-relaunch`); `~/.local/bin/yap` became byte-identical to the bundled
  launcher with no quarantine; no shell startup file changed (`~/.zshenv` already
  covers `~/.local/bin`, and `cli.status` reports `onPath`); skill installed and
  managed; service ready at 0.1.29.

Open (need a person at the Mac):
- [ ] A Safari-downloaded kit: approve with Open Anyway, then `~/.local/bin/yap capture.status --help` runs.
- [ ] The move prompt in the real app (quit the installed Yap, open the release from
  `~/Downloads`): no stray square behind the icon in light mode (seen only in the
  offscreen render), Move it home lands in `~/Applications` and never prompts again (probe P5).

## Follow-ups (not in this release)

- A missing LFS fixture reports a misleading "bytes differ"; a clear "fixture not
  fetched" error needs the six test-harness fixture loaders moved onto one owner.
