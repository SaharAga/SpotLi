---
type: patch
---

Fixed the package row menu (the three-dots button) opening invisibly. It was
being clipped by the card's own frame, then drawn underneath the install banner
and the bottom bar. It now renders in full, and flips upward when there isn't
room below instead of disappearing behind the tab bar.
