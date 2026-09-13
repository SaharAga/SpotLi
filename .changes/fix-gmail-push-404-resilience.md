---
type: patch
---

Added 404 and 410 entity handling to `gmailPushHandler.js` so deleted messages, discarded drafts, or spam do not abort real-time Gmail push notification batches or block stored historyId advancement.
