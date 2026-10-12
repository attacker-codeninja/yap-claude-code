# 00 Probes

**Contract.** Each risky assumption below is confirmed or replaced before product
code depends on it. No product code in this slice; scratch work lives outside the repo.

| # | Assumption | Probe | If false |
|---|---|---|---|
| P2 | Bytes written by the app (`Data.write` + rename) carry no quarantine | swiftc stub writes a file from an approved, quarantined app; `xattr -l` the output | Remove `com.apple.quarantine` after writing (the app is already approved) |
| P3 | Replacing a running command by rename is safe | Rename a new launcher over `~/.local/bin`-style path while the old one runs | Already the contract; pin with a test in slice 04 |
| P4 | `SecTranslocateIsTranslocatedURL` / `SecTranslocateCreateOriginalPathForURL` resolve via `dlsym` on this macOS | swiftc stub run from a quarantined copy opened in `~/Downloads` | Modal offers Quit only and names the folder to move from |
| P5 | A copy moved out of a translocated launch is not translocated again | Copy the running bundle to a scratch `Applications`, launch, check `Bundle.main.bundlePath` | Strip quarantine on the moved copy; test that the move never runs twice |
| P6 | During `--yap-update-relaunch` the old process is still visible | Log `NSRunningApplication` for `com.dzhng.yap` at launch under the flag | The flag always proceeds (already the rule) |
| P7 | The bundled installer makes no network calls when told not to | Run `cli.mjs add` with `DISABLE_TELEMETRY=1` under `sandbox-exec` deny-network | Keep the env var; add a deny-network case to `scripts/skills-installer.test.mjs` |
| P8 | `NSHomeDirectory()` equals `$HOME` for a GUI launch and honours an overridden `HOME` | swiftc stub with `HOME=/tmp/x` | One `accountHome()` helper used by every home path in slice 04 |
| P9 | A Mach-O under `Contents/Resources` passes `codesign --verify --deep --strict` | FFmpeg under Resources is precedent; check at first local release package | Move the launcher to `Contents/MacOS/yap-launcher` |

**Delegated.** Probe mechanics. **Record** each outcome in this table (a Result
column) before slice 04 starts.

## Results (2026-10-12, macOS 27.0 arm64)

| # | Result | Consequence |
|---|---|---|
| P2 | Holds: `Info.plist` has no `LSFileQuarantineEnabled` and the app is not sandboxed, so files it writes are not quarantined | Slice 04 test still asserts no xattrs on the written command |
| P3 | Not run separately; rename-over is the contract | Slice 04 pins it |
| P4 | Holds: both symbols resolve via `dlsym` | Slice 06/07 use them, still degrading to Quit-only if absent |
| P5 | Open; needs a real translocated launch | Slice 07 human check |
| P6 | Not run; the rule is "update relaunch always proceeds" regardless | — |
| P7 | Holds: `cli.mjs add <skills/yap> --all --global --yes` with `DISABLE_TELEMETRY=1` under a deny-network sandbox exits 0 in 0.3 s; "Failed to install 2" is Eve and PromptScript (no global support) | Keep the env var |
| P8 | **False**: `NSHomeDirectory()` ignores an overridden `HOME` (returned the account home with `HOME=/tmp/fakehome`) | Slice 04 adds `accountHome()` = `$HOME` if set, else `NSHomeDirectory()`, for every home path; the launch lock stays on the passwd home |
| P9 | Open; checked at the first local release package | — |
