# 📋 SpotLi User Feedback Action Items & Bug Backlog

> Triaged, logged, and tracked for SpotLi Alpha Releases.

---

### 🚨 [P0-Critical] Issue #1: [P0-Auth] Session lost on cold reload / mobile tab close
* **ID**: `fb-20260820-001`
* **Status**: `RESOLVED` (v0.3.0-alpha)
* **Category**: `bug` | **Rating**: ⭐ 1/5 | **App Version**: `0.3.0-alpha`
* **Reported by**: Mobile Alpha Testers (iOS / Android)
* **Date**: 2026-08-20T09:30:00+03:00
* **User Feedback (Hebrew)**:
  > "כל פעם שאני סוגר את הטאב או מרענן את הדף בספארי, אני צריך להתחבר מחדש והחבילות נעלמות עד שאני מתחבר שוב."
* **Affected Components**: `src/services/firebase.js`, `src/context/AuthContext.jsx`, `src/App.jsx`
* **Action Items & Resolution**:
  - [x] Configure `setPersistence(auth, browserLocalPersistence)` in `src/services/firebase.js`.
  - [x] Prevent `AuthContext` from dropping cached user on cold start / offline boot `null` emission.
  - [x] Track `isExplicitLogout` ref to only clear credentials and storage on user-initiated `logout()`.
  - [x] Add sleek loading state in `src/App.jsx` during cold start session resolution.

---

### 🚨 [P0-Critical] Issue #2: [P0-UX] iOS Safari auto-zoom on `<16px` inputs causing resolution cutoff
* **ID**: `fb-20260820-002`
* **Status**: `RESOLVED` (v0.3.0-alpha)
* **Category**: `bug` | **Rating**: ⭐ 2/5 | **App Version**: `0.3.0-alpha`
* **Reported by**: iOS Safari Alpha Testers
* **Date**: 2026-08-20T09:32:00+03:00
* **User Feedback (Hebrew)**:
  > "בזמן הקלדת מספר מעקב או טקסט באייפון, המסך עושה זום אוטומטי מוגזם וחותך את שולי האפליקציה וכפתורי השמירה."
* **Affected Components**: `src/index.css`, `src/components/AuthModal.jsx`, `src/components/AddEditPackageModal.jsx`, `src/components/FilterBar.jsx`, `src/components/FeedbackModal.jsx`, `src/components/SmartImportModal.jsx`, `src/components/AccountModal.jsx`
* **Action Items & Resolution**:
  - [x] Add `-webkit-text-size-adjust: 100%;` on `html` and `body` in `src/index.css`.
  - [x] Add mobile media query rule enforcing `font-size: 16px !important;` for `input, select, textarea`.
  - [x] Update all modal form controls to `text-base sm:text-sm` (16px on mobile) to eliminate iOS Safari viewport zoom.

---

### ⚠️ [P1-High] Issue #3: [P1-PWA] Version mismatch (v0.2.1 vs v0.2.2/v0.3.0) and stale SW cache update mechanism
* **ID**: `fb-20260820-003`
* **Status**: `RESOLVED` (v0.3.0-alpha)
* **Category**: `bug` | **Rating**: ⭐ 3/5 | **App Version**: `0.3.0-alpha`
* **Reported by**: Desktop & Mobile Alpha Testers
* **Date**: 2026-08-20T09:35:00+03:00
* **User Feedback (Hebrew)**:
  > "בחלון אודות מופיע מספר גרסה שונה ממה שנמצא ב-package.json, וכשמעלים עדכון חדש הדפדפן ממשיך להציג גרסה ישנה מהמטמון."
* **Affected Components**: `package.json`, `src/constants/version.js`, `public/sw.js`, `src/components/AboutModal.jsx`
* **Action Items & Resolution**:
  - [x] Align `package.json` and `src/constants/version.js` to `0.3.0-alpha` (Release Date: `2026-08-20`).
  - [x] Bump Service Worker cache name to `deliveree-cache-v0.3.1-alpha`.
  - [x] Enforce network-first strategy for navigation, scripts, and assets in `public/sw.js`.
  - [x] Improve `handleCheckForUpdates` to detect `registration.waiting` / `registration.installing` and show update available prompt.
  - [x] Add "Clear Cache & Force Refresh" button in `AboutModal.jsx`.

---
