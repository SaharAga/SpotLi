---
type: patch
---

Adds `npm run review:messages`, a local tool that runs your own SMS export
through the parser and reports which delivery messages it fails to read,
grouped by sender. Nothing is uploaded and output is PII-redacted by default.
