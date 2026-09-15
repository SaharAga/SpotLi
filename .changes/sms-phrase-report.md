---
type: patch
---

Added a developer tool that ranks the Hebrew delivery phrasings in a real SMS
export and reports which ones the parser cannot stage. It runs entirely offline,
normalizes every message before counting anything, and never writes a raw
message to its output.
