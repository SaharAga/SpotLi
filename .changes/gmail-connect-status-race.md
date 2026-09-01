---
type: patch
---

Fixed the Gmail connect button in the Automated Shipment Ingestion modal
briefly showing "Connect Gmail" right after a successful OAuth connection,
instead of reflecting the real connection state. The button now shows a
"Checking status..." state while the server-verified connection status is
being fetched, and the check now retries shortly after the modal opens to
cover the case where Firebase Auth hasn't finished rehydrating the signed-in
user yet after the full-page OAuth redirect back into the app.
