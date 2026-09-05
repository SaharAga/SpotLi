# Deliveree Engineering Task Catalog & Architecture Backlog (25 Tasks)

This catalog defines the comprehensive 25 engineering tasks across all priority tiers (P0 through P3), mapped to our **3-Squad Autonomous Topology** and **7-Stage Quality Gate Pipeline**.

This is an **agent-executable backlog** — every task here is something a squad/agent can pick up and do. Things that need Sahar's own action (a GCP Console setting, a legal decision, an API key) don't belong here — they go in [GitHub Issues](https://github.com/SaharAga/Deliveree/issues) instead, where they're natively assignable, closeable, and notify him directly. (An earlier version of this file briefly mixed the two in a "Tier 0 addendum" — moved to issues #23–#25.)

---

## Tier 0: Critical P0 Architecture & Foundation Tasks
 
 ### `TASK-01-SEC`: Revoke Compromised Tokens & Enforce Secret Scanning
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad C (`adversarial_pentester`, `compliance_auditor`)
 * **Summary**: Revoke exposed Telegram token, purge Git history with git-filter-repo, configure Gitleaks/regex pre-commit hook (`.githooks/pre-commit`).
 
 ### `TASK-02-CI`: Fix Failing Vitest & Fast-Check Test Suite
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad B (`property_test_eng`, `qa_build_verifier`)
 * **Summary**: Diagnose and fix failing annotations. Verify all Zod schemas and fast-check property tests across 373 passing tests.
 
 ### `TASK-03-AUTH`: Production Firebase Authentication & Strong Password Policy
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`auth_cloud_specialist`) + Squad C (`adversarial_pentester`)
 * **Summary**: Implement Google & Apple SSO, strong password validator with live entropy meter, and email verification.
 
 ### `TASK-04-GUEST`: Anonymous Guest Mode & Non-Destructive Account Linking
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`auth_cloud_specialist`) + Squad B (`formal_invariant_eng`)
 * **Summary**: Enable signInAnonymously and linkWithCredential to migrate guest deliveries to permanent UID with zero data loss.
 
 ### `TASK-05-PRIVACY`: Anti-Profiling Sanitization & Client-Side Hashing
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad C (`compliance_auditor`) + Squad A (`auth_cloud_specialist`)
 * **Summary**: Strip store PII from telemetry, hash parcel IDs with local salt, and enforce per-UID Firestore security rules.
 
 ### `TASK-06-EXPORT`: User-Friendly Data Export (Excel/CSV/PDF) & GDPR Wipe
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`ui_ux_specialist`) + Squad C (`compliance_auditor`)
 * **Summary**: Implement Excel (.xlsx) export as default, RFC 4180 CSV & PDF, and full account deletion with confirmation.
 
 ### `TASK-07-UI-SHELL`: Solid Slide-Over Navigation Drawer (Option 1C)
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`ui_ux_specialist`)
 * **Summary**: Build opaque slide-over drawer (bg-slate-900) with profile card, quick links, and resolve mobile opacity bug.
 
 ### `TASK-08-UI-DASH`: Dashboard with Grid / List Toggle (Option 2)
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`ui_ux_specialist`)
 * **Summary**: Implement top toggle for Rich Cards (2A) vs Compact Feed (2C) with stage filter tabs.
 
 ### `TASK-09-UI-PASTE`: 1-Click Auto-Detect Bottom Sheet (Option 3A)
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`ui_ux_specialist`, `delivery_pipeline_specialist`)
 * **Summary**: Floating + button opens sheet, ephemerally reads clipboard in memory, detects tracking format and adds parcel.
 
 ### `TASK-10-UI-TIMELINE`: Vertical Milestone Step-Tracker Sheet (Option 4A)
 * **Priority**: `P0`
 * **Status**: `Done`
 * **Squad**: Squad A (`ui_ux_specialist`, `delivery_pipeline_specialist`)
 * **Summary**: Vertical interconnected timeline, unmaskable locker code card, and 1-click external courier links.

---

## Tier 1: Core P1 Couriers, Push & Branding Tasks

### `TASK-11-CARRIER`: Universal Carrier Normalizer & Idempotence Engine
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`delivery_pipeline_specialist`) + Squad B (`property_test_eng`)
* **Summary**: Regex & Checksum for Israel Post, DHL, UPS, FedEx, Chita, Cainiao, USPS, Boxit, HFD with fast-check validation and characterization tests.

