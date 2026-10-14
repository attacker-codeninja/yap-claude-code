# Shared operation contract

This package owns public request admission, response envelopes, errors and bounded
framing. App, socket, CLI and MCP consumers agree on one operation meaning. The
[operation declarations](src/operations.ts) are the canonical schema catalog;
adapters derive validation and help instead of maintaining another list.

Composition schemas come from their [pure owner](../composition/README.md).
Serializable admission is not execution readiness: supported native capabilities,
prepared dependencies and actual media availability are separate evidence.

## Published work

Transport success acknowledges a handled request; it does not certify background
completion. The [publication envelope](src/work.ts) exposes one domain payload
beside its actual retained generation and available attempt identity. A replacement
job can be pending while an earlier output remains published, so current work and
retained output identities must not be conflated. Named operations define the
payload meaning. Synchronous read pages and committed export receipts keep their
own contracts rather than inventing asynchronous work.

## Issues

Output by default: an operation that can produce its output does, and reports
each problem with it as an issue. Refusal stays for malformed or ambiguous input,
conflicts, resource bounds, missing prerequisites, destructive actions and
execution that failed. A request that doesn't match its operation schema refuses
with `INVALID_PARAMS`, whose `details.invalid` names each rejected field's path
and message; `admitOperation` is that one admission for the CLI and service. The
[issue vocabulary](../composition/src/issues.ts) is the only registry: kebab-case
codes, so they never collide with UPPER_SNAKE refusal codes, each with typed
evidence that names what was requested and what was produced. Issues are not
ranked; ordering problems is an editorial call left to the caller.

Every publication envelope carries `issues`, empty when the output is clean, and
export status carries the issues of its export. An output is bounded to 1000
issues; past that, a final `issues-truncated` issue counts what was omitted.
Bounding is idempotent, so lists from several reads combine without losing that
count.
Issues never change the outcome of a request: a ready output with issues exits
the CLI 0 and its settled `--wait` progress line names the issue count, while MCP
reports an error only for a failed request.

## Speech preparation and retained selection

Preparation requests inference; reads and search consume retained evidence.
Execution scope is distinct from a read filter and participates in publication
identity. Bounded source reads pin a generation, and project reads pin their source
dependencies. An omitted generation selects full-support preparation, never the
latest bounded result. The operation declarations own parameter names and bounds;
[core evidence](../core/README.md) owns physical support, primary ownership and
phrase continuity across inference seams.

Rendered-speech preparation requests a fresh observation of pinned revision PCM;
project transcript projection only maps retained source words. Their evidence kinds
and generation pins remain distinct. A measured word is not a clean-cut verdict.

Optional adapter `wait` metadata describes how observation ended while preserving
the domain reply. The [envelope schema](src/index.ts) owns this outcome and current
job identity. Timeout or interruption leaves admitted work uncertain; settled
observation is not a background-success certificate.

## Capture roles

[Capture admission](src/capture.ts) names a selected camera inside the primary
source. The optional top-level camera selection belongs only to a companion
alongside a screen source. Device kind and primary/companion role are separate:
a camera-only take uses the ordinary primary allocation, without a camera sibling.
Audio defaults and durable replay identities stay shared across entry points.

## Identity and framing

A transport request ID correlates one exchange. A durable mutation request ID
identifies an explicitly replayable domain write; changing correlation cannot
turn an uncertain mutation into a new safe request. Structured failures preserve
that distinction rather than implying a disconnected request was rolled back.

[Framing](src/framing.ts) owns byte and time bounds. Measure encoded UTF-8, not
character count, and keep diagnostics outside the response channel. Complete
large results and media use owned leases; delivery metadata must retain the
selection and generation that produced the bytes.

[Cross-language fixtures](fixtures/) pin shared admission and envelopes through
real native consumers. Their assertions complement type checking: they protect
what actually crosses a process boundary, including malformed and foreign-owner
inputs.

## Picture observations

[The pure picture contract](src/picture.ts) owns optional measurement requests,
default interpretation and bounded receipts for shared frame/index delivery.
Rectangles address delivered upright pixels, and nested observations inherit the
parent frame's source/sample or project/revision pins. Histograms report opaque
encoded-sRGB operands with declared luma weights; they are not radiometric light,
scene semantics or instructions to edit. Coverage and actual color profiles keep
missing pixels or absent ICC bytes visible instead of filling them with defaults.

[Face observations](src/faces.ts) are a separate explicit request and receipt.
Vision boxes use delivered top-left pixels and retain every detection, including
the no-face and detector-error states. They contain no person identity,
largest-face default or framing permission.
