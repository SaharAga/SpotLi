---
type: patch
---

Removed `pinTag: true` from `/gmailOAuthCallback` rewrite in `firebase.json` so Firebase Hosting deploys route traffic to the deployed function without unintentionally attempting to rebuild and redeploy Cloud Functions during Hosting channel deploys.
