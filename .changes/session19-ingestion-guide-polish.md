---
type: patch
---

Polish Automatic Shipment Ingestion guide (`IngestionGuideModal.jsx`):
- Added WAI-ARIA `role="tablist"` and `role="tab"` with `aria-selected` and `aria-controls` to interactive provider tabs (Gmail, Outlook, iCloud, Yahoo), and associated `role="tabpanel"` on step details container.
- Added 1-tap "Copy Filter" (`העתק מסנן` / `Copy Filter`) button next to the Boolean forwarding filter query with clipboard checkmark feedback and automatic timer teardown on unmount.
- Wrapped private ingestion email and filter query in `<bdi dir="ltr">` / `dir="ltr"` preventing Hebrew RTL punctuation or parenthesis inversions.
- Added accessible dialog labelling (`labelledBy="ingestion-guide-title"`) and localized `aria-label` on the back button (`חזרה` / `Back`).
- Expanded unit tests in `IngestionGuideModal.test.jsx` covering dialog ARIA landmarks, tablist semantics, filter copying, email copying, and QR code section controls.
