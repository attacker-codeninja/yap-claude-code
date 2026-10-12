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
