# Launch-video session inputs

Real inputs from the session that made Yap's launch video. The user authorized
committing them; treat the speech as personal content.

- **`narration.mov`** is the exact original narration publication: 3:52 of
  Float32 mono from the Mac mic. On Yap 0.1.33 it reproduces every
  transcription failure in the
  [launch-video feedback spec](../../specs/launch-video-feedback/README.md):
  - seam refusals at 120 s and 219 s;
  - an estimate running past the physical end of media;
  - an estimate running past a caller's window end.

  It also holds the soft "okay?" that denoise removed.
- **`dji-0117-audio-3.36-73.36.wav`** is a lossless excerpt of the far
  camera's audio from the same take. It overlaps the narration's pitch section,
  for multicam synchronization checks.

[Provenance](provenance.json) binds the original hashes, the exact excerpt
range and command (re-derived byte-identically), and what the session
observed. Those observations fix what a regression must reproduce. They don't
establish lexical truth or a certified sync offset.

Both files are Git LFS objects; fetch them only for the checks that use them.
