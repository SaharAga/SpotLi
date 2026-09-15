---
type: patch
---

Smart Import now reads two things it was missing from Israeli courier SMS.

A package is recognised as delivered when the message says so with words
between the noun and the verb — "חבילה מSeestarz online מספר 48094292 נמסרה"
was filed as still in transit, because the two had to be adjacent. A handover
to the courier ("נמסרה לשליח") and a negation ("לא נמסרה", "טרם נמסרה") still
are not deliveries.

The merchant is read from the sentence rather than looked up in a catalogue, so
a small shop the app has never heard of is named on the package instead of
"Package 48094292".

The accuracy harness now scores delivery stage and merchant, not just the
tracking number. It reported the reported SMS as a clean pass because the only
thing it measured — the ID — was correct.
