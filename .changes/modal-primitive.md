---
type: patch
---

Made every modal dismissable and navigable from the keyboard. A new shared
`Modal` primitive owns the portal, backdrop, Escape, focus trap, initial focus
and focus restore, body scroll lock, ARIA and the z-layer stack for all sixteen
dialogs, and a single `useModalRouter` `activeModal` stack replaced the dozen
`isXOpen` booleans and their companion state in `App.jsx`.
