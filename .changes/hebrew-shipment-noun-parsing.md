---
type: patch
---

Smart Import now reads a Hebrew shipment number written without the word
"מספר". A real courier SMS opening "משלוח 19611199 מI-HERB" parsed to no
tracking number at all and had to be entered by hand: every labelled Hebrew
pattern required מספר after the noun, and a bare eight-digit run matches no
carrier format, so the generic token scan discarded it as noise. Hebrew drops
מספר as readily as English drops "number" — the noun running straight into the
value is now accepted, exactly as "order 8471293" already was. The no-label
form takes six characters minimum and no intervening words, so a street number
or a shekel amount beside "משלוח" is not mistaken for a shipment id.
