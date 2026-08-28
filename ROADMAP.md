# 🚀 Deliveree: Master Production Roadmap

**Target**: Transition Deliveree from simulated prototype to production-grade consumer package tracking app.

---

## 🗺️ Step-by-Step Execution Plan

### ✅ Step 1: Real Authentication & Registration (COMPLETED — v0.2.1)
* Configured real Firebase Web App credentials (`deliveree-app-2a938`).
* Eliminated mock user generation; added Google SSO + Email/Password auth with password entropy meter.
* Persistent auth state across reloads and guest-to-permanent non-destructive migration.

---

### ✅ Step 2: Real Carrier Tracking Engine & Proxy (COMPLETED — v0.2.2)
* Carrier tracking proxy and normalized checkpoint resolvers for Israeli & Global couriers.
* 60s cooldown rate-limiting with eviction bounded cache, and batch refresh.
* Formal state machine transition matrix validation (`canTransition`).

---

### ✅ Step 3: Zero-Friction Automated Email Ingestion (COMPLETED — v0.18.3)
* 1-Click "Connect Gmail" (`gmail.readonly`) with Google Cloud Pub/Sub push listener and weekly watch renewal.
* Serverless 30-day historical order backfill with atomic batch writes.
* Inbound email webhook gateway (`inboundEmailWebhook`) via CloudMailin.
* Gemini AI serverless parsing engine (`parseWithAi`) with image/text drop fallback in `SmartImportModal`.
* Context-aware multi-carrier detection and anti-false-positive filtering for Israeli couriers & global merchants.

---

### 🎨 Step 4: UI/UX & Native Ergonomics (COMPLETED — v0.19.0)
* [x] Mobile Slide-Over Navigation Drawer with touch optimization ($\ge 48\text{px}$).
* [x] Rich Cards vs Compact Feed toggle with stage filters.
* [x] Interactive Locker & Service Point Map (`LockerMapModal.jsx`).
* [x] Dedicated bilingual Export Center (Excel, CSV, PDF).
* [x] Image & Screenshot Paste/Drop OCR via Gemini AI (TASK-23).
* [x] Direct FCM Web Push Notifications for status transitions (TASK-13).

---

### 📱 Step 5: Native App Packaging & Post-Delivery Helpers
* [x] Dual Deadline Tracking Engine (Pickup Holding Window RTS risk + Store Return Policies) (`TASK-22`).
* [x] Courier WhatsApp & SMS Quick Actions (Safe Place, Gate Code, Proxy Pickup) (`TASK-25`).
* [ ] Wrap application with Capacitor for native iOS and Android store deployment.
