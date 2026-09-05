---
type: patch
---

Fixed every screen that could hang forever waiting on a Cloud Function. Smart
Import's "trying AI parsing" and the account screen's "Checking status…" both
sat indefinitely in production because the call was never actually sent. All
five callables now give up and report a failure instead of spinning.
