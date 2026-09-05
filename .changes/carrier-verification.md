---
type: minor
---

Smart Import now confirms uncertain tracking numbers with the carrier before
falling back to AI parsing. For Israel Post, asking whether a number resolves
to a real shipment settles the ambiguity outright instead of guessing at it —
and skips the AI call entirely when it succeeds.
