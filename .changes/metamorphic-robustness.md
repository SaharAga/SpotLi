---
type: patch
---

Smart Import now reads messages that contain invisible formatting characters —
the bidi marks Hebrew senders' phones insert around Latin tracking numbers,
non-breaking spaces from HTML emails, and irregular spacing — which previously
caused the tracking number to be missed entirely. Adds a robustness test suite
that generates ~1,000 noisy variants of every known message.
