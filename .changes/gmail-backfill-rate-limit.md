---
type: patch
---

Added a real server-side rate limit (5 calls/user/day, 500/day globally) on
the `gmailBackfill` Cloud Function, on top of the existing UI guard. The UI
guard only stops accidental double-clicks from the connect button — the
callable itself was reachable by any signed-in client directly with no limit
at all, so a user could repeatedly re-trigger their own 30-day inbox scan
and burn Gmail API quota regardless of the AI-fallback budget, which was
already capped separately.
