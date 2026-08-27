---
type: minor
---

Replaced the Gmail auto-sync integration's forwarding-rule + confirmation-scraping
approach (which depended on guessing the shape of Google's unsupported
confirmation page and required the Restricted `gmail.settings.sharing` scope)
with standard read-only OAuth (`gmail.readonly`) backed by a server-side stored
refresh token, real-time delivery via Gmail `users.watch()` + Cloud Pub/Sub push,
and a one-time 30-day historical backfill on connect. No forwarding rule is ever
created in a user's mailbox. The manual CloudMailin forwarding address remains
available as the no-OAuth fallback, and Outlook's forwarding-rule flow is
unchanged.
