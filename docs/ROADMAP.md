# Deliveree Engineering Roadmap & Architecture

## 1. Product Vision & Architecture Overview
Deliveree is a modern, privacy-conscious, multi-carrier package tracking Progressive Web App (PWA) designed for Israeli and global e-commerce consumers. It unifies order updates across Israeli couriers (Israel Post, Cheetah Delivery, HFD, BoxIt) and global shipping networks (AliExpress Cainiao, YunExpress, 4PX, DHL, FedEx, UPS, USPS, Royal Mail, Aramex, Yanwen) into an intuitive, bilingual (Hebrew RTL / English LTR), cloud-synchronized experience.

### Multi-Agent Governance & SDLC Structure
The codebase is developed and maintained using an autonomous **3-Squad Topology** and **7-Stage Quality Gate Pipeline** (defined in AGENTS.md):
- **Squad A: Feature Development Squad** (ui_ux_specialist, auth_cloud_specialist, delivery_pipeline_specialist, pwa_offline_specialist, feedback_telemetry_specialist)
- **Squad B: High-Assurance Verification Squad** (property_test_eng, formal_invariant_eng, testability_bist_eng, qa_build_verifier)
- **Squad C: Adversarial & Red Team Squad** (adversarial_pentester, chaos_resilience_eng, compliance_auditor)

---

## 2. Sprint Roadmap



---

## 3. Sprint Breakdown & Milestones

### Sprint 3: Smart Notifications, Offline & Export (Completed — v0.6.0)
- [x] **TASK-301: Dedicated Export Center & Extended Courier Support** (Completed — v0.4.0)
- [x] **TASK-302: Navbar & Triage Ergonomics Cleanup** (Completed — v0.4.1)
- [x] **TASK-303: Graduated Throttling & Offline Mutation Queue** (Completed — v0.6.0)
- [x] **TASK-304: Telegram Feedback Relay Bridge** (Completed — v0.2.0)
- [x] **TASK-305: Interactive Locker & Pickup Map** (Completed — v0.6.0)
- [x] **TASK-306: Built-in Self-Test (BIST) Diagnostics** (Completed — v0.6.0)

### Sprint 4: Automated Email Ingestion & Gmail OAuth (Completed — v0.18.3)
- [x] **TASK-401: Gemini AI Smart Ingestion Engine (`parseWithAi`)** (Completed — v0.18.0)
- [x] **TASK-402: Inbound Email Delivery Webhook (`inboundEmailWebhook`)** (Completed — v0.18.0)
- [x] **TASK-403: 1-Click Gmail OAuth 2.0 (`gmail.readonly`) & Real-Time Push Sync** (Completed — v0.18.3)
- [x] **TASK-404: 30-Day Historical Parallel Backfill & Multi-Carrier Heuristics** (Completed — v0.18.3)

### Sprint 5: Native Push & Omnichannel Tooling (Active / Next)
- [ ] **TASK-501: Direct FCM Web Push Notifications** (TASK-13)
- [ ] **TASK-502: Camera Barcode & Label OCR Scanner** (TASK-23)
- [ ] **TASK-503: $75 Customs Exemption Monitor** (TASK-21)
- [ ] **TASK-504: Return Window Countdown Vault** (TASK-22)
- [ ] **TASK-505: Courier WhatsApp Quick-Reply Assistant** (TASK-25)

---

## 4. Quality Gates & Definition of Done (DoD)
All features must strictly pass the 7-Stage SDLC Pipeline before merging.
