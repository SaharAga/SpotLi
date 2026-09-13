---
type: patch
---

Admin Telemetry Dashboard Modal (`AdminDashboardModal.jsx`, `AdminScreenshotLightbox.jsx`, `AdminDashboardModal.test.jsx`):
- Purged unused `X` icon import.
- Added dialog accessible labelling via `aria-labelledby="admin-dashboard-title"` on `<div role="dialog">` and `id="admin-dashboard-title"` on heading.
- Cleanly grouped header action controls (`Refresh` and `Back`) into a dedicated flex row, ensuring consistent alignment across LTR and RTL.
- Refactored tab navigation to WAI-ARIA `role="tablist"` with `role="tab"`, `id="admin-tab-*"`, `aria-selected`, and `aria-controls="admin-panel-*"` mapped to the active `role="tabpanel"`.
- Isolated app versions, device screen geometries, and timestamps with `<bdi dir="ltr">` and `<bdi dir="auto">` to eliminate BiDi punctuation and numeral inversion in Hebrew RTL mode.
- Corrected feedback search input touch target ergonomics (`min-h-[48px]`) and layout mirroring (`ps-9 pe-3`).
- Enhanced theme contrast tokens for version badges and tab indicators (`text-indigo-600 dark:text-indigo-300`, `text-slate-500 dark:text-slate-400`).
- Expanded test suite with DOM tests for dialog labelling, tablist semantics, and touch targets (5/5 passing).
