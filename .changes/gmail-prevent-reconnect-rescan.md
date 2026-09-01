---
type: patch
---

The Gmail connect button no longer restarts the OAuth flow when Gmail is
already connected. Since only one Gmail account can be linked per user and
reconnecting re-runs the 30-day inbox backfill scan, clicking it while
already connected now just shows an info toast telling the user to
disconnect first, instead of silently burning Gmail API and AI-fallback
quota re-scanning an inbox that was already scanned.
