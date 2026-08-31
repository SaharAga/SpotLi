---
type: minor
---

Added Smart Import miss-rate telemetry: every Smart-Import-filled save is
now logged (source, confidence, carrier, whether it was corrected — never
the tracking number or any other value) to a new `smartImportAttempts`
collection, giving `parseCorrections` the denominator it never had. The
admin dashboard's Parser tab now shows overall miss rate and a per-carrier
breakdown, so which carrier's email/text format needs regex work next is
visible instead of guessed. Part of the analytics roadmap in #117.
