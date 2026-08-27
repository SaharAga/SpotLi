---
type: patch
---
Refactor and harden scalability, maintainability, prototype pollution resilience, and storage key centralization:
- Centralized application constants (`APP_NAME`, `INGESTION_EMAIL_DOMAIN`, `APP_COPYRIGHT`) in `src/constants/app.js`.
- Centralized localStorage keys and domain key validator in `src/constants/storageKeys.js` (`STORAGE_KEYS`, `isAppStorageKey`).
- Replaced direct `CARRIERS[carrierId]` bracket lookups with safe `getCarrier(carrierId)` helper across UI components, schemas, and utility modules.
- Bounded local tombstones to 200 entries with LRU eviction in `CloudStorageAdapter` to prevent unbounded memory growth.
- Added WeakMap and Map memoization cache in `detectStore` to prevent repeated regex evaluations on unchanged objects and strings during render frames.
- Applied CSS rendering containment (`content-visibility: auto; contain-intrinsic-size: 140px;`) on `PackageCard` to optimize long list rendering performance.
