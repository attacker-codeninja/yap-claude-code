# Choices ledger

## Sound

- **Launch format 29 is the compatibility floor.** When a person opens a Yap
  library created by the launch build at 7:03 PM PDT on October 12, 2026, the
  catalog already has `PRAGMA user_version=29`, so the current readers open it
  directly. The checked-in format-22 database is older than that floor and is
  refused without rewriting bytes. This avoids pretending its recording-edit
  rows are modern project history. The plan left the exact minimum timestamp
  unspecified until the user supplied it; future catalog migrations still need
  an explicit atomic owner. **Verdict: sound. Confidence: high.**

- **Inspection remains a read-only service operation.** `inspect.open` resolves
  a project and revision, asks the already-running native app to show the
  existing preview owner, and returns bounded history. The `inspect` spelling is
  an alias for CLI discoverability. Neither call creates a revision, starts
  capture, exports media or opens a browser. The plan allowed the CLI spelling
  to be chosen. **Verdict: sound. Confidence: high.**

- **Revision history is session selection, not restoration.** The native window
  reverses the service's ascending history page so the head is first. Clicking
  a button starts the same `PreviewController` for that revision; it never calls
  `edit.restore`, and a later head refresh cannot retarget a historical choice.
  This is the browser-tab behavior the user selected. **Verdict: sound.
  Confidence: high.**

- **Derived inspection facts stay out of the catalog.** Caption proposals and
  sampled layout diagnostics are returned from read operations and use existing
  revision/transcript identities. No new table or required column was added,
  so absent derived evidence remains an unavailable read rather than a guessed
  backfill. **Verdict: sound. Confidence: high.**

- **Downloads export uses collision-safe generated names.** The inspector asks
  the existing `ExportController` to pin the selected revision, choose the
  Downloads directory and add `(1)`, `(2)`, and so on when a leaf already
  exists. The service still owns destination fencing and publication, so a
  collision cannot overwrite an unrelated file. The plan delegated punctuation
  and progress wording. **Verdict: sound. Confidence: medium.**

## Needs-user

- **The public caption proposal request carries compact transcript evidence.**
  The service validates the project/revision pin and passes the bounded entry to
  the existing `caption-proposals.mjs` pure helper. This keeps the operation
  read-only and avoids a second transcript pagination owner, but it means an
  agent that has not already read compact evidence must make that read first.
  The plan said to reuse the helper but did not settle whether the service should
  assemble the entry. Provisional call: keep the explicit evidence input until a
  measured workflow shows that a server-side compact read saves more calls;
  reversing it would add a read-only transcript assembly step without changing
  `text.seed`. **Verdict: needs-user. Confidence: medium.**
