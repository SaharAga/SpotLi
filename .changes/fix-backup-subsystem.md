---
type: patch
---

Made the Account tab's backup a raw JSON snapshot read straight from storage instead of a CSV built from the already-repaired in-memory list, so it carries every field (including `titleHe`/`notesHe`, `checkpoints`, category and flags) and can actually be restored by the JSON importer; CSV remains available in the Export Center as a report. Restore no longer truncates silently at 1,000 packages, and every CSV path now neutralises leading `=`, `+`, `-`, `@` and tab characters that spreadsheets would evaluate as formulas.
