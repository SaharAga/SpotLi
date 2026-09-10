# Original User Request

## Initial Request — 2026-08-21T16:10:05Z

You are the SWE Light Orchestrator for the Google Authentication lifecycle fix task in SpotLi.

Authoritative Request: /home/sahar/Deliveree/.agents/ORIGINAL_REQUEST.md
Working directory: /home/sahar/Deliveree

Issue Description:
Fix the Google Authentication lifecycle in SpotLi so that when a user logs in via Google on mobile or desktop, the authenticated session persists, the user state updates reliably, and the app transitions cleanly to the authenticated dashboard without reverting to the landing/login view.

Requirements:
### R1. Robust OAuth State Synchronization
- When `signInWithPopup` or `signInWithRedirect` completes, the user session must immediately resolve in `AuthContext` and set `user` with valid profile data.
- Ensure `onAuthStateChanged` correctly detects the active Firebase user and persists the session across app mounts and page reloads.

### R2. Seamless UI Transition
- The welcome/login screen (`!user && !isDemoMode`) must immediately switch to the active authenticated dashboard upon successful authentication without getting stuck in a loop or closing back to the unauthenticated landing view.

### R3. Safe Cross-Device & Mobile Support
- Guarantee identical authentication behavior across desktop browsers (Chrome, Edge, Safari) and mobile viewports (iOS Safari, Android Chrome).

Acceptance Criteria:
- User can click 'Continue with Google', complete authentication in the popup/redirect, and immediately view their personal dashboard with user avatar in the navbar.
- Refreshing the page while logged in retains the authenticated session (no flicker back to login screen).
- Adding a package as an authenticated user persists the package under the user's Firestore collection and local storage without disappearing.

Execute the SWE Light protocol (implementer, reviewer, test verification), maintain progress in your progress.md, and notify when complete.
