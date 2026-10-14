# Persisted catalog references

Launch-era catalog compatibility uses format 29, the same format as Yap 0.1.33
(October 12, 2026 at 7:03 PM PDT). Catalog tests build isolated inputs in their
scratch directory and never write a user library or source media. Keep any future
older-format fixture only when it represents a supported migration contract; do
not retain a pre-launch fixture whose rows have no current owner.
