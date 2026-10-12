# 06 Launch decision: location and one copy

**Contract.** One ordered pure function decides whether a launch proceeds:
1. `--yap-update-relaunch` → proceed.
2. Not a release build → proceed (dev and test runs work beside an installed Yap).
3. Another running `com.dzhng.yap` → `handOff(pid)`: activate it and quit. Before the
   location rule, so a move never trashes a running install.
4. Outside `/Applications` and `$HOME/Applications` → `offerMove(original:)`
   (translocated launches resolve the original, probe P4).
5. Otherwise proceed.
It runs first in `applicationDidFinishLaunching`, before `startService`.

**Seams.** `LaunchDecision.swift`: `decide(bundle:, home:, isRelease:, arguments:, running:) -> Decision`;
`isRelease` = `SUFeedURL` present (as `SparkleDriver`). `CommandArtifact` takes its
"in an Applications folder" input from here.

**Tests.** `launch-decision.test.mjs` table: "dev build anywhere proceeds", "both Applications folders proceed",
"Downloads offers a move", "translocated offers a move of the original", "second copy hands off",
"update relaunch never hands off", "`~` is `$HOME`".

**Firewall.** No file moves (slice 07), no service changes.
