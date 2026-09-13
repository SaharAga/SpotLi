---
type: patch
---

Polish Welcome & Onboarding Tour modal (`OnboardingModal.jsx`):
- Added `labelledBy="onboarding-slide-title"` to `Modal` dialog and matched `id="onboarding-slide-title"` on heading.
- Upgraded slide indicators to accessible WAI-ARIA `role="tablist"` and `role="tab"` with `aria-selected`, `aria-controls`, and localized `aria-label` ("Slide X of Y").
- Marked slide body container as `role="tabpanel"` linked to active tab via `aria-labelledby`.
- Isolated numbers, courier codes, tracking identifiers (`#AMZ-9382`, `#CH-4821`, `CH-849201`, `48291`, `B-14`, `7 3 9 1 0`) in `<bdi dir="ltr">` elements to prevent BiDi inversion in Hebrew RTL.
- Hardened light mode and dark mode theme tokens across all 4 slide illustration cards and status badges (`text-emerald-700 dark:text-emerald-400`, `text-amber-600 dark:text-amber-400`, `text-blue-600 dark:text-blue-400`, `bg-blue-50 dark:bg-blue-950/40`), ensuring full WCAG AAA contrast in both modes.
- Expanded unit test suite in `OnboardingModal.test.jsx` covering ARIA semantics, direct tab selection, dialog labelling, and BiDi containment (12 passing tests).
