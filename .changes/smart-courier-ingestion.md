---
type: minor
---

Enhanced Israeli & Global courier SMS intelligence, short URL unshortening support, and live ingestion UI badges.
- Expanded carrier definitions, detection rules, brand colors, and URL templates for Bar Distribution (`bar-distribution`), LionWheel (`lionwheel`), Buzzr (`buzzr`), Tapuz (`tapuz`), Cheetah (`chita`), and SHEIN (`shein`).
- Expanded store detection with bilingual Hebrew & English keywords for AliExpress, SHEIN, Amazon, iHerb, Temu, Zara, ASOS, KSP, and Ivory.
- Created `urlUnshortenerService` with short URL extraction and network resolution helpers.
- Added live detection badges (Store, Pickup Location, Locker PIN) and a 1-tap quick auto-fill action in `AddEditPackageModal`.
- Added a comprehensive 40-sample SMS corpus (`smsCorpus.js`) and characterization test suite with 100% precision.
