# Deliveree Engineering Task Catalog & Architecture Backlog (25 Tasks)

This catalog defines the comprehensive 25 engineering tasks across all priority tiers (P0 through P3), mapped to our **3-Squad Autonomous Topology** and **7-Stage Quality Gate Pipeline**.

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
* **Status**: `Backlog`
* **Squad**: Squad A (`delivery_pipeline_specialist`) + Squad B (`property_test_eng`)
* **Summary**: Regex & Checksum for Israel Post, DHL, UPS, FedEx, Chita, Cainiao, USPS, Boxit, HFD with fast-check validation.

### `TASK-12-STORE`: Store Identification & Visual Branding
* **Priority**: `P1`
* **Status**: `Backlog`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Store logo detector & badge components for Amazon, AliExpress, iHerb, ASOS, Farfetch, Zara, Nike, Crossrope.

### `TASK-13-PUSH`: Direct Web Push Notifications (FCM / Service Worker)
* **Priority**: `P1`
* **Status**: `Backlog`
* **Squad**: Squad A (`pwa_offline_specialist`) + Squad C (`adversarial_pentester`)
* **Summary**: Configure FCM Web Push to deliver instant status transition alerts directly to mobile/desktop.

### `TASK-14-SHORTCUTS`: PWA App Shortcuts & Web Share Target
* **Priority**: `P1`
* **Status**: `Backlog`
* **Squad**: Squad A (`pwa_offline_specialist`)
* **Summary**: Manifest app shortcuts (Paste Tracking, Locker Pickups) and SMS share target handler.

### `TASK-15-STATS`: Personal Analytics Dashboard & Multi-Currency
* **Priority**: `P1`
* **Status**: `Backlog`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Delivery duration analytics, active shipment stats, and multi-currency cost tracker (ILS/USD/EUR).

---

## Tier 2: Performance P2 Caching, Resilience & Maps Tasks

### `TASK-16-CACHE`: 4-Tier High-Performance Caching & Delta Sync
* **Priority**: `P2`
* **Status**: `Backlog`
* **Squad**: Squad A (`auth_cloud_specialist`, `pwa_offline_specialist`)
* **Summary**: SWR in-memory, IndexedDB snapshot with TTL, and Firestore Delta Sync (query only modified docs).

### `TASK-17-THROTTLE`: Graduated Throttling, Anti-Bot & Firebase App Check
* **Priority**: `P2`
* **Status**: `Backlog`
* **Squad**: Squad C (`adversarial_pentester`) + Squad A (`auth_cloud_specialist`)
* **Summary**: Progressive backoff on high volume, temporary suspension with appeal link, and App Check integration.

### `TASK-18-OFFLINE`: Offline-First Resilience & Sync Queue
* **Priority**: `P2`
* **Status**: `Backlog`
* **Squad**: Squad A (`pwa_offline_specialist`) + Squad C (`chaos_resilience_eng`)
* **Summary**: Firestore offline persistence and atomic background mutation queue upon reconnection.

### `TASK-19-MAPS`: Interactive Locker & Service Point Map (Waze/Google Maps)
* **Priority**: `P2`
* **Status**: `Backlog`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Interactive map for locker location with opening hours, phone, and 1-click Waze/Google Maps routing.

### `TASK-20-BIST`: Client-Side BIST Diagnostics & Telemetry
* **Priority**: `P2`
* **Status**: `Backlog`
* **Squad**: Squad B (`testability_bist_eng`)
* **Summary**: Periodic storage I/O, regex benchmark, and memory health checks with scrubbed telemetry alerts.

---

## Tier 3: Omnichannel P3 Customs, OCR & Automation Tasks

### `TASK-21-CUSTOMS`: $75 Customs Threshold Monitor & Tax Alerts
* **Priority**: `P3`
* **Status**: `Backlog`
* **Squad**: Squad A (`delivery_pipeline_specialist`)
* **Summary**: Aggregate orders within 72h from same store to alert user before exceeding the $75 tax-free limit.

