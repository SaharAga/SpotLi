---
type: patch
---

Accessibility and keyboard navigation polish for `PackageCard` and `FilterBar`:

**PackageCard**:
- Made the main card container keyboard accessible with `role="button"`, `tabIndex={0}`, `onKeyDown` handling (`Enter`/`Space`), and a descriptive `aria-label` detailing title and status.
- Added explicit `type="button"` to all overflow menu and action buttons.
- Added explicit `aria-label` attributes to menu actions (Copy tracking, Locker mode, Carrier link, Pin, Edit, Archive, Delete) and pickup navigation.
- Added `aria-hidden="true"` to decorative Lucide icons across status badges, action buttons, and countdown chips.

**FilterBar**:
- Added `type="button"` to the search clear button and filter panel toggle button.
- Added `aria-pressed` states on filter panel view mode buttons (Grid/Table) and status options.
- Linked Carrier and Sort selects to their corresponding `<label>` elements via `id` and `htmlFor`.
- Wrapped grouped controls in `role="group"` with `aria-labelledby` attributes.

**Tests**:
- Added `FilterBar.dom.test.jsx` (5 tests covering clear button, chips aria-pressed, filters panel toggle, view mode switching, and Escape key dismissal).
