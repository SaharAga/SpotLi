---
type: minor
---

Added a mobile bottom tab bar (Status / Insights / + / Lockers / Account) and
moved the drawer trigger off the top-left corner on phones, where it was the
worst reach for a thumb; the hamburger and header "+" are now desktop-only.

Added ambient state chrome: one derived value tints the header wash, the header
hairline, the app mark and the bottom-nav hairline amber when something needs
collecting today and rose when a package is held at customs or has stalled.
Shipped alongside removing three infinite `animate-*` loops — the pinging
attention dot, the out-for-delivery badge pulse, and the header logo glow —
which carried the same signal a pixel at a time and never stopped competing.

Language now follows the browser/OS on first run instead of always defaulting to
Hebrew, matching how theme has always honoured `prefers-color-scheme`. An
explicit toggle still pins the choice.

Fixed the toast and PWA install banner pinning to the bottom-right in Hebrew as
well as English, and raised `.min-h-touch` from 44px to the 48px the project's
own accessibility spec mandates.
