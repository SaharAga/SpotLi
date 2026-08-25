---
type: patch
---

Stopped the analytics modal recomputing its metrics while closed, and made the
delivered-package transit duration shared between the two aggregators that need
it instead of derived twice. Offline backlogs now replay their independent
writes concurrently — feedback uploads and sync-queue mutations for distinct
packages — with the local history and package list read and written once per
drain rather than once per item; mutations touching the same package still
replay strictly in queue order.
