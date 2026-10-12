# 07 Move to Applications

**Contract.** On `offerMove`, a modal: title "Almost there!", text "Yap's camping in
<folder>. Let's move it home to Applications so your agent can find it.", buttons
**Move it home** (default) and **Quit**. Move: if `$HOME/Applications/Yap.app` or
`/Applications/Yap.app` holds a same-or-newer version (`CFBundleVersion`), open it and
trash this copy; if older, trash it and replace it; otherwise copy to
`$HOME/Applications`. Then relaunch the installed copy and trash the original.
If the original cannot be resolved, Move is unavailable and the text names the folder.

**Seams.** `AppRelocator` with injected effects (`copy`, `trash`, `open`, `versionAt`).

**Tests.** `app-relocator.test.mjs` (recorded effects): "fresh move copies, relaunches, trashes",
"same-or-newer opens installed", "older installed is replaced", "move never runs twice" (P5).
Modal shot via the offscreen renderer; run **screenshot-critique** as the last check.
Human check: a local build with quarantine set by hand, opened from `~/Downloads`.

**Firewall.** No lifecycle changes.