### `TASK-12-STORE`: Store Identification & Visual Branding
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Store logo detector & badge components for Amazon, AliExpress, iHerb, ASOS, Farfetch, Zara, KSP, Ivory, Super-Pharm, Shufersal, Wolt, Terminal X, Bug.

### `TASK-13-PUSH`: Direct Web Push Notifications (FCM / Service Worker)
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`pwa_offline_specialist`) + Squad C (`adversarial_pentester`)
* **Summary**: Configure FCM Web Push in `public/sw.js` to deliver real-time background status transition alerts (e.g. Out for Delivery, Ready for Pickup, Delivered).

### `TASK-14-SHORTCUTS`: PWA App Shortcuts & Web Share Target
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`pwa_offline_specialist`)
* **Summary**: Manifest app shortcuts (Paste Tracking, Locker Pickups) and SMS share target handler with DOM test coverage.

### `TASK-15-STATS`: Personal Analytics Dashboard & Multi-Currency
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Delivery duration analytics, active shipment stats, and multi-currency cost tracker (ILS/USD/EUR).

---

## Tier 2: Performance P2 Caching, Resilience & Maps Tasks

### `TASK-16-CACHE`: 4-Tier High-Performance Caching & Delta Sync
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad A (`auth_cloud_specialist`, `pwa_offline_specialist`)
* **Summary**: In-memory SWR, localStorage partition caching with TTL, and Firestore Delta Sync.

### `TASK-17-THROTTLE`: Graduated Throttling, Anti-Bot & Firebase App Check
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad C (`adversarial_pentester`) + Squad A (`auth_cloud_specialist`)
* **Summary**: Progressive backoff on high volume, temporary cooldowns, and ThrottleGuard endpoint protection.

### `TASK-18-OFFLINE`: Offline-First Resilience & Sync Queue
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad A (`pwa_offline_specialist`) + Squad C (`chaos_resilience_eng`)
* **Summary**: Firestore offline persistence and atomic background mutation queue (`syncQueueService`) replaying upon reconnection.

### `TASK-19-MAPS`: Interactive Locker & Service Point Map (Waze/Google Maps)
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Interactive map for locker location with opening hours, phone, and 1-click Waze/Google Maps routing.

### `TASK-20-BIST`: Client-Side BIST Diagnostics & Telemetry
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad B (`testability_bist_eng`)
* **Summary**: Periodic storage I/O, regex benchmark, and memory health checks with scrubbed telemetry alerts.

---

## Tier 3: Omnichannel & Post-Delivery Helpers

### `TASK-21-CUSTOMS`: $75 Customs Threshold Monitor & Tax Alerts
* **Priority**: `P3`
* **Status**: `Dropped (Out of Scope)`
* **Squad**: Squad A (`delivery_pipeline_specialist`)
* **Summary**: Dropped per design review — Deliveree is a post-purchase package tracker, not an e-commerce checkout or purchasing app.

### `TASK-22-DEADLINES`: Dual Deadline Tracking Engine (Pickup Holding + Store Returns)
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad A (`delivery_pipeline_specialist`, `ui_ux_specialist`)
* **Summary**: Dual deadline countdown engine with real-time pickup holding RTS risk warnings (<24h / <48h) and post-delivery store refund/return window trackers (14/30-day presets). Integrated into package cards, detail modal, and edit forms.

### `TASK-23-SCANNER`: Image/Screenshot Parsing OCR
* **Priority**: `P2`
* **Status**: `Done (Re-scoped)`
* **Squad**: Squad A (`delivery_pipeline_specialist`, `ui_ux_specialist`)
* **Summary**: Live camera barcode scanning dropped as irrelevant. Screenshot and image paste/drop OCR is fully implemented via Gemini AI in `SmartImportModal`.

### `TASK-24-EMAIL`: Smart Email Ingestion & Zero-Touch Sync
* **Priority**: `P0`
* **Status**: `Done`
* **Squad**: Squad A (`delivery_pipeline_specialist`, `auth_cloud_specialist`)
* **Summary**: Complete automated tracking number extraction and zero-touch sync engine across inbound forwarding and Gmail OAuth 2.0 push sync.

#### `TASK-24A`: Client-side parser upgrade
* **Priority**: `P0` | **Status**: `Done` | **Summary**: `smartParser.js` extracts from carrier URLs, short links, and labeled text.

#### `TASK-24B`: Serverless AI parsing engine (`parseWithAi`)
* **Priority**: `P0` | **Status**: `Done` | **Summary**: Firebase Cloud Function accepts text/images, returns structured package schemas via Gemini API.

