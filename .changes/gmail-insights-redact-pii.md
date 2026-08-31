---
type: patch
---

Fixed `gmailParseInsights` (Gmail-sync AI fallback telemetry) logging a
raw tracking number in two places despite claiming to be anonymized: the
subject line was truncated but not redacted (subjects frequently contain
the tracking number itself), and the regex's top candidate value was
logged directly. Subjects are now redacted of any token-shaped text before
truncation, and only the candidate's carrier guess/score are logged, never
its value.
