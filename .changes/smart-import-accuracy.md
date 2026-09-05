---
type: minor
---

Made Smart Import substantially more accurate at detecting tracking numbers.
The parser no longer treats invoice numbers, parking fines, customer numbers
and URL path ids as shipments, and it now reads tracking numbers that carriers
print in spaced groups (UPS's `1Z 999 AA1 01 2345 6784`, Israel Post labels).
Global carriers (DHL, FedEx, UPS, USPS, Aramex, Royal Mail, Cainiao) are now
recognised by name in English notifications, not just Hebrew ones.
