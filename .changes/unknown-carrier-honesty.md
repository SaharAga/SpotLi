---
type: patch
---

Smart Import no longer guesses a carrier from how many digits a tracking number
has. An Israeli courier's job number was being filed under DHL or FedEx purely
because it was ten or twelve digits long; when nothing in the message names a
carrier, the package is now saved with the carrier left unknown. Also reads
numbers labelled "שליחות", which Bar Group and others use.
