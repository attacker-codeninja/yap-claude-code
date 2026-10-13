# 02 Output by default: one `issues` contract

**The principle (set by the product owner, 2026-10-12).** If an operation can
produce an output, it produces it. Every problem is reported as an issue
attached to that output.

Refusal is reserved for:
- **Malformed input.** A wrong shape or clock, or a value outside the domain.
- **Ambiguous input.** An identity or match isn't unique.
- **Identity or revision conflicts.** For example, a stale revision, a changed
  source or artifact, or a request conflict.
- **Resource bounds.** Byte, occurrence or time budgets.
- **Missing prerequisites.** The source or model needed doesn't exist.
- **Destructive or irreversible actions.** Deletion, capture control, or
  overwriting a publication.

A quality, tolerance or target miss on cheap, undoable work is an issue, not a
refusal. "Cheap and undoable" means derived artifacts, revisions, previews,
measurements and exports to new files.

This doesn't conflict with the product boundary (zero editorial decisions).
Publishing a flagged result isn't an editorial decision; the caller still
decides what to do with it. It replaces the closed spec's "a failed quality
gate is a product boundary" for cheap, undoable work.

**Unlocks.** One shared shape every later slice uses, instead of today's ad hoc
`violations[]`, `failedGates[]`, `omitted[]` and the `issues[]` that
`packages/core/src/project-window.ts` builds and then throws.

**Seam.**
- `packages/protocol` owns `issueSchema`:
  - `code`, a stable string such as `boundary-unresolved`, `targets-unmet` or
    `range-clamped`;
  - `message`;
  - an optional `range` (`SelectionRange`) and `scope` (clip, track, word,
    channel);
  - `details`.

  Results that can carry issues add `issues: Issue[]`, empty when clean.
- No severity enum yet. Every issue is something the caller should look at;
  add severity only when a real consumer needs it.
- Existing result-level fields stay where they are. `unavailable` ranges keep
  their meaning; issues add to them and don't replace them.
- Migrate the existing ad hoc lists to `issues` where they're in a result path:
  - subject framing `violations` (`packages/composition/src/subject-framing.ts`);
  - caption sidecar `omitted` / `discardedStyling` / `addedOverlaps`
    (`caption-sidecars.ts`);
  - the speaker-continuity `failedGates` reported on the receipt.

  Each keeps its specific codes. One concept, one owner: delete the old field
  in the same change.

**Docs rewritten in this slice.** These currently state the opposite principle:
- `packages/core/README.md` ~L34–36: normalization refuses missed targets.
- `apps/service/README.md` ~L222–223: dynamic refuses a missed target.
- `skills/yap/references/media-workflows.md` ~L50–52: "when a seam is
  refused".
- `skills/yap/references/dialogue-finishing.md` L43: "Strict refusal…".
- `specs/done/video-editing-feedback/README.md`: add a forward pointer only.
  Closed records keep their original wording.

State the principle once in `README.md` "Product boundary" and in `AGENTS.md`.
Run [audit-agents](../../../.agents/skills/audit-agents/SKILL.md) before
changing `AGENTS.md`. Statements that remain true stay: "missing source
support refuses" is a missing prerequisite, and "incompatible catalogs refuse"
is an identity conflict.

**Red tests first.**
- `packages/protocol`: the schema round-trips, and a result without issues
  carries `issues: []`.
- The migrated producers' existing tests assert `issues` instead of their old
  fields.

**Must stay green.** Every class-A refusal test. The audit lists them: identity,
revision, malformed, budget and destructive guards.

**Delegated.**
- Exact field names inside an issue.
- Whether `scope` is a discriminated union or free-form.
