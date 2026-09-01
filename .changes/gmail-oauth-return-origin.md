---
type: patch
---

Fixed Gmail auto-sync connecting from the staging Hosting channel silently
redirecting back to production after Google's consent screen, so the
connection never appeared to succeed where the user actually started it. The
OAuth `state` param now carries the verified originating origin (production,
or a named Hosting channel like `staging`, validated against an allowlist for
this Firebase project) through the redirect round trip, instead of always
redirecting back to a fixed production URL.
