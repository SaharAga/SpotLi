---
type: patch
---

Fixed a courier handover SMS being filed as a new package when the dashboard
already held it under the other number in the message. These messages name two
numbers — the courier's tracking number and the merchant's shipment number — and
the duplicate check only ever looked at the one the parser ranked first. It now
checks every number the message named, and keeps the others as aliases so a later
message matches whichever number it quotes.
