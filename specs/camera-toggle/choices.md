# Choices

Decisions made while implementing this spec that a slice left open. One entry per
decision: what, why, and the slice.

## 01 Corpus storage: tar.gz archives committed directly, with a member manifest

The corpora are small (A 43 KB, B 1.2 MB compressed; no member over 5 MB), so they live in git
without LFS or hash references. They are archives rather than loose files because library
members carry modes (read-only acquisition members, 0700 directories) that git drops. The gate
accepts an archive directly and treats its extraction as the read-only original.

## 01 Corpus A's fence is the job queue's capacity, not a mid-admission close

Publication and the capture admission it triggers commit in the same service turn, so there is
no moment to copy a "published, nothing reserved" library from outside. Closing the library
during admission does not substitute: the reserved capture intent pins absolute paths and
inodes, so a clone of it fails with `NOT_FOUND`/`SOURCE_CHANGED` and can never be admitted. The
producer (`camera-library-corpus.mjs`) holds one filler import's native reply and queues 32 more,
so admission is refused with `LIMIT_EXCEEDED` before reserving anything. Cost: corpus A holds 33
filler `asset.import` jobs that fail when a later service runs them.

A consequence for later slices: any library closed mid-admission cannot be checked on a clone.
`~/.yap` holds no recordings, so this does not reach the user today.

## 01 Gate details

- `--library` takes a Yap home (the directory holding `library/`, e.g. `~/.yap`) or a corpus
  `.tar.gz`. Only `library/` is cloned and hashed; `run/` is runtime state.
- The clone uses `cp -c -p -R` (the slice's `cp -c -R` plus `-p`, so modes and times match the
  original).
- "readPublished accepts the receipt" is checked by importing an APFS clone of each camera
  recording directory with `acquisition.import`: the code under test reads the old receipt
  fresh, and its `publications.video` and binding `available` must equal the library's. For A,
  the capture admission itself is a second fresh read. Recovery of unfinished journals is not
  exercised: both corpora hold finished takes.
- Delivered frames use `maxLongEdge: 144`, a size no corpus journey requested, so cached frames
  from the old build cannot answer for the new one (`firstState` in the report is `processing`).
- Each recording's state and its sources' publication states are read from the clone's catalog
  before the service opens it, and must be the same afterwards. Only recordings that were
  `complete` with every source published get the admission, receipt, frame and reread checks;
  others are reported as not exercised. A failed, retryable admission is retried once through
  `job.retry`; any other admission failure fails the gate at once.
- Controls: a copy of B with the recording set to `interrupted` passes with nothing exercised.
  No cheap control makes the state change: without a capture controller the service does not
  rewrite a recording's state at open (a copy set to `capturing` stays `capturing`), so the
  state-change assertion has not been seen to fire.
- Recording and project counts are read from the clone's catalog before the service opens it, and
  recording directories from disk; every one must still be listed, so a build that loses old
  rows cannot pass on an empty listing.
