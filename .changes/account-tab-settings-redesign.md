---
"deliveree": minor
---

Rebuild the Account tab as one list, and make the feedback rating optional.

- Settings are merged into the Account tab instead of opening a "Settings"
  screen that carried its own six-item rail — a menu inside a menu.
- Every setting is the same 52px row (label, current value, chevron), built
  from shared `SettingRow`/`Toggle` primitives. Choices open a picker rather
  than embedding native selects, whose per-platform height and styling were
  why the settings read as a different product.
- Notifications, account deletion and profile each get their own page.
- Back navigation is a single leading-edge arrow everywhere; the close X is
  gone from inner pages, and `ModalHeader` no longer tries to show both.
- Removed the `defaultCarrier` preference: it was written and sanitised but
  never read by anything.
- Feedback no longer pre-selects five stars or requires a rating. Unrated
  reports omit the field entirely; `firestore.rules` accepts feedback without
  a `rating` and still bounds it to 1..5 when present.
