---
type: patch
---

Split every dialog out of the initial bundle with `React.lazy`, so the fourteen
modals in `App.jsx` are downloaded the first time one is opened rather than
before the package list can paint. The entry chunk drops from 538 kB to 179 kB
(144 kB to 52 kB gzipped), and the total JavaScript fetched on a cold load
falls by about 212 kB (46 kB gzipped).
