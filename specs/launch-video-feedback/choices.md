# Choices ledger

The decisions this spec's implementation made where the slices were silent or
were overridden, re-audited against the final code (`git diff eb91a851 HEAD`) on
2026-10-13. Each entry names who decided: the **product owner**, the **product's
user** (the implementing agent deciding as the agent that edits with Yap), or
the **implementing agent** (a technical call). Groups follow the verdict, least
confident first. Review these first: extraction drops treatment issues; a gap in
one clip stops a mix-level processor for every clip; verdict words stay in
retained evidence.

## Needs the user

**Audio extracted from treated project audio carries none of its issues.**
Rendered speech extracts a mix whose normalization missed its target. The
extraction re-renders through the same treatment, but it publishes no
`normalization-target-unmet` and no `support-gap`. Previews, project audio and
exports do publish them. A rule is needed for derived artifacts that consume
treated audio. Provisional call: leave it. To reverse it, publish the window's
`outputIssues` and processing issues, as project audio does. _Implementing
agent · slice 04 · open · low._

**Adopted transcripts are never reclaimed, even once stale.** A package import
retains an asset → transcript reference for every generation the asset listed.
Once a recipe bump makes one stale, reads skip it, but cleanup can't reclaim it.
Fixing that changes asset dependency retention, which no slice needed.
Provisional call: accept it; revisit if recipient libraries grow. _Implementing
agent · slice 02 · open · medium._

**`AGENTS.md` doesn't state output by default yet.** Slice 01e's paragraph needs
`audit-agents` to run first, and the repo reserves that skill for the user.
Provisional call: the root `README.md` "Product boundary" carries the principle
meanwhile. _Implementing agent · slice 01e · waits on the user · high._

## Unsound

None found on re-audit.

## Sound

### Medium confidence

**A gap in one clip splits the state of every processor that mixes it.** A
track denoiser runs over three clips. One clip's source has a hole from 10 s to
11 s. The denoiser's state stops at 10 s and restarts at 11 s, and over that
second the other clips pass through unprocessed. That is "never learn across
missing input", applied to every input. The alternative was to run the parent
across the hole, where it would learn from a mix with a member missing. Revisit
if users mix gappy captures under a parent denoiser. _Implementing agent · slice
07b · medium._

**Stored verdict words stay verdicts (departs from slices 07f and 07j).** The
speaker-continuity receipt keeps `accepted`/`refused` and its `failedGates`.
The alignment worker keeps `conditionalStatus: "refused"`. The slices wanted
issues for both. These are evaluation verdicts stored in evidence, like
synchronization evidence, so changing them would break strict reads of 0.1.33
receipts and force an identity bump for vocabulary alone. The refusal ledger
allow-lists both, with reasons. Revisit if a consumer reads them as operation
refusals. _Implementing agent · slices 07f, 07j · medium._

**`UNAVAILABLE_SUPPORT` stays a refusal, and names the supported runs.** An
alignment request covers 30 s of a source with a hole at 10 s. The request
carries one caller text, and only the caller knows which words fell in the hole,
so aligning per run is unsound. The speaker model observes once per job
generation. Observing per run would need new generation, result and adoption
machinery: about 93 touch points and several hundred lines. So all four sites
stay class A, missing prerequisite: source-channel admission
(`selectSourceChannelRange`), native `SourceChannelPCM`, integrated loudness and
rendered speech. Instead, each refusal's details name the runs (`available`,
`unavailable`), so the caller narrows the range in one step. The rejected
alternative was slice 04's "publish the supported samples". _Product's user ·
slice 07b · high for alignment, medium for the speaker model._

**Face results say `unavailable` with a reason, but carry no issue
(corrected).** A trajectory with missing observations returns
`state: "unavailable"`, with `reason: "face_observations_unavailable"`. Linear
prediction returns `reason: "prediction_not_implemented"`. Slice 07i asked for
"`unavailable` plus an issue", but slice 01 exempts per-item states such as
`prediction.state`, and no code was added. The earlier entry didn't say the
issue was left out. _Implementing agent · slice 07i · medium._

**Word rows show only the issues inside the 1000-issue bound.** Suppose a messy
transcript publishes 1,400 speech issues. The output keeps 1,000 plus an
`issues-truncated` marker. Rows past the bound look clean, and only the marker
says why. Raw evidence keeps every candidate. The rejected alternative was a
second, unbounded word-issue store. _Implementing agent · whole-spec review ·
medium._

