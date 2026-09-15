---
type: patch
---

Correcting a package's delivery stage after Smart Import now counts as a parse
correction. The parser guesses the stage and the form lets you change it, but
`status` was in neither the correction allowlist nor the training snapshot, so
every one of those fixes was recorded nowhere — the same blind spot that let a
delivered SMS ship as "in transit" without any signal reaching us.
