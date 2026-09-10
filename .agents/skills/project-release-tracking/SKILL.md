---
name: project-release-tracking
description: Release management and project state tracking protocol for SpotLi. Use when cutting new releases, bumping semantic versions, updating deployed/planned feature matrices, checking quality gates, or tracking component specialist assignments. Do NOT use for individual component coding or general chat.
inputs:
  - Proposed version bump or feature status change
  - Quality gate verification results (tests, lints, security audit)
outputs:
  - Updated PROJECT_STATE.md, version constants, and release notes
---

# Project Release Tracking & Version Governance Protocol

This skill standardizes release management, versioning invariants, cache invalidation, and component specialist orchestration across the SpotLi lifecycle.

---

## 1. Semantic Versioning Specification (SemVer 2.0.0)

Every release adheres to `vMAJOR.MINOR.PATCH[-PRERELEASE]`:
* **MAJOR (X.0.0)**: Breaking architectural changes, incompatible database schema migrations.
* **MINOR (0.X.0)**: New user-facing epics or subsystem capabilities.
* **PATCH (0.0.X)**: Bug fixes, defensive hardening, accessibility tweaks.
* **PRERELEASE Channels**: `alpha`, `beta`, `rc`, `release`.

---

## 2. Release Synchronization Protocol

When a version bump occurs, the following files **MUST** be updated atomically:

1. **[`package.json`](package.json)**: Update `"version": "X.Y.Z-channel"`.
2. **[`src/constants/version.js`](src/constants/version.js)**:
   ```javascript
   export const APP_VERSION = 'X.Y.Z-channel';
   export const RELEASE_DATE = 'YYYY-MM-DD';
   export const BUILD_CHANNEL = 'alpha'; // alpha | beta | rc | production
   export const FIREBASE_SCHEMA_VERSION = '1.0.0';
   ```
3. **[`public/sw.js`](public/sw.js)**:
   Increment cache name to force client-side cache busting:
   ```javascript
   const CACHE_NAME = 'spotli-vX.Y.Z';
   ```
4. **[`PROJECT_STATE.md`](PROJECT_STATE.md)**:
   Update the Live Version table, Deployed Feature Matrix, and Quality Gate metrics.

---

## 3. Pre-Release Quality Gates Sign-Off Checklist

No release tag or deployment may be authorized unless all quality gates are verified:

```markdown
- [ ] 1. Linter & Static Analysis: `npm run lint` exits 0 (0 errors). Warnings
       are permitted — the `react-perf` rules are a worklist, not a gate.
- [ ] 2. Schema Contracts: 100% Zod validation pass across all data ingestion boundaries.
- [ ] 3. Automated Testbench: 100% pass rate across all co-located unit and integration tests.
- [ ] 4. Security Audit: SpotLi Security Baseline compliance verified.
```

---

## 4. Subsystem Specialist Consultation Workflow

During release preparation or code review, consult the designated component specialist based on modified files:
- **Auth & Cloud**: `auth_cloud_specialist`
- **Delivery & Ingestion**: `delivery_pipeline_specialist`
- **UI & Ergonomics**: `ui_ux_specialist`
- **PWA & Offline**: `pwa_offline_specialist`
- **Feedback & Telemetry**: `feedback_telemetry_specialist`
