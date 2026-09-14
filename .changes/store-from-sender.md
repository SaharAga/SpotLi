---
type: patch
---

A package created from an email now shows the shop that actually sent it. Store
detection concatenated the sender and the whole message body and took the first
signature that matched anywhere, so a stray word in a footer outranked the
address the mail came from — a SEESTARZ shipping notice containing the word
"bug" was filed as an order from BUG, the Israeli electronics chain, and the
"bug" signature had no word boundary at all so "debug" matched it too. The
sender is now consulted first, and a sender the signature list has never heard
of contributes its own display name rather than losing to a body scan.
