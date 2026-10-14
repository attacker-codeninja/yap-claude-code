# Slice 02 — Explicit imported-transcript alignment

## Contract

When `transcript.import` receives `timingPolicy: "align"`, it runs the existing
alignment owner over bounded audio windows and publishes supplied and aligned
ranges together. The supplied text is literal: alignment cannot correct, add or
remove words. The result retains model, runtime, recipe, window, correspondence,
confidence and uncovered-support identity.

Provide an explicit way to align an already imported generation later if the
agent first chose supplied timing. The default import path never loads a model,
downloads a model or performs alignment. An explicit alignment failure leaves the
supplied generation readable and does not replace a prior project revision.

## Tests and checkpoint

Test default no-alignment behavior, explicit alignment, bounded-window seams,
replay, retry, stale generation, no-overlap ranges, missing audio and preservation
of supplied timing. Compare the two generations through CLI and MCP reads.
