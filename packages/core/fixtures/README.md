# Persisted catalog references

The prior-format catalog was created by the real recording revision owner before
the launch compatibility floor (Yap 0.1.33, October 12, 2026 at 7:03 PM PDT).
It contains a capture, caller-authored cut and trim, their replay receipts and
undo history. The adjacent provenance records source/emitted hashes and original
contents. It is immutable input for proving that pre-launch catalogs are refused
without mutation; do not regenerate it from the current schema or substitute a
hand-written table.

The capture-store compatibility test copies it before opening it. Source media
and user libraries are never test outputs. Launch-era catalogs already use
format 29 and open through the ordinary readers.