### `TASK-22-RETURN`: Return Window Countdown & Return Label Vault
* **Priority**: `P3`
* **Status**: `Backlog`
* **Squad**: Squad A (`ui_ux_specialist`)
* **Summary**: Countdown timer for return eligibility window and return shipping waybill vault.

### `TASK-23-SCANNER`: Camera Barcode & Label OCR Scanner
* **Priority**: `P3`
* **Status**: `Backlog`
* **Squad**: Squad A (`delivery_pipeline_specialist`, `ui_ux_specialist`)
* **Summary**: Browser native BarcodeDetector API for instant packaging label scanning via phone camera.

### `TASK-24-EMAIL`: Smart Email Ingestion Integration
* **Priority**: `P0` (upgraded from `P3` — 2026-08-22, real user feedback: paste-based parser fails on real messages, see SYNC-11)
* **Status**: `In Progress` — phased, see `docs/plans/2026-08-22-smart-ingestion-ai-parsing.md`
* **Squad**: Squad A (`delivery_pipeline_specialist`, `auth_cloud_specialist`) + Claude/Antigravity joint
* **Summary**: Automated tracking number extraction from courier notification emails, via forwarding (not Gmail/Outlook OAuth for now — see plan doc for why). Split into TASK-24A–D below.

#### `TASK-24A`: Client-side parser upgrade (free, immediate)
* **Priority**: `P0` | **Status**: `In Progress` | **Owner**: Antigravity
* **Summary**: Expand `src/utils/smartParser.js` to extract tracking numbers from courier URLs (e.g. `israelpost.co.il/item/...`, `hfd.co.il/?t=...`) and tracking links generally, not just labeled text (`tracking:`, `מספר מעקב`). Zero cost, no server dependency. Add unit tests for `smartParser.js` and `SmartImportModal.jsx`.

#### `TASK-24B`: Serverless AI parsing engine
* **Priority**: `P0` | **Status**: `Backlog` | **Owner**: Claude/Antigravity joint
* **Summary**: Firebase Cloud Function `parseDeliveryPayload` — accepts text or image, returns structured package fields (Zod schema: carrier, trackingNumber, store, status, expectedDate) via an LLM/vision model call. Auth-gated, per-user daily rate limit. See plan doc for model/cost choice.

#### `TASK-24C`: Email forwarding ingestion pipeline
* **Priority**: `P0` | **Status**: `Backlog` | **Owner**: Joint/Claude
* **Summary**: Dedicated inbound parsing address, inbound-mail webhook (e.g. CloudMailin/SendGrid/Postmark or a Firebase extension), routes to TASK-24B, auto-upserts to the user's Firestore packages with no click required. Android one-click forwarding-rule setup, iPhone manual instructions.

#### `TASK-24D`: Paste-based fallback (text + image)
* **Priority**: `P1` | **Status**: `Backlog` | **Owner**: Antigravity
* **Summary**: `SmartImportModal.jsx` gets image paste/drop support. Free parser (TASK-24A) runs first; if it fails or confidence is low, an opt-in "✨ Enhance with AI" button invokes TASK-24B. Positioned as the fallback for anything TASK-24C's automatic ingestion missed, not the primary path.

#### `TASK-24E` (Post-Alpha, deferred): Gmail API / push-based ingestion
* **Priority**: `P2 (deferred)` | **Status**: `Deferred`
* **Summary**: Replace forwarding with Gmail API OAuth + push (watch) notifications for zero-touch setup, once TASK-24C proves parsing accuracy/volume on real traffic. Not started before then — no point building the harder integration before the parsing engine is validated.

### `TASK-25-COURIER`: Courier Interaction Hub (WhatsApp Quick Replies & Proxy)
* **Priority**: `P3`
* **Status**: `Backlog`
* **Squad**: Squad A (`feedback_telemetry_specialist`, `ui_ux_specialist`)
* **Summary**: 1-Click WhatsApp replies (safe place, gate code, neighbor), delivery cheat-sheet, and pickup proxy letter.
