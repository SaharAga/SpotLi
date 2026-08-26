---
type: patch
---

Stopped the analytics modal recomputing its metrics while closed, and made the
delivered-package transit duration shared between the two aggregators that need
it instead of derived twice. Offline backlogs now replay their independent
writes concurrently — feedback uploads under a bounded pool, and sync-queue
mutations for distinct packages — while mutations touching the same package
still replay strictly in queue order and the local feedback history is written
once per drain rather than once per item.
