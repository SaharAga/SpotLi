---
type: patch
---

Smart Import Modal (`SmartImportModal.jsx`, `Primitives.jsx`):
- Connected `labelledBy="smart-import-title"` to `<Modal>` and added `titleId="smart-import-title"` to `ModalHeader` to establish WAI-ARIA dialog title association.
- Enclosed tracking numbers, locker pickup codes, shelf numbers, and screenshot metadata within `<bdi dir="ltr">` elements to prevent number and hyphen inversion in Hebrew RTL layouts.
- Replaced light mode washed-out colors with theme-aware tokens (`text-emerald-600 dark:text-emerald-400`, `text-amber-600 dark:text-amber-300`, `text-blue-600 dark:text-blue-400`, and `bg-emerald-500/10 dark:bg-emerald-950/40`) ensuring WCAG AAA contrast in both light and dark themes.
- Enforced >= 48px touch targets on the manual switch link, report wrong button, and screenshot remove button with explicit accessible labels.
- Added directional arrow mirroring in Hebrew RTL layouts (`rtl:rotate-180`).
- Expanded DOM integration tests to verify dialog labelling, title ID linking, `<bdi dir="ltr">` containment, and >= 48px touch targets.
