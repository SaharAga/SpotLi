---
type: minor
---

Account deletion now also disconnects Gmail and purges push tokens, usage counters and logs server-side (new `deleteAccountData` function). The email-forwarding address carries a random, regenerable token instead of the account ID. The 17TRACK webhook reaches every user, not just the first 100. `featureUsage` writes are restricted to well-formed IDs. The Privacy Policy, Terms and Accessibility Statement were updated to match the code and Israeli requirements (`LEGAL_VERSION` 2026-09-26.1).
