---
type: patch
---

Fixed the Gmail connection status showing as stuck/duplicated by replacing
client-trusted localStorage writes with a server-verified status check
(`gmailConnectionStatus`), consolidated the OAuth redirect handling into one
place instead of two independent effects, granted the missing Cloud Run
invoker IAM binding for `gmailOAuthStart`/`gmailDisconnect`, gated the
ambiguous DHL/FedEx bare-digit tracking regexes behind a nearby carrier-name
check to stop them matching phone numbers, and surfaced the 30-day backfill's
scanned/saved counts (or its failure) in a toast instead of swallowing errors
silently.
