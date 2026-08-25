---
type: minor
---

Added automatic, anonymous crash reporting: uncaught React render errors and unhandled
window/promise errors are now reported through the existing feedback pipeline (as `type: 'crash'`,
visible in the Alpha Feedback Inspector) instead of relying only on a tester noticing and manually
reporting a bug.
