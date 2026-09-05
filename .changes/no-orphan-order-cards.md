---
type: patch
---

Email sync no longer adds packages it cannot track. An order-confirmation
email with no carrier tracking number used to create a card showing a store
name, an empty tracking number and a full delivery-stage tracker, with nothing
tying it to the order it came from. The shipping email that carries a real
tracking number creates the package instead.
