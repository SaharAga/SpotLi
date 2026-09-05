---
type: patch
---

Smart Import no longer spins forever when AI parsing cannot start. The call
now gives up after 35 seconds and tells you to enter the details manually,
instead of leaving a "trying AI parsing" spinner on screen indefinitely.
