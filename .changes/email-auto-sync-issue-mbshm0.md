---
type: minor
---

Gmail auto-sync now falls back to the Gemini AI parser (already used by Smart
Import) when the deterministic parser finds a tracking-number candidate but
isn't confident enough to create a package unattended, instead of silently
discarding it. The AI fallback runs behind a cheap sender/keyword gate and its
own daily and per-sync-run rate limits, separate from Smart Import's budget,
so a busy inbox can't exhaust either feature's allowance. Every miss and every
AI resolution/decline is now logged (sender domain + subject shape only, no
email body) to a new `gmailParseInsights` collection so recurring misses can
be turned into new deterministic regex rules, and `usageEvents` now records
outcome counts for Gmail backfills, live syncs, and watch renewals as a
starting point for feature-usage analytics.
