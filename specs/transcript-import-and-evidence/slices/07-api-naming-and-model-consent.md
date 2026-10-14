# Slice 07 — Analysis names and optional-model consent

## Contract

Rename the public analysis operations in the shared protocol catalog and every
adapter:

- `transcript.prepare` becomes `transcript.transcribe`.
- `alignment.prepare` becomes `alignment.observe`.
- `speaker.prepare` becomes `speaker.observe`.

These names describe the evidence each operation publishes. Keep
`model.prepare` because it has a different responsibility: it downloads/acquires
and verifies model/runtime files and does not run inference. `voice.generate`
remains the owner of durable generated voice audio. The cutover is deliberate and
unambiguous; do not add aliases unless a later product decision requires them.

The default transcript model is acquired automatically. There is no
`transcript.prepare` call for customers to discover or invoke. Agents call a
requested capability directly. Optional alignment, speaker and voice models may
return `MODEL_NOT_PREPARED`. Its human-readable message must say that
`model.prepare` will download/acquire and verify the named model/runtime files;
the error is retryable and must include:

- `modelId` and human-readable purpose;
- the model/runtime files or acquisition scope that will be downloaded;
- estimated bytes when known, otherwise an explicit unknown-size statement;
- why the requested operation needs the dependency; and
- a stable retryable indicator and the original operation/selection to retry.

The consumer skill explains that `model.prepare` downloads/acquires and verifies
the dependency. It does not instruct agents to call it proactively. After a
`MODEL_NOT_PREPARED` response, the agent presents the returned details to the
user, asks whether to download the optional model/runtime, calls `model.prepare`
only after an explicit yes, polls `model.status`, and retries the original request.
If the error lacks the details needed for that question, the agent reports the
gap and does not guess or download.

## Ownership and tests

Update protocol descriptions, refusal/error payloads, core/service handlers, CLI
help, MCP schemas, parity fixtures and the consumer skill together. Verify that
the default transcript path does not expose or require a preparation operation,
that each renamed operation produces the same evidence as its predecessor, and
that an unprepared optional model leaves source media and prior revisions intact.
Test the complete consent/retry sequence with exact model ID, purpose, scope,
size, retryability and original-selection details, plus a malformed/incomplete
error that refuses to invent a download.

## Checkpoint

From both CLI and MCP, call each renamed operation directly. Trigger an optional
model refusal, show the user-facing download question using only the error
payload, approve it, run `model.prepare`, and retry the original operation. Run
the focused protocol/core/service and parity checks before the full repository
suite at slice 06 closeout.
