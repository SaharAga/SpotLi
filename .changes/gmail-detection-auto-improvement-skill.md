---
type: minor
---

Added the Phase 4 piece of the analytics roadmap (#117): a new
`gmail-detection-auto-improvement` agent skill and its data-access script
(`scripts/detection_insights.mjs`) that read `gmailParseInsights`,
`gmailAiOutcomes`, and `smartImportAttempts` for recurring
regex-miss/false-positive patterns and propose a concrete
regex/threshold change as a draft pull request — never merged, never
marked ready for review, by design. Not activated as a running schedule
yet; see the skill's own "Scheduling" section for why.
