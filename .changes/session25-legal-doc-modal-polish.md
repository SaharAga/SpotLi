---
type: patch
---

Legal Document Modal (`LegalDocumentModal.jsx`, `LegalDocumentModal.dom.test.jsx`):
- Purged unused `X` import.
- Enclosed updated timestamp within `<bdi dir="auto">` to eliminate BiDi parenthesis and date flipping in Hebrew RTL viewports.
- Enforced >= 48px touch targets on header back button and footer close button (`min-h-[48px] min-w-[80px]`).
- Verified dialog `aria-labelledby="legal-doc-title"` linkage to document title heading.
- Created comprehensive DOM test suite `src/components/LegalDocumentModal.dom.test.jsx` (6 tests covering Terms of Use, Privacy Policy, Hebrew RTL localization, close actions, and touch targets).
