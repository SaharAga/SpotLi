// Sourced from package.json's "version" field at build/test time (see
// vite.config.js / vitest.config.js) — this used to be a second hardcoded
// copy that could drift from package.json (and did: index.html carried a
// third, independent copy that silently fell behind for months). One number
// to bump now, not three.
export const APP_VERSION = __APP_VERSION__;
export const RELEASE_DATE = "2026-08-23";
export const BUILD_CHANNEL = "alpha";
export const FIREBASE_SCHEMA_VERSION = "1.0.0";
