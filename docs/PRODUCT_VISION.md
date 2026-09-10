# SpotLi — End-State Product Vision & Feature Specification (Q&A)
**Authoritative Product Specification & Strategic North Star**
*Target Audience: Sahar (Product Owner) & Autonomous Engineering Swarm (Antigravity, Codex, Claude)*

---

## 🧭 1. Executive Summary & North Star

### Q1.1: What is SpotLi in one sentence?
**SpotLi** is the ultimate, privacy-first, zero-friction package tracking and last-mile management app designed specifically for Israeli and international e-commerce consumers.

### Q1.2: What is the core problem SpotLi solves?
Online shoppers in Israel (and globally) order across multiple merchants (AliExpress, Amazon, ASOS, Shein, iHerb, local stores) and receive packages through a fragmented ecosystem of 10+ different couriers (Israel Post, Cheetah/Chita, HFD, Tapuz, BoxIt, Buzzr, DHL, FedEx, UPS, Cainiao).
Users face:
1. **Fragmented tracking**: Manually checking multiple carrier websites or deciphering unreadable SMS messages.
2. **Missed pickup windows**: Risk of packages being returned to sender (RTS) due to forgotten locker holding deadlines.
3. **Locker code scramble**: Searching through old SMS threads while standing in front of a locker under direct sunlight.
4. **Forgotten packages at the same location**: Picking up one package from a grocery store or locker while accidentally leaving other waiting packages behind.
5. **Sudden pickup point redirects**: Couriers silently moving a package to a different locker or store because the original destination was full.
6. **Consolidated shipment confusion**: AliExpress combining 4 orders into 1 mystery package without the user knowing which items are inside.
7. **Customs / VAT surprises**: Inadvertently exceeding the \$75 exemption limit when multiple orders arrive simultaneously.
8. **Courier communication friction**: Repeating gate codes, apartment numbers, or safe-place instructions over phone calls and WhatsApp.

### Q1.3: What is the "Magic Moment" for a user?
The user never has to copy-paste or manually type a tracking number again. **SpotLi automatically captures deliveries from SMS and connected email accounts, surfaces locker PINs and live store opening hours, guides the user via their favorite navigation app (Waze/Google Maps/Apple Maps), alerts them to pick up all waiting packages at the same spot, and empowers them to communicate with couriers in a single tap.**

---

## 👥 2. Target Audience & Personas

### Q2.1: Who is the primary user?
- **The Israeli Power Shopper**: Orders 5–30 packages a month from AliExpress, Amazon, Shein, ASOS, and Israeli shops. Regularly interacts with pickup shops, BoxIt/E-Post lockers, and needs fast WhatsApp courier communication and Hebrew RTL support.
- **The Global Value Shopper (AliExpress & Shein power users)**: Orders 15–30 parcels a month from overseas; struggles with fragmented tracking numbers, confusing combined packages, and customs limits.
- **The Convenience-Driven Professional (Amazon & iHerb)**: Fast delivery expectations, locker pickup after work, values instant navigation and single-tap driver contact.
- **The Household Delivery Hub**: Manages packages for partners, roommates, or children; needs clean separation between personal and shared items.

### Q2.2: What languages and locales are supported?
- **Hebrew (RTL)**: Full native Israeli experience with Israeli courier names, Hebrew SMS detection, local date formats, and right-to-left layout symmetry.
- **English (LTR)**: Seamless international experience with global couriers and left-to-right layout.
- 100% pixel-perfect layout mirroring across all views, drawers, and modal sheets.

---

## 📥 3. Omni-Channel Ingestion (The "What" of Package Capture)

### Q3.1: How do packages enter SpotLi?
SpotLi captures packages through 5 zero-friction channels:

```
[ Automatic SMS Courier Detection ] ──┐
[ Multi-Email Sync (Gmail/Outlook/iCloud/IMAP) ] ──┼─► [ Universal Ingestion & Normalization ]
[ Universal Forwarding Inbound Webhook ] ──┤                    │
[ Camera Barcode & Label OCR Scanner  ] ──┤                    ▼
[ Smart Clipboard & Manual Bottom Sheet ] ──┘         [ Live Unified Package Record ]
```

1. **Automatic SMS Courier Detection**:
   - Background detection and auto-import of incoming courier SMS messages (tracking numbers, pickup links, locker PINs, holding deadlines) with zero manual typing.
2. **Multi-Email Ecosystem Sync**:
   - **Google Gmail**: 1-Click OAuth 2.0 with real-time push updates.
   - **Microsoft Outlook / Office 365**: OAuth 2.0 connection.
   - **Apple iCloud Mail**: Secure connection for Apple ecosystem users.
   - **Generic IMAP / Custom Domains**: App-password support for custom email providers.
   - 30-day historical order backfill upon initial connection.
