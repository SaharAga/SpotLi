---
type: patch
---

Threaded `userId` through `deliveryService.importData` so imports under an authenticated user persist into the user's storage partition rather than the guest key (#56). Wrapped `exportToJSON` in a self-describing manifest containing schemaVersion, exportedAt, appVersion, scope, and packageCount, and updated `importData` to reject partial scope exports while preserving legacy bare-array restore compatibility (#57).
