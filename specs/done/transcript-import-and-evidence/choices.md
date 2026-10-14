# Final choices ledger

This ledger records decisions that shape the shipped transcript-import and evidence
contract. It is intentionally separate from test results and implementation
history.

## Needs user

### Keep the first JSON import schema deliberately small

An agent can import JSON shaped as `{ cues: [...] }`, where each cue carries its
text, timing, optional speaker, and optional word timing; other top-level fields
are preserved as metadata. A broad editor-export schema could accept many more
variants, but would make the first contract harder to explain and validate. The
provisional call is to keep this small schema and add a format only when a real
source requires it. **Verdict: needs-user; provisional call is reversible.
Confidence: medium.**

## Sound

### Imported transcripts are a separate source-owned evidence type

A caption file can have cue timing without word timing. The existing speech
transcript tables assume word observations, so putting captions there would
invent timing or lose cue boundaries. Yap therefore stores imported generations
in their own durable tables and exposes them through the normal transcript read
operations. **Verdict: sound. Confidence: high.**

### Timing policy is explicit and persisted

When an agent imports a caption file, supplied timing is trusted by default. If
the agent chooses `timingPolicy: "align"`, the service schedules the existing
alignment owner while retaining the supplied cue and timing. The selected policy
is stored with the generation so a restart or package transfer does not change
what the caller asked for. **Verdict: sound. Confidence: high.**

### Package resources retain imported bytes and provenance

A package must still be useful after the original caption path disappears. The
package therefore carries the raw source member, digest and size, parser and
metadata, cue rows, timing policy, and source asset/acquisition dependencies.
Adoption verifies the bytes and cues before restoring the same generation. This
keeps package recovery evidence-only and avoids rerunning a model. **Verdict:
sound. Confidence: high.**

### Imported generation identity is source plus generation

A generation is identified by its source selection and durable generation ID.
That identity is used in package references and dependency closure, so two
assets can use the same caption content without colliding and an adopted package
can replay the same generation idempotently. **Verdict: sound. Confidence: high.**

### Imported search matches whole phrases within each cue

For an imported read, search folds case and outer punctuation, then looks for the
requested consecutive words inside one cue. Cue-only imports match their cue
text and return the cue range; word-timed imports also return the supplied word
identifiers. Search never joins separate cues or invents word timing. **Verdict:
sound. Confidence: medium.**

### Alignment remains a separate evidence owner

The import operation does not create a second alignment database. Explicit
alignment requests schedule the existing alignment jobs per cue, and reads can
join those retained results later. This preserves one owner for alignment model
readiness, receipts and evidence semantics. **Verdict: sound. Confidence:
medium.**

### Speaker corrections stay on project revisions

A caller-authored speaker correction changes the project evidence projection and
is recovered with ordinary revision history, undo and restore. The imported
source cue keeps its supplied label and is never rewritten by a project edit.
This keeps source evidence immutable and gives corrections one mutation owner.
**Verdict: sound. Confidence: high.**

### Detection is evidence, never permission to edit

Filler, pause and speaker observations report what was measured, including method,
settings and coverage. They do not silently remove words, cut silence, or repair
attribution. An agent must make a separate explicit reversible edit request.
**Verdict: sound. Confidence: high.**

### Optional model acquisition is an error-directed user decision

Agents call the requested analysis directly. If an optional model is missing, the
error explains that `model.prepare` will download and verify it, names the
purpose and scope, and marks the failure retryable. The agent can ask the user,
prepare only after a yes, and retry the original operation. The consumer skill
explains this recovery but does not tell agents to preflight every call.
**Verdict: sound. Confidence: high.**
