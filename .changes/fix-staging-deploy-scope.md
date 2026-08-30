---
type: patch
---

Restored staging deploys on every merge to `main` for pre-release visibility — a prior change had over-corrected this to only fire on release commits, alongside production. Now: staging deploys on every ordinary merge, and skips only on the release-only commit itself (since it carries no code the preceding merge didn't already deploy there), which instead goes straight to production.
