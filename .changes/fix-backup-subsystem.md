---
type: patch
---

Made the Account tab's backup a raw JSON snapshot instead of a CSV, so it carries every field (including `titleHe`/`notesHe`, `checkpoints`, category and flags) and can actually be restored — the CSV it replaced had no importer at all. Renamed the Export Center's JSON option from "JSON Backup" to a scope-filtered export, since restoring a filtered file would have deleted every package outside that filter. Restore no longer truncates silently at 1,000 packages, and every CSV path now neutralises leading `=`, `+`, `-`, `@` and tab characters that spreadsheets would evaluate as formulas.
