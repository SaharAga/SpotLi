---
type: minor
---

The Gmail-sync AI fallback now gets an implicit false-positive signal: if a
user deletes, or corrects the carrier/tracking number of, a package the AI
fallback created within the last 72 hours, that outcome is logged
(carrier + confidence band + which fields changed only, never a tracking
number or free text) to a new `gmailAiOutcomes` collection — closing the
gap where `gmailParseInsights` recorded what Gemini said but never whether
it was right.
