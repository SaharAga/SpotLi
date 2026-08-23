# Changelog

All notable changes to Deliveree will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versioning convention (established 2026-08-22)**: standard `MAJOR.MINOR.PATCH` — MINOR bumps for new user-facing features/capabilities, PATCH bumps for bug fixes. `MAJOR` stays `0` while in alpha. (A non-standard 4th segment, e.g. `0.6.2.14`–`0.6.2.18`, crept in for a stretch of hotfix releases without being a deliberate decision — retired as of `0.7.0`. See `AGENT_SYNC.md`, 2026-08-22, for the discussion.)

## [0.9.0] - 2026-08-23

### Added
- **AI-assisted Smart Import**: a new Cloud Function (`functions/`, this
  app's first backend component) fills two gaps — a Gemini-backed fallback
  for pasted text the deterministic parser can't handle, and the only way
  to extract tracking details from a pasted/attached screenshot at all
  (previously not possible in any form). Requires sign-in and App Check;
  guarded by per-user and global daily call caps plus payload size limits.
  See README.md "AI-assisted import" for the full design and required
  one-time setup (Gemini secret, Blaze plan) before it's live.
- **Mis-parse detection**: a Smart Import result that's confidently wrong
  looked identical to a correct one until now. An implicit signal logs
  which fields a user edits after auto-fill, before saving
  (`parseCorrections`, field names only — never values); an explicit
  "this wasn't right?" button on the result routes through the existing
  feedback pipeline instead of a second reporting system.

## [0.8.0] - 2026-08-23

_Four PRs (#16–#19) merged after 0.7.0 without a version bump — this entry
covers all of them in one pass so the gap doesn't leave an untraceable range
in the history. Separately, `index.html` turned out to carry its own
independent hardcoded version string (for a cache-purge check) that had
drifted from `version.js` for months without anyone noticing — `version.js`
and `index.html` now both derive from `package.json` at build time instead
of duplicating the value (see `vite.config.js`/`vitest.config.js`)._

_Going forward: **every PR that changes `src/**` must bump `package.json`'s
`version` field** — the one place left to bump — enforced by CI (the
"Require Version Bump" job in `ci.yml`) rather than left to memory._

### Fixed
- **#16** — Tester feedback is now actually readable by admins: added an
  allowlisted admin check (`src/constants/admin.js`, mirrored by
  `firestore.rules`), and `AdminFeedbackModal` now reads the real Firestore
  `/feedback` collection instead of only local-browser history.
- **#18** — Live tracking no longer fabricates checkpoints or delivery
  estimates for carriers with no real upstream integration (previously all
  carriers except Israel Post). Untracked packages now say so explicitly
  instead of showing invented data.

### Added
- **#17** — Feedback submissions can include an attached screenshot
  (client-side downscale/compress, capped and validated server-side).
- **#19** — Firebase App Check wiring (`ReCaptchaV3Provider`), optional and
  gated on `VITE_RECAPTCHA_V3_SITE_KEY` — inert until configured.

### Changed
- **#18** — Firebase config no longer has hardcoded fallback values; a
  production build now fails loudly if any `VITE_FIREBASE_*` variable is
  missing, instead of silently defaulting to the production project.
- **#18** — CI now deploys `firestore.rules` alongside Hosting, so the live
  rules can't silently drift from what's in the repo.
- **#19** — Extracted `src/hooks/usePackages.js` from `App.jsx`: package-list
  state, demo mode, and the storage-reconciliation effects (cross-tab sync,
  Firestore subscription, guest/user load) now live in one testable hook.

### Removed
- **#18** — `simulateCarrierTracking`, ~500 lines of mock tracking data
  generation reachable only by its own tests.

## [0.7.0] - 2026-08-22

_Note: entries for 0.3.0-alpha through 0.6.2.17 were not recorded in this file — version bumps happened in `package.json`/`version.js` without a matching changelog entry. Not backfilled here; see git log for that history._

### Changed
- Removed Telegram integration from all app-facing code (feedback relay, package-status alerts, Settings UI) — kept ops/daemon scripts untouched.
- Consolidated the 3 separate add-package entry points into 1.
- Wired `syncQueueService.enqueue()` into the real package CRUD path in `App.jsx`/`AuthContext.jsx` — offline mutations (add/update/delete) now actually go through the sync queue and dead-letter handling instead of writing directly and silently dropping on failure.

### Planned
- Smart ingestion & AI parsing overhaul (automatic email-forwarding ingestion + AI-enhanced paste fallback) — see `docs/plans/2026-08-22-smart-ingestion-ai-parsing.md`.

---

## [0.2.0-alpha] - 2026-08-19

### Added
- **Firestore Security Rules Lockdown**: Granular zero-trust path rules restricting package access exclusively to verified `request.auth.uid` owners (`/users/{userId}/packages/{packageId}`).
- **Zod Runtime Validation**: Comprehensive schemas in `packageValidator.js` providing rigorous parsing, input sanitization, and defensive boundary protection.
- **Account & GDPR Data Deletion Modal**: Dedicated settings UI supporting complete user data wiping and GDPR export features.
- **PWA Auto-Update Lifecycle**: Service Worker update detection with user notification prompt and instant skip-waiting reload.
- **Cloud Firestore Feedback Collection**: Integrated user feedback mechanism capturing structured bug reports, ratings, and diagnostic payloads directly to Firestore `/feedback` with local cache fallback.
- **iOS Safe Area Inset Support**: Full viewport handling with `viewport-fit=cover` and dynamic notch/home bar bottom/top padding.
- **Unit Testing Suite**: High-coverage Vitest suites verifying schema validation, store synchronization, and versioning baselines.

### Changed
- Refactored `AccountModal` and `FeedbackModal` to dynamically bind to canonical `APP_VERSION`.
- Updated PWA Cache identifier to `deliveree-cache-v0.2.0-alpha`.

---

## [0.1.0-alpha] - 2026-08-15

### Added
- **Core MVP**: Multi-carrier tracking for Israel Post, DHL, FedEx, UPS, AliExpress, and domestic carriers.
- **Local Persistence**: Offline-first reactive package state management with local storage and cloud sync capabilities.
- **Bilingual Hebrew/English Support**: Full RTL/LTR responsive UI with interactive timeline rendering.
- **PWA Capabilities**: Installable Progressive Web App with offline asset caching.
