# 02 — public inspect contract

## Contract unlocked

Agents can discover and invoke a bounded `yap inspect` flow without assembling
the native-open and existing timeline/review helper orchestration themselves.

## API seams

`inspect.open` is a read-only public operation available through protocol, CLI,
MCP and the native app adapter. It validates a project identity and optional
revision/range, returns the pinned identity and an app-open acknowledgement, and
never edits or exports.

## Tests and checkpoint

Test protocol help/schema parity across CLI and MCP, malformed identity and stale
revision errors, bounded output and replay. Prove `inspect.open` never edits,
exports or starts capture, and that CLI/app responses retain the same project and
revision identity.

Playable checkpoint: an agent runs `yap inspect --help`, invokes inspection for a
pinned project revision, and receives a bounded receipt plus native-open intent.

## Delegated freedom

The implementer may choose the public CLI spelling behind the documented
`yap inspect` entry point and the response envelope's presentation grouping, but
operation meaning, bounds, identity pins and read-only behavior are fixed.
