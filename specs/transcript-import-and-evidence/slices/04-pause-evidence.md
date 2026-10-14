# Slice 04 — Pause and dead-air evidence

## Contract

Add `audio.pause.get` over an explicit source or project audio selection. The
agent may omit detector settings and use the one tested technical default, or
provide `thresholdRMS`, `minDurationUs`, channel/tap and range explicitly. The
default is a detector setting, not an editorial instruction; the receipt exposes
its resolved threshold, window/hop, channel, algorithm and version. Defer a
capabilities endpoint until multiple meaningful policies or modes exist.

Do not require raw DSP numbers when the agent chooses a named policy. Do not use
an undocumented threshold. Separate measured low energy, authored silence,
speech gaps, unavailable support and unknown coverage. Results never authorize a
cut or claim that a join will sound natural.

## Tests and checkpoint

Use deterministic PCM fixtures for speech, silence, threshold edges, multiple
channels, unavailable support and project mapping. Test default and explicit
settings, resolved-policy receipts, pagination, replay and no revision mutation.
