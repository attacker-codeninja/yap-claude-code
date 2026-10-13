# Local source-bound speech

This module executes the prepared speech engine through the native worker. The
[model owner](../../../../packages/core/src/models.ts) verifies runtime and model
identity; execution never prepares another model or downloads replacement bytes.
Offline mode precedes loading because upstream load recovery can otherwise purge
and reacquire assets. Engine failures remain explicit.

The [window owner](SpeechWindows.swift) bounds decoding inside each readable
source run supplied by the [audio stream](../YapAudio/README.md). Primary ownership
and decoded context are separate; unavailable source time never becomes silence.
Shared-context word order establishes unique seam correspondences; points
require exact peers. One original observation owns each accepted pair; text,
confidence and estimated extent remain unchanged. A guarded observation with no
unique peer is never matched to a nearby timestamp: the window whose core holds
its start publishes it, flagged `boundary-unresolved`. Local problems become
issues; raw evidence is kept. It retains all observations, selected indexes, the
correspondence operands and each line's issues, so an unresolved seam or a
context-only observation remains inspectable.

The [publication worker](SourceTranscript.swift) streams raw evidence while
retaining only neighboring windows for reconciliation. Its receipt echoes execution
and actual readable support separately from ownership. Outer selection edges can
intersect an estimate without shortening it; these remain original source-clock
observations for later read filtering and project projection.

## Spoken extent versus recognition extent

Engine token grouping retains comparability with its evaluated CLI, but punctuation
can be placed after the last audible sound. Word timing therefore distinguishes
speech-bearing token extent from the engine's broader recognition span. Raw evidence
retains both, including overlaps and exact points; neither estimate is independent
audible ground truth or edit intent. The engine's last 80 ms frame can end past the
decoded audio, at the physical end of media or a caller's window end; that estimate
is clamped to the edge and flagged `timing-clamped`. A word with a nonfinite or
reversed token, or confidence outside 0–1, is dropped and flagged `word-dropped`;
its neighbours publish. Raw evidence keeps the engine's original seconds either
way, so no estimate is silently repaired.
The [speech evaluation guide](../../../../packages/test-harness/speech/protocol.md)
owns alignment and interpretation of those estimates.

Core ML can emit unsolicited stdout diagnostics. Execution protects the worker's
response channel while the engine runs; progress is not allowed to become a second
protocol message. Selected input conditioning remains an execution concern,
separate from caller-authored processing.
