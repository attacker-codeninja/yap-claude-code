# Choices ledger

## Sound

### Speaker corrections live on project revisions

When an agent corrects a speaker assignment, the correction is stored with the
project revision and displayed beside the acoustic base attribution. Undo and
restore therefore recover it with the ordinary revision history. Imported source
cue reads keep their supplied labels unchanged; the correction applies when that
evidence is projected into a project occurrence. **Verdict: sound for the
project-owned contract. Confidence: high.**

### Convenience review reports missing models instead of acquiring them

The transcript review convenience operation now returns the same missing-model
details as direct transcription. It does not silently start a download; the
agent can ask the user and then call `model.prepare`. This preserves the
explicit-download rule across both convenience and low-level paths. **Verdict:
sound. Confidence: high.**

### Imported transcripts use a separate source-owned store

When an agent imports a caption file, the existing ASR transcript tables cannot
represent cue-only timing without inventing word timings. The implementation
therefore keeps imported generations in a dedicated store while exposing them
through the transcript service read path. This preserves the existing ASR owner
and makes cue evidence honest. The choice was forced by the current schema and
the spec's cue-level timing rule. **Verdict: sound. Confidence: high.**

### Pause detection reuses the acoustic inspection owner

The pause operation reads the same retained PCM and job/cache lifecycle as
waveforms and spectra. It adds one technical RMS detector and returns intervals
as evidence. It does not create an editing operation or a second audio reader.
That keeps support gaps and cache identity under one owner. **Verdict: sound.
Confidence: high.**

### Explicit import alignment schedules one observer per cue

When an agent chooses `timingPolicy: "align"`, the import call keeps the
supplied cue generation and schedules the existing alignment observer for each
cue's literal text and range. The default supplied path schedules no observer.
This keeps alignment explicit and lets the existing model readiness/error
contract apply. **Verdict: sound. Confidence: medium.**

## Open integration

### Imported alignment is returned as scheduled evidence

The service now invokes the existing alignment owner for each imported cue when
the agent explicitly selects `timingPolicy: "align"`, while keeping supplied
cue data in the import receipt. A later integration pass still needs to join the
published alignment generations back into imported reads. **Verdict: sound for
explicit scheduling; remaining join work is slice 06. Confidence: medium.**

### Imported cue reads return empty literal search results

The imported read path returns cue rows but does not search cue text or supplied
word rows. The unbuilt alternative would make `transcript.search` traverse the
same imported generation and preserve its provenance. This is a functional gap
for agents using imported evidence. **Verdict: unsound. Corrected decision:
search must share the imported generation reader and return pinned cue/word
matches. Confidence: high.**

## Needs user

### First imported JSON schema is `{ cues: [...] }`

The parser accepts a deliberately small JSON shape with cue timing, text,
speakers and optional word timing. A broader editor-export schema could also be
supported, but the prompt did not choose one. The provisional call is to keep
this schema and add formats only when a real source requires them; it is
reversible because the parser is isolated. **Verdict: needs-user. Recommended
provisional call: keep the small schema. Confidence: medium.**