3. **Universal Forwarding Inbound Email (`track@spotliapp.com`)**:
   - Forward any shipping confirmation email to a private inbound address for instant serverless parsing.
4. **Camera Barcode & Physical Label Scanner**:
   - Point the camera at a physical shipping box label, locker barcode, or order screenshot to extract package details instantly.
5. **Smart Clipboard & Quick Add Sheet**:
   - Auto-detection prompt when copying text, plus an instant bottom sheet with live carrier auto-detection.

---

## 🚚 4. Carrier Intelligence & Unified Lifecycle

### Q4.1: Which couriers are natively supported?
- **Israeli Domestic & Last-Mile Couriers**:
  - Israel Post (דואר ישראל)
  - Cheetah Delivery / Chita Shops (צ'יטה שליחויות)
  - HFD / E-Post (HFD שליחויות)
  - Tapuz (תפוז שליחויות)
  - BoxIt / PickUP (בוקסיט)
  - Buzzr (באזר)
  - Baldar (בלדר)
  - YDM (יהב הפצות)
- **Global & International Shipping**:
  - AliExpress Cainiao / AliExpress Standard
  - Amazon Global Logistics
  - DHL Express & DHL eCommerce
  - FedEx, UPS, USPS, Royal Mail
  - Aramex, YunExpress, 4PX, Yanwen
  - Custom / Generic courier with custom tracking links

### Q4.2: How are Consolidated / Combined Shipments handled (e.g. AliExpress Combined Delivery)?
- **Multi-Item Bundling View**: When a carrier or merchant combines multiple distinct orders into a single consolidated shipping container, SpotLi displays all original item names, order IDs, and product thumbnails grouped under the single master tracking card.

### Q4.3: What are the unified package lifecycle stages?
1. `ordered` — Order placed with merchant.
2. `shipped` — Dispatched / Exported from origin.
3. `customs` — Border clearance and customs processing.
4. `in_transit` — Domestic transit between distribution hubs.
5. `out_for_delivery` — On delivery vehicle for home/office drop-off.
6. `ready_for_pickup` — Waiting at a pickup shop or automated locker.
7. `delivered` — Successfully received or collected.
8. `exception` — Delivery failed, address issue, or action required.
9. `archived` — Archived completed delivery.

---

## 📍 5. The Ultimate Last-Mile & Pickup Experience

### Q5.1: What happens when a package reaches `ready_for_pickup`?
The package card transforms into a **High-Utility Pickup Hub**:
1. **Live Opening Hours**:
   - Displays daily opening hours with a real-time badge (e.g. 🟢 **Open Now — Closes at 20:00** / 🔴 **Closed — Opens tomorrow at 08:30**).
   - Special Shabbat eve, Friday afternoon, and Israeli holiday closing alerts.
2. **Prominent Locker PIN & Barcodes**:
   - 4/6-digit locker PIN codes and pickup barcodes displayed front-and-center.
   - **Interactive Full-Screen Locker Mode**: 1-tap expands a high-contrast, maximum-brightness QR/Barcode and extra-large PIN font for effortless scanning at outdoor lockers in direct sunlight.
3. **Universal OS Navigation**:
   - Tapping the address launches the **OS Navigation Choice Sheet** (Waze, Google Maps, Apple Maps, Moovit) with an option to remember the user's preferred app.
4. **Direct Shop Contact**:
   - One-tap phone button to call the local grocery store or pickup shop manager directly.
5. **Proxy Pickup Authorization**:
   - One-tap generation of an official authorization message (with PIN/barcode) dispatched via WhatsApp or SMS to a friend or spouse collecting the package.

### Q5.2: How are Sudden Pickup Location Redirects handled?
When a courier moves a package to an alternate pickup point because the original locker/shop was at full capacity:
- **Urgent Redirect Alert**: Proactive notification: *"Package redirected to Super Yuda Dizengoff (Original: BoxIt Arlozorov was full)"*.
- **Live Location Update**: Automatically updates the map, address, opening hours, and navigation target, while preserving a clear historical note of the change.

### Q5.3: How does SpotLi prevent users from leaving packages behind at the same pickup spot?
- **Smart Location Bundling Banner**: When viewing any package at a pickup point, SpotLi detects all other packages waiting at the same address and displays:
  > 📦 **You have 2 other packages waiting here!** (View all 3 at Super Yuda Dizengoff)
- **Geofence / Near-Pickup Alert**: Sends a proactive push notification when arriving near a pickup location reminding the user to collect all pending parcels together.
- **One-Tap "Mark All as Collected"**: Single button to archive or mark all packages at that location as picked up simultaneously.

---

## 👨‍👩‍👧 6. Family & Household Collaboration

### Q6.1: How does Family / Multi-Person tracking work without compromising privacy?
- **Private by Default**: All detected packages remain strictly private to the user's personal feed to prevent accidental gift spoiling or clutter.
- **Explicit / Selective Share ("Share to Family")**: 1-tap toggle on any package to make it visible to the shared Household feed.
- **1-Click Web Sharing**: Generate a lightweight, secure web tracking link for friends or family who do not have the app installed.
- **Delegate Pickup**: Assign a family member to pick up a specific package; the delegate receives the locker PIN, QR code, and location directly in their app or via WhatsApp.

---

## 💬 7. Courier Communication Hub (Action Hub)

### Q7.1: How does SpotLi simplify interacting with delivery drivers?
When a courier calls or messages, the user taps **Quick Reply** on the active package card:
- Choose from customizable, variable-interpolated presets:
  - 🚪 *"The building code is {gateCode}. Please leave outside apartment {apt}."*
  - 📦 *"Please leave in the electricity closet / behind the plant pot."*
  - ✍️ *"I authorize leaving the package at my door without signature."*
  - 📍 *"Please leave with the building lobby security guard."*
- Dispatches formatted messages directly into **WhatsApp** or **SMS** in a single tap.

---

## 🛡️ 8. Financial, Customs & Post-Delivery Vault

### Q8.1: What financial and regulatory protections exist?
1. **\$75 Israeli Customs VAT Exemption Monitor**:
   - Tracks incoming overseas orders and warns the user if multiple packages have close ETAs that risk exceeding the \$75 VAT-free exemption threshold upon customs aggregation.
2. **Israeli Customs Action & Payment Portal Link**:
   - Direct alert when customs clearance fees or required recipient declarations are pending, with a direct link to the official courier/customs payment gateway.
3. **Return Deadline Vault**:
   - Automatic countdown of merchant return windows (e.g. 14 days under Israeli Consumer Protection Law, or 30 days for ASOS/Amazon/Zara).
   - Stores return instructions, return barcodes, and return shipping labels.

---

## 📱 9. Platform, UI/UX & Native Standards

### Q9.1: What platforms and form factors are targeted?
- **Mobile-First PWA**: Instant browser access, installable to Home Screen, zero friction.
- **Native iOS & Android Apps (Capacitor)**: Distributed on Apple App Store & Google Play with OS push notifications, share sheet integration, and camera permissions.
- **iOS & Android Lock Screen Live Activities / Widgets**: Glanceable home/lock screen widget showing today's out-for-delivery count and active locker PINs without opening the app.

### Q9.2: What organization, filtering, and views are available?
- **Smart Status Filters**: All, Active, Ready for Pickup, In Transit, Customs, Delivered, Archived.
- **Full-Text Product Search**: Search past deliveries by purchased item name (e.g., *"earphones"*, *"winter coat"*, *"LEGO"*) across history.
- **Merchant / Store Filter**: Filter by AliExpress, Amazon, Shein, iHerb, Local, etc.
- **Pickup Location Filter**: View all packages grouped by specific pickup shop or locker hub.
- **Recipient Tags**: Filter by family member or persona (e.g., "Sahar", "Work", "Home").
- **Interactive Map View**: View all active pickup packages plotted on an interactive map.
- **Delivery Time Benchmarks**: Anonymously aggregated average delivery speed stats per courier (e.g., *"Cheetah: avg 7 days from China to Israel"*).
- **View Density Toggle**: Switch between "Rich Cards" (timeline view) and "Compact List" (high-density list for 50+ packages).
- **1-Tap Quick Action Bar on Every Card**: Direct shortcuts for (Navigate 🧭, Show PIN 🔑, Courier WhatsApp 💬, Share 📤).

### Q9.3: How does offline mode work?
- **100% Offline Capability**: All package details, locker PINs, and maps are cached locally. The app opens instantly in basements, elevators, or parking garages without cellular reception.
- **Resilient Mutation Queue**: Actions taken offline (marking collected, editing notes, renaming) queue locally and sync automatically when connectivity returns.

### Q9.4: What accessibility and ergonomics are enforced?
- Minimum touch target size $\ge 48 \times 48\text{px}$.
- High-contrast Dark Mode and clean Light Mode adhering to WCAG 2.2 AAA.

---

## 🔒 10. Privacy & Security Baselines

### Q10.1: How is user data secured?
- **Zero Advertising Trackers**: SpotLi will never sell user delivery data or browsing habits.
- **Client-Side PII Masking & Salted Hashing**: Personal phone numbers and addresses are scrubbed and hashed using salted SHA-256.
- **Zero ID/Passport Storage**: SpotLi never asks for or stores government ID numbers.
- **Guest Mode Support**: Users can track packages locally with zero account creation, with non-destructive cloud migration when signing in.
- **Zero-Trust Token Isolation**: Third-party email OAuth tokens are stored in an isolated, server-side deny-all Firestore vault inaccessible from client devices.

---

## 🚫 11. Explicit Non-Goals (What SpotLi is NOT)

To maintain crystal-clear product focus and our competitive moat against bloated trackers like "Shop":
1. **NOT an E-Commerce Mall**: SpotLi will never advertise "trending products", push store promotions, or try to be a shopping destination. We are a pure utility.
2. **NOT a B2B Courier Logistics Platform**: Built for recipients/shoppers, not for courier companies managing fleet routes.
3. **NOT a Bank / General Expense Tracker**: Does not track credit card balances or unrelated spending; focuses strictly on shipping, customs fees, and delivery lifecycle.

---

## 🗺️ 12. Complete Feature Matrix & Roadmap to v1.0

| Feature Area | Specific Capability | Status |
| :--- | :--- | :--- |
| **Ingestion** | Gmail OAuth 2.0 Push Sync (`gmail.readonly`) | ✅ Done (`v0.18.3`) |
| **Ingestion** | Inbound Forwarding Email Webhook (`track@deliveree.app`) | ✅ Done (`v0.18.0`) |
| **Ingestion** | Smart Clipboard Auto-Paste | ✅ Done (`v0.2.0`) |
| **Ingestion** | Automatic SMS Detection (Native / Background) | 🚀 Sprint 6 |
| **Ingestion** | Multi-Email Expansion (Outlook, iCloud, IMAP) | 🚀 Sprint 6 |
| **Ingestion** | Camera Barcode & Shipping Label OCR Scanner | 🚀 Sprint 6 |
| **Carriers** | 8 Israeli Couriers (Israel Post, Cheetah, HFD, Tapuz, BoxIt, Buzzr, etc.) | ✅ Done (`v0.2.2`) |
| **Carriers** | 10+ Global Couriers (AliExpress Cainiao, Amazon, DHL, FedEx, UPS, etc.) | ✅ Done (`v0.2.2`) |
| **Carriers** | Multi-Item Bundling View (AliExpress Combined Delivery) | 🚀 Sprint 6 |
| **Last-Mile** | Prominent Locker PIN & Barcode Display | ✅ Done (`v0.20.0`) |
| **Last-Mile** | Interactive Full-Screen Locker Mode (High-Brightness Barcode + Large PIN) | 🚀 Sprint 6 |
| **Last-Mile** | Universal OS Navigation Launcher (Waze / Google Maps / Apple Maps / Moovit) | 🚀 Sprint 6 |
| **Last-Mile** | Live Opening Hours ("Open Now / Closes at XX:XX" + Shabbat/Holiday warnings) | 🚀 Sprint 6 |
| **Last-Mile** | Urgent Pickup Location Redirect Alerts (when shop/locker changed) | 🚀 Sprint 6 |
| **Last-Mile** | Smart Same-Location Bundling Banner & Proximity Alerts | 🚀 Sprint 6 |
| **Last-Mile** | Direct Call Button to Pickup Point Manager | 🚀 Sprint 6 |
| **Communication** | Courier Action Hub (Custom Presets + 1-Tap WhatsApp/SMS) | ✅ Done (`v0.20.0`) |
| **Collaboration** | Explicit "Share to Family" Household Feed | 🚀 Sprint 7 |
| **Collaboration** | 1-Click Web Tracking Link Sharing | 🚀 Sprint 7 |
| **Collaboration** | Delegate Pickup via WhatsApp / SMS pass-through | 🚀 Sprint 7 |
| **Financial/Vault**| \$75 Israeli Customs VAT Aggregation Monitor | 🚀 Sprint 7 |
| **Financial/Vault**| Customs Fee Action & Payment Portal Link | 🚀 Sprint 7 |
| **Financial/Vault**| Return Deadline Vault (Merchant Return Policies & Label Storage) | 🚀 Sprint 7 |
| **Search/Stats** | Full-Text Product Search by Item Name (e.g. "earphones") | 🚀 Sprint 7 |
| **Search/Stats** | Carrier Delivery Time Benchmarks (Aggregated Data Monetization) | 🚀 Sprint 7 |
| **Customization**| App Icons, UI Themes (AMOLED/Pastel), Custom Notification Sounds (Pro) | 🚀 Sprint 8 |
| **Native/OS** | iOS & Android Lock Screen Live Activities / Widgets | 🚀 Sprint 8 |
| **Notifications** | Direct Push Notifications (Status changes, Morning Out-for-Delivery summary) | 🚀 Sprint 6 |
| **Notifications** | Urgent RTS Holding Window Expiry Countdown Alerts | 🚀 Sprint 6 |
| **Native App** | Native iOS & Android Packaging (Capacitor) | 🚀 Sprint 8 (v1.0 Milestone) |
