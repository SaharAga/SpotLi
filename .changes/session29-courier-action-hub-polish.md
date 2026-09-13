---
type: patch
---

Courier Action Hub (`CourierActionHub.jsx`):
- Added WAI-ARIA `role="tablist"` with `aria-label` on the template selector grid.
- Added `role="tab"`, `id="courier-tab-*"`, `aria-selected`, and `aria-controls="courier-message-preview"` to each template button.
- Added `id="courier-message-preview"`, `role="tabpanel"`, `aria-labelledby`, and `tabIndex={0}` to the message preview box.
- Wrapped message preview text and template label in `<bdi dir="auto">` to prevent RTL punctuation and word-order inversion in Hebrew mode.
- Added `aria-label` attributes to Restore presets, Add new response, Close editor, Edit active message, and Delete/Remove buttons.
- Enforced $\ge 48\text{px}$ touch targets across the Restore button (`min-h-[48px] min-w-[48px]`), custom template editor title input (`min-h-[48px]`), form Cancel and Save buttons (`min-h-[48px]`), and the editor Close (`X`) button (`min-h-[48px] min-w-[48px]`).
- Applied `rtl:scale-x-[-1]` to Send (WhatsApp), ExternalLink (SMS), and RotateCcw (restore presets) icons for natural RTL mirroring.
- Added `aria-label` to Gate code inline input.
