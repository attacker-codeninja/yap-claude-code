# 01 — 0.1.33 compatibility and native open spike

## Contract unlocked

The current app can read the launch-version 0.1.33 fixtures and open one pinned
native preview/inspection session from an agent request without starting capture,
opening a browser or creating a second renderer.

The catalog check from slice 00 runs before this spike. Prove that current
format-29 readers admit the retained 0.1.33 recording and resolve the same
Library entries, then create/resolve a
current project revision for the new workflow. Add a media/parser branch only
if the fixture shows a concrete persisted-shape difference.

## API seam

Add the smallest internal/native handoff needed for an `inspect.open` intent:
`projectId`, optional `revisionId` and optional bounded preview range. The intent
is read-only and carries no edit or export instruction. It must resolve through
the existing service/app lifetime owner and route to the existing
`PreviewController`/`PreviewWindow` owner.

The spike may use a private probe or fixture command while the durable public
operation is designed in slice 01. Do not leave a second long-lived handoff
protocol after slice 01 lands.

## Evidence and tests

- Identify `fixtures/launch-video/provenance.json` (which records Yap 0.1.33),
  its retained session recording/source and the corresponding project records.
- Record whether the fixture is source-only and needs an explicit current project
  creation before revision-based preview/inspection; do not imply that a source
  recording from 0.1.33 already contains a modern project history.
- Exercise current public reads, revision resolution and preview preparation on
  that fixture without rewriting it.
- Prove missing, stale and deleted identities refuse honestly.
- Prove app launch/reuse, service unavailable, app already running, late reply,
  close and capture exclusion behavior.
- Keep a receipt with fixture identity, selected revision, operation responses and
  hashes. Do not claim native media readiness from portable-only checks.

## Playable checkpoint

Run the spike fixture and see one native `AVPlayerView` preview window open for a
0.1.33-compatible project/revision. Closing it releases the lease; opening a
second target cannot be resurrected by a late first response.

## Visual gates

Capture the native preview in light and dark surrounding app contexts where the
window changes. Run `screenshot-critique` last; use `compare-screenshots` only
where a current preview baseline exists; open shots with `preview-shots`.

## Delegated implementation freedom

The implementer may choose the private fixture harness and IPC mechanism, but
must preserve one PreviewController owner, no capture start, exact identity pins
and the stated failure fences.
