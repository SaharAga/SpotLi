---
type: patch
---

Stopped push notifications firing for changes the user made themselves. Editing
a package's status, correcting a pickup point, or refreshing tracking in the app
sent a notification back to the person who had just done it; pushes now go out
only for updates written by the Gmail sync and forwarded-email pipelines, matching
how new-package notifications have always been scoped.