**Every unresolved seam observation gets an issue, published or not.** At the
219 s seam, the left window hears "video" and the right window hears "videos".
"video" publishes with `boundary-unresolved` at its word. "videos" gets one at
its range, with `published: false`, because a word could have been lost there.
This doubles the count at a lexical disagreement. A pair with an ambiguous
member, or one crossing an accepted pair, is unresolved on both sides. That is
the old refusal's uniqueness rule. _Implementing agent · slice 03 · medium._

**Issue rows retire through two triggers on `artifacts`.** When an artifact row
is deleted or replaced, the triggers delete that attempt's `output_issues` rows.
One rule covers regenerate, forget, owner deletion and settlement replacement,
instead of four call sites each remembering. They are the repo's first
production triggers. _Implementing agent · slice 01c · medium._

**Re-anchoring shortens the clip, and the change doesn't cascade.** An anchor
past its parent's source shortens the clip and its source by the same fraction.
Children anchored to that clip aren't clamped in turn, and neither are the angle
validity ranges on it. If they no longer fit, stored validation refuses the
batch. That case is rare, so it stays strict. _Implementing agent · slice 06e ·
medium._

### High confidence

**Decision A: an unresolved seam word publishes, with `boundary-unresolved`.**
A missing word is worse than a flagged one, because it breaks quotes, cuts and
captions. The rejected option was to publish no word and record an unresolved
span. Each word goes to the window whose core holds its start. There is no seam
shift. Shifting by ±0.25 s or ±0.5 s resolved both seams only at −0.25 s, and a
shift changes the recognized words themselves. _Product's user · slice 03 ·
high._

**Decision B: audio treatments always publish their best result, with issues.**
An earlier plan's opt-in `onMiss: "publish"`, defaulting to refuse, lost to the
principle. When gain-only targets conflict, the peak ceiling wins and loudness is
reported unmet; full gain would have shipped about +6.7 dBTP on receipt 05. The
dynamic loop ranks candidates by miss beyond tolerance, then integrated error,
then index, so among passing candidates the closest to target still wins (a
literal "ties by index" would make the loop pointless once its first candidate
passed). An unmeasurable signal, including any domain under 3 s, passes through
at unity with `normalization-unmeasurable`. _Product owner, revising the
product's user · slice 04 · high._

**Decision C: no sync primitive.** The session synced the far camera (146.58 s)
from word timings in both transcripts, then PCM. A primitive would bring
confidence thresholds and drift policy into the product. Sync is skill guidance
instead: word anchors, a drift check, optional PCM refinement, explicit offsets.
Reopen only if replays show agents repeatedly failing, and then with a
threshold-free lag-correlation curve. _Product's user · slice 08 · high._

**Slice 05 closed with no new level field.** One RMS over the word "okay?"
drops only 3.4 dB from the dry tap to the processed one. Denoise takes 10–16 dB
off the onset and tail but spares the loud middle. `waveform.get` buckets on
both taps already show that loss. An `rmsDbfs` field would be a second owner of
short-window level, and on this word it would point away from the loss. The
skill teaches the bucket comparison instead. _Product's user · slice 05 · high._

**The replay uses a cloned library and no app install (departs from slice
11).** The user's library is cloned copy-on-write to `~/.yap-replay/library`,
and this checkout's service runs on the clone. `~/.yap-replay/bin/yap` is this
checkout's CLI pinned to it, forwarding `yap ffmpeg` and `yap ffprobe` to the
app's bundled tools. The personal yap skill points at the replay worktree for
the duration; the 0.1.35 skill and `~/Movies/yap-launch` are backed up. The
rejected option, slice 11's "build and install the normal way", would replace
the installed app and touch the live library. _Product owner with the
implementing agent · 2026-10-13 · high._

