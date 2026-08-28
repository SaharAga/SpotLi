---
type: major
---

Refactored `usePackages` to use a `commit` based mutation system to prevent data loss in multi-tab offline scenarios.
Extracted `trackingCooldownMap` from `trackingService` into a standalone `rateLimiter` util to unblock dynamic lazy loading.
Extracted `LEGAL_VERSION` from `legal.js` to shrink initial load times and added code splitting for the legal terms.
