# 00 — launch-floor catalog compatibility boundary

## Contract unlocked

An existing Yap Library opens without unnecessary migration when its catalog is
already current (0.1.33 used format 29). Pre-launch catalogs are outside the
support floor and are refused byte-for-byte. The catalog owner retains one clear
place for a future explicit migration boundary rather than guessing how old
recording-edit rows map to modern project history.

## API and ownership seam

Keep the existing catalog owner around `Catalog` and `catalogFormat`; do not
create a second catalog model. The launch floor is format 29. Before any future
older-format migration is admitted, it must be routed through one versioned
owner with a temporary copy/backup and atomic publication.

Any future destination preserves row identities and relationships. New optional
fields or additive tables are empty/absent when old data cannot establish them; a
migration may not invent transcripts, project edits, media bindings or export
receipts. Format-22 recording revisions remain legacy provenance and are never
relabeled as project revisions.

## Required discovery

- Confirm that the 0.1.33 catalog format is 29 and therefore needs no migration.
- Reuse `packages/core/fixtures/catalog-format-22.sqlite` as the pre-launch
  refusal/provenance case; its old recording-edit rows are not current project history.
- Inventory tables, columns, indexes, identity references and media paths before
  writing migration code.
- Confirm whether old catalogs contain projects/revisions or only recordings;
  preserve what exists and report what cannot exist in the source format.

## Tests and checkpoint

- Open a copied launch-era format-29 catalog through ordinary recording reads and
  Library listing; verify identities and media bytes are unchanged.
- Exercise the pre-launch format-22 refusal and prove its bytes remain intact.
- Keep future interrupted, malformed and atomic migration tests at this boundary
  when a supported older format is intentionally added.

Playable checkpoint: open a copied launch-era Library and see the same recordings
and projects in the current Library, then ask the agent to inspect/edit one
without touching the original catalog or source media.

## Visual and human gates

The compatibility boundary itself is data-only. The first visual checkpoint is the
Library in light and dark appearance; run `screenshot-critique` last, compare
against the current Library baseline when applicable, and open shots with
`preview-shots`. Human review is non-blocking.

## Delegated freedom

The implementer may choose the future migration owner's temporary backup and
transaction mechanics. They may not weaken refusal of unsupported pre-launch
files, identity preservation or the additive catalog-evolution rules.
