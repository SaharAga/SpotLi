# Deliveree Engineering Roadmap & Architecture

## 1. Product Vision & Architecture Overview
Deliveree is a modern, privacy-conscious, multi-carrier package tracking app designed for Israeli and global e-commerce consumers. It unifies order updates across Israeli couriers (Israel Post, Cheetah Delivery, HFD, BoxIt, Tapuz, Buzzr) and global shipping networks (AliExpress Cainiao, YunExpress, 4PX, DHL, FedEx, UPS, USPS, Royal Mail, Aramex, Yanwen) into an intuitive, bilingual (Hebrew RTL / English LTR), cloud-synchronized experience.

The authoritative end-state product vision and detailed Q&A specification is documented in [docs/PRODUCT_VISION.md](file:///home/sahar/Deliveree/docs/PRODUCT_VISION.md).

---

## 2. Milestone Execution Roadmap (4 Sequential Waves to v1.0)

```
[ Wave 1: Core Pickup & Last-Mile UX ] ──► [ Wave 2: Omni-Channel Ingestion ] ──► [ Wave 3: Family, Customs & Vault ] ──► [ Wave 4: Native App Store & Widgets ]
  (Immediate High-Impact Daily UX)           (Zero-Typing Automation)               (Multi-Person & Financial Shield)       (v1.0 Production Launch)
```

---

## 3. Sprint Breakdown & Milestones

### ✅ Sprints 1–5: Foundation, Tracking Engine & Core UI (Completed — v0.20.1)
- [x] **Real Firebase Authentication & Non-Destructive Guest Migration** (`v0.2.1`)
- [x] **Multi-Carrier Normalized Tracking Engine & Proxy** (`v0.2.2`)
- [x] **Telegram Feedback Relay Bridge** (`v0.2.0`)
- [x] **Dedicated Bilingual Export Center (CSV, JSON, PDF)** (`v0.4.0`)
- [x] **Graduated Throttling & Offline Mutation Queue** (`v0.6.0`)
- [x] **Interactive Locker & Pickup Map (`LockerMapModal.jsx`)** (`v0.6.0`)
- [x] **Gmail OAuth 2.0 Real-Time Push Sync & 30-Day Historical Backfill** (`v0.18.3`)
- [x] **Inbound Forwarding Email Webhook (`track@deliveree.app`)** (`v0.18.0`)
- [x] **Courier Action Hub (7 Presets + Custom Editor + WhatsApp/SMS Dispatch)** (`v0.20.0`)
- [x] **1-Click Package Quick Edit & Non-Destructive Live Binding** (`v0.20.1`)

---

### 🌊 Wave 1: Core Pickup, Navigation & Last-Mile UX (Sprint 6 — Active)
*Objective: Eliminate everyday friction when retrieving packages from pickup points and lockers.*

- [x] **TASK-601: Universal OS Navigation Launcher** (Waze / Google Maps / Apple Maps / Moovit choice sheet + preferred app memory).
- [x] **TASK-602: Live Store Opening Hours** (Real-time "Open Now / Closes at XX:XX" badge + Shabbat eve / Israeli holiday alerts).
- [x] **TASK-603: Interactive Full-Screen Locker Mode** (Oversized high-contrast PIN keypad digits + screen wake lock + 1-tap collected + WhatsApp proxy).
- [x] **TASK-604: Smart Same-Location Bundling & Proximity Alerts** (Banner: *"2 other packages waiting here!"* + 1-tap *"Mark All as Collected"*).
- [x] **TASK-605: Pickup Location Redirect Detection** (Alert & auto-updating map/hours when courier redirects to alternate locker + original location note).
- [x] **TASK-606: Direct Shop Manager Call Button** (1-tap phone dialer on pickup card).

---

### 🌊 Wave 2: Omni-Channel Ingestion & Candidate Intelligence (Sprint 7)
*Objective: Zero manual tracking entry with 100% accurate, hallucination-free package capture.*

- [x] **TASK-701: Grounded Candidate Scorer & Israeli SMS Corpus Testbench** (`v0.25.0` — Grounded candidate extraction and ranking engine across 24 couriers, verified against 77-case held-out corpus and 72-case synthetic benchmark with 100% precision & recall. Tier 1 deterministic parsing + Cloud Gemini Tier 2 fallback replaces heavy on-device SLM architectures).
- [ ] **TASK-702: Direct Push Notifications Engine** (Status changes, morning Out-for-Delivery digest, urgent RTS holding countdowns).
- [ ] **TASK-703: Automatic Courier SMS Ingestion** (Background/native detection of tracking numbers and locker PINs).
- [ ] **TASK-704: Multi-Email Ingestion Expansion** (Microsoft Outlook / Office 365, Apple iCloud Mail, generic IMAP/App-Password).
- [ ] **TASK-705: Multi-Item Bundling View** (Consolidated shipments / AliExpress Combined Delivery display).
- [ ] **TASK-706: Camera Barcode & Label Scanner** (Physical label OCR & locker barcode scanner).

---

### 🎨 Milestone: Pre-Alpha UI/UX Design System Polish & Human Factors Audit (Sprint 7.5)
*Objective: Systematically audit and refine every screen, button, modal, card, and micro-interaction to deliver a world-class, premium user experience before public Alpha release.*

- [ ] **TASK-751: Dashboard & List Ergonomics Overhaul** (Refined card hierarchy, subtle glassmorphism, fluid responsive grid, crisp store logos, and smooth swipe gestures).
- [ ] **TASK-752: Modal & Interaction System Polish** (Consistent header actions, responsive bottom sheets on mobile, keyboard navigation, and streamlined Add/Edit forms).
- [ ] **TASK-753: Full-Screen Locker Mode Aesthetic Polish** (Ultra-high contrast ambient night mode, refined typography for PIN digits, and clear action buttons).
- [ ] **TASK-754: Micro-Interactions, Skeletons & Haptics** (Fluid spring transitions, shimmer skeleton loading states, haptic click feedback, and error states).
- [ ] **TASK-755: Bilingual Hebrew RTL / English LTR Symmetry Audit** (Zero layout shift, 48px minimum touch targets, WCAG AAA contrast compliance, and font readability).

---

### 🌊 Wave 3: Family Collaboration, Customs & Financial Vault (Sprint 8)
*Objective: Seamless household coordination and financial/customs protection.*

- [ ] **TASK-801: Explicit "Share to Family" Household Feed** (Private by default, 1-tap household sharing).
- [ ] **TASK-802: Delegate Pickup Assistant** (Pass-through locker PIN, QR code, and location via WhatsApp/SMS).
- [ ] **TASK-803: 1-Click Secure Web Tracking Links** (For family/friends without the app).
- [ ] **TASK-804: $75 Israeli Customs VAT Aggregation Monitor** (Tax risk alerts for close-arrival overseas orders).
- [ ] **TASK-805: Customs Action & Payment Portal Link** (Direct link to official clearance payment gateways).
- [ ] **TASK-806: Return Deadline Vault** (Merchant return policy countdowns + return label storage).
- [ ] **TASK-807: Full-Text Product Search** (Search order history by item keywords like "earphones", "jacket").

---

### 🌊 Wave 4: Native App Store Launch, Widgets & v1.0 Release (Sprint 9)
*Objective: Full packaging, OS integration, and public distribution on Apple App Store & Google Play.*

- [ ] **TASK-901: Capacitor Native Packaging** (iOS & Android native project configurations, icons, splash screens, permissions).
- [ ] **TASK-902: Lock Screen Widgets & Live Activities** (Glanceable widgets for today's deliveries & active locker PINs).
- [ ] **TASK-903: Carrier Delivery Time Benchmarks** (Community-aggregated shipping speed statistics).
- [ ] **TASK-904: Production App Store & Google Play Release** (Store listings, compliance, public release).

---

## 4. Quality Gates & Definition of Done (DoD)
All features must strictly pass the 7-Stage SDLC Pipeline before merging:
1. Static analysis (`npm run lint` exits 0).
2. Typecheck & contract verification.
3. Automated testbench passing (100%).
4. Property-based invariants & security baseline compliance.
5. Production build verification (`npm run build`).