**One range rule: work is keyed by the applied range; the clamp belongs to the
request (departs from slice 06a).** On a 5 s project, asking for 0–10 s is the
same work as asking for 0–5 s, and both share one job and output. Only the
overrunning request's answer carries `range-clamped` in its top-level `issues`,
with the requested range, the applied range and the bounds. Every re-read
recomputes it, including a `--wait` poll. A range with no part inside, or one
that isn't a nonempty half-open range, is `INVALID_RANGE`. The rule covers
every read, rendered recognition, transcription execution ranges and project
alignment (which aligns the caller's text against the applied range), all
through one admission family built on composition's `admitRange`. A transcript
page cursor keeps the requested range, so every page reports the same clamp. An
empty project reads as `0..0` only when no range is stated. Slice 06a wanted the
identity to keep the requested range and store the clamp with the output; that
splits identical work, and a request joining a finished generation would miss
its own clamp. The native aligner wasn't run over a clamped range.
_Implementing agent · slices 06b, 06e, whole-spec review · high._

**Authored ranges shorten the placement, and points stay refusals.** Take an
11.46 s placement against an 11.444 s movie. The clip keeps the same fraction of
its project range, content range or anchor fractions, and a retimed clip keeps
its rate. When a source and a content anchor both overrun, the clip keeps the
overlap of what each keeps, each overrunning range reports its own clamp, and
disjoint parts refuse with `INVALID_RANGE`. Replace clamps before its fit, so
ripple sizes from what plays. Trim clamps to the clip's interval. Angle validity
clamps per segment and never moves the offset; a segment wholly outside refuses.
Issues carry `operationIndex`. Holds and image streams are points, and points
outside their domain stay malformed. Stored documents are still validated
strictly. Holding the last frame was rejected, because it invents picture.
_Implementing agent · slices 06a, 06e · high._

**Issues are derived from retained evidence, never stored in it or carried in
packages.** Each producer re-derives its issues from what it already keeps:
treatments from processing evidence (`audioProcessingIssues`), prepared signals
from recipe gaps plus processing evidence, frames from the receipt's
`textFallbacks` (`textFallbackIssues`), and transcripts from `raw.jsonl`. A
retained read or import compares the stored list against the derivation. A
mismatch is `ARTIFACT_CHANGED` on read and `INVALID_PACKAGE` on import. 0.1.33
evidence derives no issues, so it reads as before. Packages carry no `issues`,
which makes slice 01's "read a missing `issues` as `[]`" moot. Every
`adoptArtifact` call names its issues, and adopters whose producers publish none
pass `[]`. A full package round trip of transcript issues is untested.
_Implementing agent · slices 03, 04, 07a, whole-spec review · high._

**The limiter's sample peak is the one additive field in retained evidence.** A
limiter miss can't be derived without the measured peak. So evidence gains an
optional, linear `limiter: { samplePeak }`. 0.1.33 evidence omits it, keeps its
bytes and derives no issue. _Implementing agent · slice 04 · high._

**One `normalization-target-unmet` per domain.** It is keyed by `domainIndex`,
because compiled domains have no step id. `missed[]` lists each target with
`requested`, `achieved` and `excess`, measured past the requested value; the
tolerance only decides whether a target is listed and isn't recorded, though
slice 01 said it would be. Gain-only adds `requestedGainDb`, `gainDb`,
`peakToLoudnessDb` and `maximumFeasibleTargetLufs`; dynamic adds `attempts`,
`selectedAttempt` and `stopReason`. One pure step function, `normalizationStep`,
drives the loop and re-derives the stop reason. _Implementing agent · slice 04 ·
high._

**Transcription publishes past local problems.** Clamping applies to a
published word's speech-bearing extent; the receipts' overruns were a trailing
`.` token, so nothing published clamped. A malformed token drops its whole word
with `word-dropped`, because dropping one token would alter the text.
`INVALID_SPEECH_TIMING` stays only for an unrepresentable raw line and a merged
word without a span. Raw lines carry `issues` with a line-local word, which core
rebases to the transcript ordinal. A malformed issue fails the attempt as
`INVALID_RESPONSE`, not the `INVALID_NATIVE_RESPONSE` slice 01 named.
_Implementing agent · slice 03 · high._

**Transcript reads surface the issues published with what they read.** A ready
source `transcript.get`, `.search` or `.review` returns
`published: { generation, issues }` beside its own range issues. That's the only
place for issues tied to no row, such as `word-dropped`. Project reads put each
source's `issues` on its `dependencies` entry, outside the cached identity. The
rejected alternative was one top-level list mixing a read's own clamp with
inherited problems. _Implementing agent · slice 03, whole-spec review · high._

**Export status reports pinned issues from admission, and treatment issues on
publication (corrected).** Caption diagnostics and a package's
stale-transcript list live in the pinned snapshot, so status shows them from
admission onward and across crash recovery. Video and audio exports add the
issues of the preview or PCM they copy once they publish. Older intents carry
none. Corrected: earlier entries said caption diagnostics ride the export job's
publication and appear only after it publishes; they are snapshot facts
(`apps/service/src/exports.ts:127`, `:885`). _Implementing agent · slices 01d,
04, 07k · high._

**Caption sidecars write. Only a timing line inside a cue refuses.** SRT
markup, entities and ASS tags publish with `srt-literal-markup`; a literal
timing line would split the cue for readers, so it stays `UNSUPPORTED_FORMAT`.
Overlaps never refuse, and past the issue limit they're only counted.
`caption-styling-discarded` was removed: dropped styling is a property of the
format, not a problem with an output. Status no longer shows `omitted`,
`addedOverlaps` or `discardedStyling`. _Implementing agent · slices 07d, 07k,
whole-spec review · high._

**Stale transcripts: one rule. They're skipped when something new is made,
and honoured when pinned.** A complete generation is stale if this version
can't read it, or if its recipe or policy isn't current (`currentTranscript`).
`kindPolicy` isn't in the job key, so it doesn't count. Inventories, reads and
new seeds skip a stale generation (`NOT_FOUND` with `stale: true`). Pins an
existing revision holds read it historically (seeds, edits, export, import's
seed lookup); skipping would break every captioned 0.1.33 project. Packages
leave it out with `derived-stale-skipped` and the recipient regenerates it.
Cleanup forgets the publication, and an old queued job retires as
`ARTIFACT_CHANGED` rather than a raw `ZodError`. Corrected: the earlier entry
said the skipped list had no issue surface yet
(`packages/core/src/project-package.ts:682`). _Implementing agent · slice 02,
later fixes · high._

**Identity bumps, and their deliberate absence.** A bump re-keys work, so a
failed 0.1.33 job stops answering for an input that can now publish. Bumped:
speech (recipe `source-windows-20s-context4s-guard1s-v3`, policy
`transcript-v4`); treatments (`bounded-offset-normalization-v2`,
`linked-mono-max-limiter-v2`, keyed through `processorImplementations`); font
fallback (`native-composition-picture-v21`, `native-composition-movie-v25`). Not
bumped: ranges (in-range identities are byte-identical, and overruns produced
nothing before); support gaps (their refusal fired before any input-keyed job,
so no stale failed job answers); caption sidecars; `catalogFormat`. The
support-gap case departs from slice 02's "every conversion bumps", because
that rule's purpose doesn't apply there. _Implementing agent, under the product
owner's 0.1.33 rule · all slices · high._

**Support gaps split state in the compiler. The issue rides the output, not
the request.** `deriveStatePlan` cuts each member span at unavailable support
anywhere in its input prefix, and each run starts a fresh domain. Each domain
records its `supportGaps`. From those, `support-gap` is derived, carrying
`{ clipId, unavailable, stepIds }`. A read of any run reports every gap of that
processor's span. `window()` returns the request's `issues` apart from
`outputIssues`. The plan's `inputs[].unavailable` stays, always empty, because
removing it would re-key everyone's prepared state; delete it with the next
re-key. Native keeps its guard as an `INVALID_REQUEST` malformed-plan check, and
unverified channel layouts still refuse. Plans without gaps are byte-identical.
_Implementing agent · slice 07b · high._

**Font fallback renders and reports facts, and core derives the issues.**
CoreText draws an uncovered character with `LastResort`, never glyph 0, so
`LastResort` or glyph 0 means `glyph-missing` and any other face means
`font-substituted`. Receipts gain `textFallbacks`, one entry per clip and face,
accepted only for clips that drew text. `FontFile.load`'s whole-face refusal is
gone; a mismatched face reports every code point as substituted. A project index
publishes each distinct frame issue once. `FONT_CHANGED`, `FONT_UNAVAILABLE` and
`FONT_GLYPH_BOUNDS_UNAVAILABLE` became real codes instead of message text inside
`UNSUPPORTED_MEDIA`. The rejected alternative was refusing, because fallback
depends on installed fonts; `used` records the face that drew instead.
_Implementing agent · slice 07a · high._

**Angle groups publish over refused sync evidence.** The caller wrote the
offsets, and the evidence is only a reference, so `angle.declare` reports
`synchronization-evidence-refused`. _Product's user · slice 07c · high._

**HDR and unqualified sources stay refusals, and say what was seen.** No issue
could describe a silently wrong colour. The refusals' `details` now carry the
declarations that disagree, or the codec facts. _Product's user · slice 07e ·
high._

**Subject framing returns `ready` with issues, or `unavailable` when there's no
geometry.** Unmet constraints share one code, `framing-constraint-unmet`, with
the constraint named in evidence, rather than seven near-identical codes.
`unavailable` carries a reason: missing, ambiguous or out-of-bounds subject, or
no feasible crop. _Implementing agent · slice 07g · high._

**Dialogue proposals always propose, with issues.** `peakPolicy`, the
"constrained" status and `targetMet` are gone. Gain bounds clamp with
`gain-constrained`. When the true-peak ceiling overrides the minimum, the
proposal reports `gain-bound-breached`. Missing support, too short,
unmeasurable or unrepresentable gain gives `unavailable` with
`proposal-unavailable`. `skill-issues.test.ts` checks the shape. _Implementing
agent · slice 07h · high._

**The issue type lives in `@yap/composition`, with no protocol re-export
(departs from slice 01).** Every protocol consumer already depends on
composition, so a re-export would give one concept two import paths.
_Implementing agent · slice 01b · high._

**At most 1000 issues per output, and bounding is idempotent.** `boundedIssues`
keeps 1000 issues and folds earlier `issues-truncated` counts into one final
marker. So lists that were bounded, joined and then bounded again keep their
count. _Implementing agent · slice 01b, whole-spec review · high._

**Issues are stored by publishing attempt, in the publication transaction.**
`output_issues` keys a job output by its `attemptId` and generation. An attempt
publishes at most once, so every read path finds the same rows. Issues are
parsed inside settlement, so a malformed issue fails the attempt rather than
publishing silently. `TranscriptStore` creates the table itself so it can read
word issues without a queue. _Implementing agent · slices 01c, 03 · high._

**Issues travel on the queue publication.** `ArtifactStatus.published` carries
`issues`. The rejected alternative was a lookup by job ID, which would miss
publications read without a job. Package context jobs publish `[]`.
`StagedJobResult` makes `publish` and `close` optional. The executor's
`string | StagedJobResult` union stays, because collapsing it would rewrite
every string executor. _Implementing agent · slices 01d, 04 · high._

**`--wait` keeps its exit codes and counts every issue.** A ready output exits
0; a failed job with an older retained publication still exits 1. The
`op: ready (N issues)` line counts the read's own issues, its publication's and
each dependency's, with a truncation marker counted as its `omitted`.
`transcript.render.prepare` waits on `transcript.render.get`, keeping the
prepare/get split, and both preparation waits carry their clamp onto the pinned
read. _Implementing agent · slices 01d, 06c · high._

**The curve-clock error splits three ways and stays a refusal.** Clock,
malformed-curve and bound errors each name their fix in `details`; a clock error
names `clock`, `slot` and `expectedKey`. _Implementing agent · slice 06b ·
high._

**The refusal ledger classifies every UPPER_SNAKE literal, per file.** Refusals
go through helpers, so scanning constructor calls would miss them. UPPER_SNAKE
per-item diagnostics are `issue-code` and stay outside the kebab-case registry;
examples are capture recovery states and caption-proposal violations.
`pendingConversion` is empty and must stay so. _Implementing agent · slice 01a ·
high._

**A spawn under descriptor exhaustion fails retryably.** It reports
`MEDIA_WORKER_UNAVAILABLE` instead of a `TypeError`, because it's a resource
bound. _Implementing agent · full run · high._

**View-shot labels are turned off with `FIXTURE_LABEL=omit`.** `omit` is the
only value, so a typo fails before Swift compiles. Runners pass it to fixtures
as an argument. The unlabelled Library title is the production "Library", and
`settings-view-shots` ignores the variable because it draws no label.
_Implementing agent · slice 09 · high._
