---
type: patch
---

Protected inbound email webhook against unauthenticated forging by requiring a shared `INBOUND_EMAIL_TOKEN` secret query parameter, resolving Strix security finding CWE-306.
