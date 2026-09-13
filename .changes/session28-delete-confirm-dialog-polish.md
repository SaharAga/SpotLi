---
type: patch
---

Delete Confirmation Dialog (`DeleteConfirmDialog.jsx`, `DeleteConfirmDialog.dom.test.jsx`):
- Added WAI-ARIA dialog accessible labelling and description linkages (`labelledBy="delete-confirm-title"` and `describedBy="delete-confirm-description"`).
- Attached `initialFocusRef` to the Cancel ("Keep Package") button to safeguard against accidental destructive keypresses.
- Added a dedicated top-corner Close (`X`) button with localized `aria-label={language === 'he' ? 'סגור' : 'Close'}` and `min-h-[48px] min-w-[48px]` touch targets.
- Enforced strict $\ge 48\text{px}$ touch targets across all interactive buttons (`min-h-[48px] px-4 py-2.5`) with focus rings for keyboard navigation.
- Added support for safe BiDi package title rendering via `<bdi dir="auto">` when provided.
- Created comprehensive DOM test suite in `DeleteConfirmDialog.dom.test.jsx` covering ARIA dialog contracts, BiDi containment, action callbacks, and touch target constraints (7/7 tests passing).
