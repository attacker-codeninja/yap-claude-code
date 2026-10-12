# 08 Docs, skill, site

**Contract.** Everything public describes this release.
- README agent setup and `installation.md`: check the Mac, download the kit by its
  fixed name, verify `SHA256SUMS`, place `Yap.app` (update an existing copy in place,
  else `~/Applications`), open it, then check `yap cli.status`, `skill.status`,
  `service.health`; report a short checklist (A2). Manual `npx skills add` and launcher
  copy become a fallback only when the app reports a problem.
- `skills/yap/SKILL.md` Installation: fall back to `~/.local/bin/yap` by full path;
  warn about a project-level `yap` skill copy (Q2b), in two sentences.
- `skill-lifecycle.md`, `capability-catalog.md` (`cli.*`, one Settings row),
  `apps/macos/README.md`, `scripts/README.md`, `scripts/release-notes.md` (no download step).
- Site (`apps/site`): no download button or release lookup; the sticky note with
  Open in Claude Code, Open in Codex, Copy prompt; prompt P2; human steps become "paste
  this into your agent"; `llms.txt` per the above.

**Tests.** `apps/site/build.test.mjs`: "no download link", "both deep links encode the prompt".
Site shots at 1280 and 375 px; run **screenshot-critique** last and **compare-screenshots**
against the current deployed page. Deploy after release.

**Firewall.** No code outside `apps/site`.

**Deploy.** Vercel project `justyap` on the user's personal scope ("David Zhang's
projects"), `SITE_URL=https://justyap.io`; `www.justyap.io`, `justyap.dev` and
`www.justyap.dev` redirect via `apps/site/vercel.json`. Once merged, connect the repo
with Root Directory `apps/site`; until then deploy the built `dist/` directly.
