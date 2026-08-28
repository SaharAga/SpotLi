---
name: ui-ux-design-systems
description: Comprehensive UI/UX, Design Systems, Touch Ergonomics, and Human Factors protocol. Activate when designing, reviewing, or modifying user interfaces, animations, modals, bilingual RTL/LTR layouts, mobile touch interaction targets, or WCAG 2.2 AAA accessibility compliance.
inputs:
  - Frontend components, CSS/Tailwind utility classes, modal workflows, or layout specifications
outputs:
  - UI/UX & Human Factors Audit Report with concrete layout fixes, contrast validations, and touch ergonomic sign-offs
---

# UI/UX & Human Factors Design Protocol

This skill provides exhaustive guidelines for ensuring world-class, frictionless, mobile-first design, bilingual Hebrew (RTL) / English (LTR) perfection, and WCAG 2.2 AAA accessibility across all web and mobile touch surfaces.

---

## 1. Mobile-First & Touch Ergonomics

### A. Tap Targets & Thumb Zone
* **Minimum Tap Target Area**: All interactive buttons, icons, inputs, and toggles **MUST** have an effective hit area $\ge 48 \times 48\text{px}$ on mobile screens (WCAG 2.5.8 / 2.5.5).
* **Safe Margins & Spacing**: Minimum $8\text{px}$ visual margin between adjacent interactive touch targets to eliminate mis-taps.
* **Natural Thumb Reach**: Place primary action buttons (Add, Confirm, Scan) within the natural bottom-third thumb zone or sticky bottom navigation sheets.
* **Device Insets & Notches**: Always respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for iPhone Dynamic Island and Android navigation bars.

### B. Frictionless User Flows
* **1-Click SSO Execution**: Never interrupt single-sign-on (e.g. Google SSO) with manual credential forms or unnecessary intermediate modal confirmations.
* **Progressive Disclosure**: Show primary metrics and actions first; disclose advanced details, technical JSON, or full raw history via explicit expandable drawers or modals.
* **Predictive Prefill**: Auto-populate inputs from pasted tracking numbers, SMS snippets, or clipboard payloads without requiring the user to select carrier dropdowns manually.

### C. Mobile Overlay & Backdrop Hit-Testing
* **Dedicated Backdrop Element**: Separate modal/drawer backdrops from their container content. Avoid binding backdrop click listeners to large wrapper containers that wrap interactive sheets.
* **Touch Event Disambiguation**: On mobile touch surfaces, ensure backdrop dismiss handlers do not swallow or conflict with swipe gestures or taps inside the slide-over panel. Use `e.stopPropagation()` or explicit backdrop click targets.
* **Touch Target Isolation**: Interactive buttons and swipe handles inside drawers must retain distinct tap targets ($\ge 48\times 48\text{px}$) that do not trigger backdrop dismissal.

---

## 2. Bilingual RTL/LTR Symmetrical Geometry

* **Zero Direction Hardcoding**: Never use physical directional properties (`left: 10px`, `pr-4`, `text-left`) for layout elements in bilingual interfaces.
* **Logical Properties & Modifiers**:
  * In Tailwind CSS, use logical classes: `start-3`, `end-3`, `ps-4`, `pe-4`, `ms-2`, `me-2`, `text-start`, `text-end`.
  * Or use directional variants: `ltr:left-3 rtl:right-3`, `ltr:pr-4 rtl:pl-4`.
* **Directional Icon Flipping**:
  * Flip forward/backward arrows, carousels, and directional chevrons in RTL mode (`isRTL ? 'rotate-180' : ''` or `rtl:rotate-180`).
  * Never flip non-directional icons (e.g. Package, User, Checkmark, Globe, Search, Bell).
* **Alphanumeric & Number Isolation**:
  * Always wrap tracking numbers, phone numbers, timestamps, and currency in `<bdi dir="ltr">` or `dir="ltr"` so punctuation and prefixes (`#`, `+`, `$`, `₪`) do not transpose incorrectly in Hebrew sentences.

---

## 3. Visual Hierarchy & Micro-Interactions

* **Glassmorphism & Surface Depth**:
  * Use subtle backdrop blurs (`backdrop-blur-md` / `backdrop-blur-2xl`), semi-transparent surfaces (`bg-slate-900/80`), and distinct specular borders (`border-slate-800/80`) to establish clear z-index depth without visual noise.
* **Physics & Micro-Animations**:
  * Micro-interactions should feel tactile and fast: duration $150\text{ms} - 300\text{ms}$ with `cubic-bezier(0.4, 0, 0.2, 1)`.
  * Avoid sluggish animations that delay user intent. Provide instant optimistic feedback on tap.
* **Informative Empty & Error States**:
  * Every empty view must contain a friendly graphic or icon, clear bilingual explanation, and a direct 1-click CTA button to guide the user back into the flow.

---

## 4. Accessibility (WCAG 2.2 AAA Compliance)

* **Contrast Ratios**:
  * Normal text ($< 18\text{pt}$ or $< 14\text{pt}$ bold): Minimum contrast ratio $\ge 7:1$ against background (AAA level).
  * Large text ($\ge 18\text{pt}$ or $\ge 14\text{pt}$ bold) and essential UI components: Minimum contrast ratio $\ge 4.5:1$.
* **Focus & Keyboard Navigation**:
  * Visible, high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none`) on all interactive controls.
  * Tab order must follow logical visual reading flow in both LTR and RTL.
* **Semantic ARIA Tree**:
  * Proper `role="dialog"`, `aria-modal="true"`, `aria-label`, and `aria-expanded` attributes on modals, drawers, and accordions.

---

## 5. UI/UX Review Sign-Off Template

```markdown
# 🎨 UI/UX & Human Factors Review Report

## Overall Verdict: [ APPROVED | CHANGES REQUESTED ]

### 1. Mobile Touch & Ergonomics
- **Tap Targets (>=48px)**: [Pass | Fail at component:line]
- **Thumb Reach & Placement**: [Pass | Needs adjustment]
- **Frictionless SSO Flow**: [Pass | Blocked/Redundant step at: description]

### 2. Bilingual RTL/LTR Symmetry
- **Logical Directional Classes**: [Pass | Hardcoded physical property at: file:line]
- **Icon Rotation & BDI Isolation**: [Pass | Issue: file:line]

### 3. Visual Hierarchy & Animation
- **Glassmorphism & Depth**: [Pass | Issue]
- **Micro-interactions**: [Pass | Sluggish animation at: file:line]
- **Empty / Loading States**: [Pass | Missing empty state CTA]

### 4. Accessibility (WCAG 2.2 AAA)
- **Contrast Ratios (>= 7:1)**: [Pass | Contrast failure at: file:line]
- **Focus Rings & ARIA Attributes**: [Pass | Missing ARIA labels at: file:line]
```
