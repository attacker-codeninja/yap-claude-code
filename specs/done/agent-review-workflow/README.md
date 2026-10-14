# Agent review workflow

Yap now gives an agent and a person one native review surface for a selected
project revision. An agent can ask the app to inspect a pinned revision, and the
person can switch through its history, watch the existing native MP4 preview,
read bounded transcript and layout evidence, and export the selected revision to
Downloads. The workflow keeps the product boundary intact: Yap supplies
evidence and reversible primitives; the caller decides what the video should
become.

The native preview remains the single owner of preview identity, delivery leases,
playback and close/reopen fencing. The service resolves revision identity and
history through `ProjectStore`; the app routes both Library and agent requests
through `PreviewController` and `PreviewWindow`. The timeline is a session
selection: choosing an older revision changes the preview pin without restoring
or mutating the project. `RevisionTimelineState` documents the rule that a head
refresh never silently changes a historical selection.

Inspection operations are deliberately read-only. `inspect.open` and its `inspect`
alias resolve a project/revision and return bounded history plus an app-open
acknowledgement. `caption.propose` reads one bounded project transcript page
internally and reuses the existing pure `skills/yap/scripts/caption-proposals.mjs`
helper; `text.seed` remains the only caption mutation. `layout.diagnostics`
reports sampled clipping, off-canvas, overlap, glyph and fallback evidence and
marks coverage as sampled rather than claiming continuous readability. These
operations add no catalog columns because all of their facts are derived.

The compatibility floor is the launch build at 7:03 PM PDT on October 12, 2026
(Yap 0.1.33). Launch catalogs already use catalog format 29 and open unchanged.
Pre-launch catalogs are outside the support floor and are refused byte-for-byte.
A future migration must be explicit, additive, atomic and recoverable; the
current feature does not need one.

The inspector's Export action uses `ExportController` and the existing
`export.create`/`export.status` lifecycle. It pins the selected revision, chooses
`~/Downloads`, generates a filename from project/revision identity and adds a
numeric suffix when the leaf already exists. Publication and destination safety
remain service-owned, so source media is never overwritten.

Library and inspector drawing uses semantic AppKit colors and effective-appearance
updates. No browser renderer, WebView, GPU rewrite or arbitrary speech-driven
geometry layer was added. The ManimGX reference supplied the idea of bounded
inspection evidence; Yap retains its native renderer and AVPlayer path.

The operation contract lives in [protocol operations](../../../packages/protocol/src/operations.ts).
Service routing and the read-only proposal/diagnostic boundary live in
[`project-service.ts`](../../../apps/service/src/project-service.ts), while pure
sampled diagnostics live in
[`layout-diagnostics.ts`](../../../packages/core/src/layout-diagnostics.ts).
Native ownership is in
[`PreviewController.swift`](../../../apps/macos/Sources/Yap/PreviewController.swift),
[`PreviewWindow.swift`](../../../apps/macos/Sources/Yap/PreviewWindow.swift),
[`RevisionTimeline.swift`](../../../apps/macos/Sources/YapControls/RevisionTimeline.swift)
and [`ExportController.swift`](../../../apps/macos/Sources/Yap/ExportController.swift).
The focused contracts are pinned by the protocol, service, core, Swift controls
and preview-control tests adjacent to those owners.

The repository-wide `bun test` gate was attempted once. It reached broad existing
checks, but this checkout could not satisfy the native release environment:
there was no built app/native worker or Sparkle fixture, Screen Recording and
other permissions were unavailable, Node 24 was absent, and several suites ran
under Bun where they require Node/Vitest APIs. The focused feature checks passed;
those environment failures remain explicit rather than being presented as
feature evidence.

The inspiration reference was the user's ManimGX X post and its agent
instructions. No local screenshot baseline was available in this implementation;
the native Library's existing light/dark regression behavior remains the visual
standard.
