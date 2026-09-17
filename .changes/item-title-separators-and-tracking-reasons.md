---
type: patch
---

Stopped rows of dashes from an email's layout ending up in a package title, so
"SEESTARZ - ----------------------- Relocation Leopard Bag" is now
"SEESTARZ - Relocation Leopard Bag".

A failed live-tracking refresh now says what actually went wrong. A server with
no API key, an exhausted daily quota and a real outage all reported the same
"tracking is unreachable", which told the user nothing and left no evidence to
diagnose.
