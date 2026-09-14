---
type: patch
---

Smart Import no longer files a delivered Hebrew SMS as still in transit, and no
longer names a carrier it only guessed. A real H&M Israel dispatch message
("נמסרה חבילה שמספרה …", delivered by Tapuz) came in as "in transit" from
"DHL Express": every Hebrew delivered-phrase the parser knew was subject-first
("החבילה נמסרה") while this courier writes verb-first, and the bare ten-digit
number matched DHL and Aramex equally, with the first of the two winning. An
all-digit number that several carriers claim now resolves to "Other" rather
than to whichever matched first — a letter-bearing id such as Yanwen's UB…YP or
Cainiao's LP…CN still identifies its carrier as before.
