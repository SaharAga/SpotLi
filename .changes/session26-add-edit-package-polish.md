---
type: patch
---

Add/Edit Package Modal (`AddEditPackageModal.jsx`, `AddEditPackageModal.dom.test.jsx`):
- Purged unused `X`, `Package` (lucide-react), and `STAGES` imports.
- Added dialog labelling via `labelledBy="add-edit-package-title"` and `titleId="add-edit-package-title"` on `<ModalHeader>`.
- Wrapped detected locker PIN in `<bdi dir="ltr">` and duplicate package title in `<bdi dir="auto">` to eliminate BiDi text inversion.
- Upgraded status stage selector to WAI-ARIA `role="radiogroup"` with `aria-label` and `role="radio"` with dynamic `aria-checked` states.
- Enhanced theme contrast tokens for live intelligence badges (`text-blue-700 dark:text-blue-300`, `text-emerald-700 dark:text-emerald-300`, `text-amber-700 dark:text-amber-300`) and 1-tap auto-fill button.
- Added DOM test coverage verifying dialog accessible labelling, radiogroup semantics, PIN bdi isolation, and >= 48px touch targets.
