---
type: patch
---

Fixed Firebase Hosting's `**/.*` ignore glob excluding the entire `.well-known/` directory (including `strix-verify.txt`), which caused those requests to fall through to the SPA rewrite and serve `index.html` instead.