#### `TASK-24C`: Email forwarding ingestion pipeline (`inboundEmailWebhook`)
* **Priority**: `P0` | **Status**: `Done` | **Summary**: CloudMailin inbound-mail webhook extracts packages from forwarded shipping confirmation emails.

#### `TASK-24D`: Paste-based fallback (text + image)
* **Priority**: `P1` | **Status**: `Done` | **Summary**: `SmartImportModal.jsx` image paste/drop and AI enhancement fallback.

#### `TASK-24E`: Gmail OAuth 2.0 Push & Historical Backfill
* **Priority**: `P0` | **Status**: `Done` | **Summary**: Server-side OAuth 2.0 (`gmail.readonly`), Cloud Pub/Sub push listener (`gmailPushNotification`), instant parallel 30-day historical order backfill (`gmailBackfill`), and weekly watch renewal (`gmailWatchRenewal`).

### `TASK-25-COURIER`: Courier WhatsApp & SMS Quick Actions
* **Priority**: `P2`
* **Status**: `Done`
* **Squad**: Squad A (`feedback_telemetry_specialist`, `ui_ux_specialist`)
* **Summary**: 1-Click WhatsApp & SMS buttons in `PackageDetailModal` with pre-filled message templates (Door/Gate Code, Safe Place, Porch Drop, Proxy Pickup Authorization).

### `TASK-26-SYNC`: Autonomous Multi-Agent Coordination Protocol & CLI Bridge
* **Priority**: `P0`
* **Status**: `Done`
* **Squad**: Infrastructure & Protocols (`agent_sync_liaison`)
* **Summary**: Built atomic lock-safe state machine CLI (`scripts/agent-sync-channel.mjs`, `scripts/agent-sync-start.mjs`, `scripts/agent-sync-stop.mjs`) backed by `docs/AGENT_SYNC_STATE.json` for autonomous turn-taking between Codex, Claude, and Antigravity with TTL guards, sequence checking, and timeout circuit breakers.

### `TASK-27-DETECTION-V2`: Grounded Candidate Scorer & Parser Architecture v2
* **Priority**: `P0`
* **Status**: `Done`
* **Squad**: Squad A (`detection_benchmark_specialist`, `delivery_pipeline_specialist`)
* **Summary**: Implemented contextual tracking candidate scoring (`extractTrackingCandidates`) in `src/utils/trackingExtraction.js` and `smartParser.js`. Extracts all candidate tokens with carrier proximity scores, negative label penalties (verification OTP, bank 2FA, phone numbers, driver feedback links), and high-confidence ranking.

### `TASK-28-CARRIER-MATRIX`: Carrier Matrix Expansion & Transliteration Parity
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`delivery_pipeline_specialist`)
* **Summary**: Expanded carrier specs to 24 carriers including Orian dashed tracking (`554621757-0`), Cargo Express / Amital (`ECSA\d{6,9}`), Exelot (`XLT\d{9}`), GetPackage short domain (`gpkg.to`), Tapuz mixed-case tokens, Israel Post route codes, and full DHL Hebrew phonetic variations (`די אץ אל`, `די אייץ' אל`, etc.). Synchronized `src/types/carrierSpecs.generated.json` and `functions/src/carrierSpecs.generated.json`.

### `TASK-29-SYNTHETIC-BENCHMARK`: Synthetic Training Data Generator & Parser Benchmark Testbench
* **Priority**: `P1`
* **Status**: `Done`
* **Squad**: Squad A (`detection_benchmark_specialist`, `qa_verifier`)
* **Summary**: Implemented procedural synthetic data generator (`scripts/generate-synthetic-training-data.mjs`) generating positive delivery alerts, locker PIN isolation scenarios, mixed tracking URL messages, and negative non-delivery controls. Created 72-case Vitest benchmark (`src/utils/parserSyntheticBenchmark.test.js`) verifying >=98% precision and 0% false positives.

### `TASK-30-REAL-SMS-TRIAGE`: Real Israeli Courier SMS Triage & Held-out Corpus Evaluation
* **Priority**: `P0`
* **Status**: `Done`
* **Squad**: Squad A (`detection_benchmark_specialist`, `delivery_pipeline_specialist`)
* **Summary**: Built interactive CLI message review tool (`scripts/review-carrier-messages.mjs`) for privacy-preserving PII redaction and triage of real SMS dumps. Expanded held-out evaluation corpus (`tests/fixtures/parserEvalCorpus.js`) to 77 canonical cases and achieved 100.0% precision, 100.0% recall, and 100.0% specificity in `npm run eval:parser`.
