---
name: delivery-lifecycle-and-pickup-engine
description: End-to-end guide for building the core tracking pipeline, omni-channel ingestion, and last-mile pickup ergonomics. Use when developing or reviewing shipment extraction, carrier normalization, locker/pickup UI, location bundling, and client-side privacy architecture.
inputs:
  - Shipment payload, raw SMS/email text, carrier status data, or pickup point coordinates
outputs:
  - Normalized package models, locker UI components, navigation launchers, and privacy-preserving caching logic
---

# Delivery Lifecycle & Last-Mile Pickup Engine

This skill provides actionable standards for building a fast, private, and high-utility package tracking and pickup experience.

---

## 1. Omni-Channel Ingestion & Extraction

1. **Deterministic Proximity Scoring**: Inbound parsers (SMS, Gmail, IMAP, OCR) must verify carrier keywords within close character distance of tracking number candidates before accepting regex matches.
2. **Authoritative Carrier Handoff**: Treat SMS and emails as discovery triggers. Always query the underlying courier API or normalized status schema as the source of truth for delivery states and addresses.
3. **Structured Entity Extraction**: Extract the following core metadata whenever present:
   - Tracking Number & Carrier Identifier
   - Locker / Collection Point Name & Address
   - Locker Pickup PIN Code / Door Code
   - Expiration / Holding Window Deadline

---

## 2. Last-Mile & Pickup Point Ergonomics

1. **Interactive Fullscreen Locker Mode**:
   - Provide a dedicated, high-contrast modal displaying the pickup barcode or QR code with boosted screen brightness.
   - Display the collection PIN in large, easily readable typography with a 1-tap copy button.
2. **Universal OS Navigation Sheet**:
   - Offer an instant choice sheet with deep links for Waze, Google Maps, Apple Maps, and Moovit.
   - Format coordinates and addresses safely using platform URI schemes (`waze://?q=...`, `maps://?q=...`).
3. **Smart Same-Location Bundling**:
   - When a user has multiple packages awaiting pickup at the same physical store or locker terminal, prominently group them and display a combined collection reminder.
4. **Live Opening Hours & Availability**:
   - Calculate live "Open Now / Closes at HH:MM" badges based on local time.
   - Flag impending Shabbat and holiday closures for Israeli collection shops.
5. **Courier Quick Actions**:
   - Provide 1-tap dispatch to WhatsApp or SMS with pre-formatted delivery instructions (e.g., gate codes, door-drop authorizations).

---

## 3. Client-Side Privacy & Storage Architecture

1. **Local-First & Offline Resilience**:
   - Persist all package state, locker PINs, and coordinates in IndexedDB. Ensure full offline read access in elevators, basements, and parking garages.
2. **Client-Side Identifier Protection**:
   - Mask or hash phone numbers and personal delivery identifiers locally using salted SHA-256 before any network transit.
3. **Entitlement & Pro Feature Flags**:
   - Gate advanced aesthetics (custom app icons, AMOLED themes) and multi-account sync behind lightweight, client-side entitlement checks.
