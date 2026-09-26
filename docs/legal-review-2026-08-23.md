# Deliveree — Legal Review: Terms of Use & Privacy Policy

> **Update 2026-09-26:** the account-deletion (§0.4) and third-party-disclosure (§0.1, §0.2) findings are re-checked and fixed in [`security-legal-review-2026-09-26.md`](security-legal-review-2026-09-26.md).

**Review date:** 2026-08-23
**Document reviewed:** Deliveree Terms of Use + Privacy Policy (English draft, "Last updated: August 23, 2026")
**Parties:** Sahar Aga (single independent developer, operator/controller) ↔ end users (consumers, primarily in Israel)
**Your side:** Drafter / operator — the "negotiation" here is risk allocation you're choosing to give yourself, not a counterparty fight
**Review basis:** **Generic commercial + privacy standards.** No playbook (`legal.local.md` or equivalent) was found in the repo or Claude config, so this is measured against widely-accepted consumer-app standards, not organisation-specific positions.
**Hebrew version:** Not reviewed (see D6).
**Code verified against:** `main` initially, then re-verified against `feat/smart-import-gemini-fallback` @ `a4e5cb4` (PR #21), which is where this document lives. Findings below reflect the PR branch.

> ⚠️ **Not legal advice.** This is a structured issue list to hand to a lawyer, not a substitute for one. Several items turn on Israeli-law specifics (thresholds, consumer-contract doctrine) that need a qualified Israeli practitioner to confirm.

The draft was checked against the actual code in this repository, not only against the supplied fact list. That surfaced the most serious findings — several statements in the policy are not true of the shipped product. Those come first.

---

## 🔴 Section 0 — Statements that don't match the code (verified)

These are the highest-risk items in the package. A privacy policy that overstates what the product does is a misrepresentation exposure *independent* of any privacy-law breach, and under Israeli consumer law it is the drafter who bears the ambiguity.

### 0.1 — "We don't share account data with anyone except the infrastructure providers named here" is **false**

**PP §5.** `src/services/carrierApiProxy.js:1` sends tracking numbers directly from the client to **Israel Post, Cheetah, HFD, BoxIt, Cainiao, and 17Track** — six third parties, none of which appear anywhere in the policy. `src/services/carrierApiProxy.js:132` confirms a live call to `mypost.israelpost.co.il`.

Two compounding problems:

- **Undisclosed recipients** — GDPR Art. 13(1)(e) and Israeli §11 both require naming (or categorising) recipients.
- **Undisclosed transfer to China.** Cainiao and 17Track are PRC/HK-operated. That is a Chapter V transfer with no mechanism named, and it reads badly to a regulator precisely because the policy affirmatively says it doesn't happen.

### 0.2 — "Guest/offline use never leaves your device" is **false**

**PP §2.** Live tracking is not gated on authentication — `src/services/trackingService.js` has no auth check, and `src/App.jsx:406` calls `batchRefreshTracking` for whatever packages are loaded. A signed-out user who hits refresh sends their tracking number to a carrier endpoint.

**Fix:** either gate live tracking behind sign-in, or rewrite to *"Guest data is not stored on our servers; tracking numbers are still sent to carriers when you refresh live status."*

### 0.3 — "Deletion removes your … feedback association" is **false and currently impossible**

`firestore.rules` stores feedback in a **top-level `/feedback/{feedbackId}` collection**, not under `/users/{uid}`, and the rule is literally `allow update, delete: if false`. **No client — including you — can delete a feedback document.** Feedback carries a masked email, user agent, screen dimensions, and an optional **base64 screenshot up to 750 KB**.

- The erasure promise cannot be honoured → GDPR Art. 17 failure, and Israeli §14 deletion-request failure.
- It collides with **PP §5's "We don't retain raw screenshots."** You *do* retain raw screenshots — the feedback ones, indefinitely, readable by the admin allowlist. §1 discloses feedback screenshots while §5 denies retaining screenshots; a reader cannot reconcile them.

**Fix:** move feedback under the user's subtree with a delete path, or store a `uid` field plus an admin/Cloud-Function deletion routine — and narrow §5 to *"We don't retain screenshots submitted to Smart Import; screenshots you attach to feedback are stored until [X]."*

### 0.4 — "Permanently delete your account and all data" is **not reliably true** — and this branch raises the stakes

`src/context/AuthContext.jsx:873` still has the original defect, and the new training data makes it worse.

The purge is wrapped in `withTimeout(…, 2000)` and **is not awaited**. The code comment above it now asserts an ordering invariant:

> *"Runs before the Auth user is deleted below — the trainingExamples delete rule requires `resource.data.userId == request.auth.uid`, which needs the caller to still be authenticated as targetId."*

**The code does not enforce that invariant.** Because the purge isn't awaited, step 3's `await deleteUser(auth.currentUser)` races it. Whichever finishes first wins, and on a slow connection or a large account it is routinely the Auth deletion. The moment the uid is gone:

- Remaining `packages` documents fail `isOwner(userId)` — orphaned.
- Remaining `trainingExamples` fail `resource.data.userId == request.auth.uid` — and the rules give `allow delete` **only** to the owning uid. **Not even the admin allowlist can delete them** (`isAdmin()` grants read, never delete). They become permanently unreachable from any client, recoverable only via the Admin SDK or the Firebase console.

That is the worst possible residue: the `trainingExamples` collection holds **raw pasted text** (§0.9), it is purged *last* in the sequence, and it is the one collection with no administrative delete path.

Three further defects, unchanged from `main`:

1. If `deleteUser()` throws — Firebase's very common `requires-recent-login` — the code catches it, signs the user out, and clears state. **The UI reports success while the account still exists.**
2. `purgeTrainingExamples` (`AuthContext.jsx:452`) swallows every error into a `console.warn`. A failed purge is silent.
3. The same silent-failure path is used by `updateAiTrainingOptIn`, so **PP §4's "Turning it off … deletes any training data already collected from you" can fail with no signal to the user or to you.**

**Fix before launch:** `await` the purge; delete the Auth user **last**, only after a verification read returns empty; surface genuine failures. Add an Admin-SDK-backed sweep for orphans, and give `isAdmin()` a delete path on `trainingExamples` as a backstop.

### 0.5 — ✅ RESOLVED on this branch — consent versioning now exists

**ToS §6 / PP §8.** On `main` this promised a mechanism that didn't exist. This branch builds it: `src/constants/legal.js` exports `LEGAL_VERSION`, `src/components/LegalConsentGate.jsx` re-gates any signed-in user whose stored `legalAcceptedVersion` doesn't match, and `AuthContext.acceptLegalTerms` persists the accepted version with a timestamp. That also gives you the **Art. 7(1) "demonstrate consent" record** you need for the training opt-in.

Two residual items:

- **Cross-device hydration is best-effort** (`AuthContext.jsx:419`) — a device that can't reach Firestore may re-prompt someone who already accepted. Cosmetic, not legal.
- **A12 still applies**: a user who *declines* the new version must still be able to export and delete. Confirm `LegalConsentGate` doesn't trap them.

### 0.6 — "Export your data" is narrower than the promise

`deliveryService.exportData` (`src/services/deliveryService.js:118`) exports **packages only**. Portability under Art. 20 covers all personal data the subject provided — profile, feedback, opt-in training samples, preferences. Either broaden the export or state precisely what it includes.

### 0.7 — ✅ LARGELY RESOLVED on this branch — and the architecture is good

On `main` none of the AI features existed. This branch ships them, and the design is materially better than the policy text implies:

- **The Gemini call is server-side**, not in the client — `functions/src/index.js` exposes an `onCall` function with the API key held in Secret Manager (`defineSecret('GEMINI_API_KEY')`), so the key never reaches the browser.
- **`enforceAppCheck: true`** plus a server-side `assertAuthenticated` — the ToS §3 claim that AI import "requires being signed in and is rate-limited" is accurate and actually enforced.
- **The function does not persist the payload.** `functions/src/handler.js` passes the text or image straight to `parseWithGemini` and returns the result — nothing is written to Firestore. **PP §3's "We do not store the screenshot itself after parsing" is therefore accurate for the Smart Import path.**
- **The opt-in flag is re-checked server-side** in `firestore.rules` via `get(…/users/$(uid)).data.aiTrainingOptIn == true`, not merely trusted from the client. Genuinely good practice, and worth saying so in PP §4.
- **Usage counters are locked to the Admin SDK** (`match /usage/{docId} { allow read, write: if false; }`), so a client can't fake a lower count.

Remaining gaps are the disclosure ones in section (c) — what exactly is sent, processing location, Google's abuse-monitoring retention — not architectural ones. **Section 0.9 below is the one substantive AI-side defect.**

### 0.8 — Undisclosed admin access

`firestore.rules` grants `saharaga97@gmail.com` read access to **every feedback document**, screenshots included. The policy never discloses that a human operator can read submitted content. Disclose it — it is expected and unobjectionable, but silence about it is not.

### 0.9 — 🔴 Training data is stored **unredacted and directly identifiable**

`src/services/trainingDataService.js` writes to `/trainingExamples` with:

```js
userId,
inputText: typeof inputText === 'string' ? inputText.slice(0, MAX_INPUT_TEXT_LENGTH) : '',
initialValues: pickTrackedFields(initialValues),
correctedValues: pickTrackedFields(correctedValues),
```

`inputText` is the **raw pasted text, truncated to 5000 characters and nothing else**. `src/utils/privacySanitizer.js` — which already implements Israeli mobile/landline, email, credit-card, and address-prefix redaction, and is already used by `feedbackService` — **is never called on this path.**

So the collection accumulates, tied directly to a `userId`:

- the recipient's name, street address, apartment/door code, and phone number, as they appear in a delivery SMS;
- for anyone who opted in, indefinitely, with no retention timer (by design, per PP §4);
- readable by the admin allowlist.

**This is the sharpest privacy exposure in the PR.** The account holder's consent covers *their own* data; it does not cover the sender's or recipient's, and those third parties get no Art. 14 notice and have no way to object. PP §4 describes this as storing "the pasted text and the before/after values of what you corrected" — accurate, but it does not convey that this routinely means a third party's home address.

**Fix:** call `redactPII(inputText)` before the `addDoc`, and store a random sample ID with a separate uid→sample index rather than embedding `userId` in the document. Both changes preserve the feature's usefulness — you are training a parser on *structure*, not on the actual phone numbers.

### 0.10 — `parseCorrections` accepts unauthenticated writes

`firestore.rules` allows `create` on `/parseCorrections/{docId}` with no `isAuthenticated()` check — deliberately, per the comment, so guests can contribute. The data is field names only, so the privacy exposure is nil and PP §4's "we only log which field changed — never the actual text" is **accurate**. Flagging only as a cost/abuse note: an unauthenticated writer can inflate the collection indefinitely. Add App Check or a rate guard.

---

---

## (a) Missing standard clauses

### Terms of Use

| # | Missing clause | Why it matters |
|---|---|---|
| A1 | **Disclaimer of warranties** | Nothing disclaims merchantability, fitness, availability, uptime, or data loss. §4 disclaims *delivery* guarantees only. For alpha software this is the baseline protection and it is simply absent. |
| A2 | **Limitation of liability / damages cap** | **Completely absent.** You are an individual, so exposure is personal and unlimited. The single largest gap in the package. |
| A3 | **Governing law, jurisdiction, venue** | Absent. Specify Israeli law and Israeli courts — while noting it won't strip EU consumers of home-forum protections (Rome I Art. 6). |
| A4 | **User indemnity** | §5 tells users not to submit third parties' data but attaches no consequence. If a user pastes someone's address and that person complains, you carry it alone. |
| A5 | **Right to suspend, modify, or discontinue the service** | Only "automated abuse" suspension is mentioned. You have **no stated right to shut the project down** — essential for an unpaid alpha side project. Pair with a notice period and an export window. |
| A6 | **Minimum age / eligibility** | Required by GDPR Art. 8, by Israeli practice, and by Firebase's and Google's own API terms. Nothing at all currently. |
| A7 | **IP and licence grants — both directions** | No statement that you own the app, no user licence terms, no anti-scraping/reverse-engineering clause. More importantly: **no licence *from* the user to you**, which is what makes it lawful to transmit pasted text to Gemini and store training samples. §2's "your data is yours" grants you nothing. |
| A8 | **Feedback licence** | You collect feature suggestions with no licence to use them. Standard, one sentence, avoids a silly dispute. |
| A9 | **Alpha/beta clause** | Explicitly: features may break or be removed, data may be lost, keep your own backups. §1 gestures at this but doesn't operationalise it. |
| A10 | **Third-party terms flow-down** | Google's Gemini API prohibited-use policy binds your users' inputs through you. |
| A11 | **Boilerplate** | Severability, entire agreement, no waiver, assignment (matters if you ever hand the project off), notices. |
| A12 | **What happens if a user declines updated terms** | §6 blocks account features. Declining users must still be able to **export and delete** — otherwise you've locked people out of their own erasure rights. |

### Privacy Policy

| # | Missing clause | Why it matters |
|---|---|---|
| A13 | **Controller identity and real contact channel** | GDPR Art. 13(1)(a) requires a name and contact details. "Reach the maintainer through the in-app feedback form" is **not adequate** — it fails for anyone who has deleted their account or can't sign in. Publish an email address. |
| A14 | **Legal basis per purpose** | Art. 6. Contract (sync), consent (training opt-in), legitimate interests (rate limiting / abuse). Entirely absent. |
| A15 | **Retention periods** | Art. 13(2)(a). Nothing for accounts, feedback, usage counters, logs, or inactive accounts. "Isn't kept on a timer" covers only training data — and reads as a benefit when it is actually the absence of a retention limit. |
| A16 | **Full rights list** | Access, rectification, restriction, objection, portability, **withdrawal of consent**, and — notably missing — **the right to complain to a supervisory authority** (Israeli PPA / an EU DPA). |
| A17 | **International transfer disclosure + mechanism** | No Firebase region stated, no Gemini processing location, no SCC/DPF reference. Compounded by the undisclosed carrier transfers in §0.1. |
| A18 | **Security measures** | Art. 32 and the Israeli Security Regulations both require this. You have real substance to describe (server-enforced rules, per-account isolation, PII sanitisation) — describe it, plus encryption in transit/at rest and who holds admin access. |
| A19 | **Breach notification commitment** | GDPR Arts. 33/34 (72 hours); Amendment 13 adds a severe-incident duty to the PPA. Nothing in the draft, and no process behind it. |
| A20 | **Sub-processor list + DPA reference** | Name Google (Firebase/GCP, Gemini) as processors, reference Google Cloud's DPA, and list the carriers. |
| A21 | **Children's data statement** | Paired with A6. |
| A22 | **Version archive** | Keep prior versions accessible; you need them to prove what a user consented to. |
| A23 | **Whether providing data is required** | Israeli §11 specifically requires telling the person whether they must provide the data and what happens if they don't. |

---

## (b) Legally risky or overpromising statements

**B1 — "not a company — treat it accordingly" (ToS §1).**
This has **no legal effect whatsoever.** Being an individual doesn't reduce controller obligations under GDPR or Amendment 13, doesn't cap liability, and — because you're operating personally — means **unlimited personal liability**. Keep the sentence for candour, but don't let it stand in for the protections that actually work (A1, A2). The real mitigation is forming an entity (חברה בע"מ, or at minimum עוסק מורשה) before real users arrive.

**B2 — "On the paid tier, Google contractually does not use that content to train its own models" (PP §3).**
You're stating a third party's contractual position as fact you stand behind. Also **materially incomplete**: Google's paid API still retains prompts briefly for abuse monitoring. As written, a reader concludes Google retains nothing. Reword to describe Google's published terms, date it, link it, and disclaim control over Google's practices.

**B3 — Absolute security phrasing.**
"Isolated per account by server-enforced security rules — not just app-level checks" is accurate and good. But combined with §5's unqualified "we don't share," it reads as a guarantee. Add the standard "no method of transmission or storage is completely secure."

**B4 — "Don't use the app to submit … someone else's private information without their consent" (ToS §5).**
This is the sharpest structural issue in the design, not just the drafting. **The core use case is pasting a delivery SMS or email**, which almost always contains a third party's name, address, or phone number. You're asking users not to do the thing the product is for. That makes you a controller for third-party data with no legal basis and no way to give Art. 14 notice.

You already have `src/utils/privacySanitizer.js` with Israeli phone, email, credit-card, and address-prefix redaction — **run it before anything leaves the device and before anything is stored**, and say so in the policy. As of `a4e5cb4` it is not run on the training-data path at all — see §0.9. That converts an unmanaged exposure into a described safeguard.

**B5 — Carrier trademark/affiliation.**
You display Israel Post, HFD, BoxIt, Cheetah, Cainiao, and 17Track names and statuses. There is no non-affiliation disclaimer anywhere. Add one line.

**B6 — Over-drafting is its own risk here.**
Under Israel's Standard Form Contracts Law (חוק החוזים האחידים), a unilateral consumer ToS is a standard contract, and terms that are unduly disadvantageous (תנאים מקפחים) can be struck. A *total* liability exclusion and an *unfettered* unilateral change right are the classic candidates. Don't swing to the opposite extreme: a **reasonable cap** (e.g. the greater of amounts paid or a modest fixed sum, with mandatory carve-outs) and a **notice-based change mechanism** will survive where absolutes won't.

**B7 — "usage counters … not to profile you" (PP §1).**
Fine as a commitment — just make sure it stays true if you later add analytics. Add the counters' retention and reset cadence.

---

## (c) Unclear points — AI/Gemini flow and the opt-in training mechanism

### Gemini data flow

1. **What is actually sent is never specified.** The entire pasted blob, or a redacted subset? Users cannot meaningfully consent to "the content." Enumerate it, and — per B4 — redact first.
2. **The user can't predict when a send happens.** "Only when the free parser can't handle it" makes the trigger invisible. Best practice, and arguably necessary for a clean legal basis: a **per-use confirmation or clear pre-send notice** ("the built-in parser couldn't read this — send to Google to try AI parsing?").
3. **No legal basis stated** for the transfer to Google. Contract performance or consent — pick one and say it.
4. **No processing location or Ch. V mechanism** for the Gemini call.
5. **Google's own retention** is unaddressed beyond training (see B2).
6. **"We do not store the screenshot itself after parsing"** — where does it live *during* parsing? In memory only, or does it transit Firebase Storage? And is the **pasted text** stored by default? §4 implies not, but §3 never says so directly. State both explicitly.
7. **Rate-limit counters** tie AI use to identity; give their retention.
8. Worth adding for Art. 22 clarity: **no automated decision with legal or similarly significant effect** is made about the user.

### Opt-in training data

9. **Third-party data is the core problem — and §0.9 confirms it is unmitigated in code today.** The pasted text you'd store is precisely the text containing someone else's name and address. **The account holder's consent does not cover that third party.** Mandatory PII redaction before storage isn't a nice-to-have — it's what makes the feature defensible.
10. **"Tied to your account"** makes the samples directly identifiable, the highest-risk storage shape — and `trainingDataService.js` does exactly this (§0.9). Prefer a detached random sample ID with a separate deletion index — you keep the deletion capability without the identifiability.
11. **Consent quality at registration.** GDPR Art. 7 requires freely given, granular, unbundled consent. Unchecked-by-default is right. Add explicitly: **declining limits no functionality**, and it is presented separately rather than folded into the signup flow.
12. **"Turning it off deletes any training data already collected" is an overpromise.** You can delete stored *samples*. You cannot un-improve a parser those samples already informed. Say exactly that — otherwise a user reasonably believes their contribution is fully reversible.
13. **No withdrawal statement** — Art. 7(3): withdrawal must be as easy as giving consent, and doesn't retroactively invalidate prior processing.
14. **No scope limits** — how many samples, how long, who can read them. Given §0.8, disclose that you can read them.
15. **Do training samples ever leave Firebase** — e.g. get replayed against Gemini for evaluation? Unstated, and users will assume not.
16. **Store consent records** (timestamp + policy version) — required to demonstrate consent, and there is no versioning today (§0.5).

---

## (d) Israeli Amendment 13 and GDPR gaps

### Israel

**D1 — Security Regulations 2017 (תקנות הגנת הפרטיות (אבטחת מידע)) are the most concrete gap.**
They apply independently of Amendment 13 and require: a **database definition document** (מסמך הגדרות מאגר), a security-level classification, access control and access logging, periodic review, an incident register, and reporting of severe incidents to the PPA. None of this exists in the draft or, as far as visible, in the repo. This is unglamorous paperwork that a regulator asks for first.

**D2 — Amendment 13 registration/notification and DPO thresholds.**
Amendment 13 (in force since August 2025) largely replaced the blanket registration duty with narrower registration/notification obligations, and added a **privacy protection officer** (ממונה על הגנת הפרטיות) requirement for certain controllers — large-scale sensitive processing, high subject counts, and similar triggers. At alpha scale you are almost certainly below them. **Document that assessment now and set a growth trigger to re-check.** Confirm the exact figures with Israeli counsel rather than relying on this document.

**D3 — Amendment 13's real teeth are the administrative fines.** The PPA gained substantive fining power. This is why B1 ("not a company") is not a defence.

**D4 — §11 collection notice.** Must state whether provision is voluntary, the purpose, and to whom data is transferred. See A23 and §0.1.

**D5 — §13/§14 review and correction rights** have their own Israeli procedure and timelines, separate from GDPR. Self-service in Settings is good UX but isn't a substitute for a manual route — especially for someone locked out of their account.

**D6 — The Hebrew version needs an equivalence check, and it is a real risk item.**
Most users will only ever read the Hebrew. This review covered English only. Any divergence will be construed **against you** as drafter under Israeli consumer doctrine. Add a governing-language clause, and have the Hebrew checked line-by-line against the final English — not machine-translated.

**D7 — Direct marketing (§17F)** doesn't apply today (no marketing), but push notifications are already in the codebase. If they ever carry promotional content, the דיוור ישיר regime engages.

### GDPR

**D8 — Art. 27 EU representative.**
A non-EU controller offering services to EU data subjects must appoint one unless the Art. 27(2) exemption applies (occasional processing, no large-scale special-category data, low risk). Incidental EU signups likely fit — but **the clean answer for an alpha is to state the service is offered to users in Israel and decline EU signups**, rather than carry an unresolved Chapter V and Art. 27 posture. That single decision removes a large share of section (d).

**D9 — Art. 30 records of processing.** The small-organisation exemption is narrower than people assume — it doesn't cover non-occasional processing. Keep a one-page RoPA.

**D10 — Art. 28 processor terms.** Accept and reference Google Cloud's DPA and the Gemini API terms explicitly.

**D11 — Art. 35 DPIA.** Probably not required, but AI processing + storing user-corrected text tied to accounts is worth a short documented screening so the "we considered it" record exists.

---

## Priority ranking

### 🔴 Tier 1 — Do not launch without these

1. **Redact PII before storing training data, and detach it from the uid** (§0.9) — the single most important fix in this PR.
2. **Fix the deletion race** (§0.4) — `await` the purge, verify, delete the Auth user last, surface failures, and give admins a delete path on `trainingExamples`.
3. **Make feedback deletable and tie it to the account** (§0.3), then reconcile the screenshot-retention contradiction.
4. **Disclose the carriers and the transfers to China** (§0.1) — and fix "guest data never leaves your device" (§0.2).
5. **Add a limitation of liability clause and an "AS IS" warranty disclaimer** (A1, A2) — the two clauses that actually protect you personally.
6. **Add governing law and jurisdiction** (A3).
7. **Publish a real contact email** (A13).

### 🟡 Tier 2 — Before real user growth

8. Legal bases, retention periods, full rights list including the complaint right (A14–A16).
9. Run `privacySanitizer` before any third-party transmission or training storage, and say so (B4).
10. Per-use confirmation before the Gemini send (c2).
11. Credit the good server-side controls in the policy text (§0.7) — App Check, server-side opt-in re-check, no payload persistence. Free trust, already earned.
12. Age minimum, user indemnity, right to discontinue the service, IP and feedback licences (A4–A9).
13. Israeli Security Regulations documentation set (D1).
14. Decide the EU question deliberately: geofence, or appoint a representative (D8).
15. Breach-notification process, not just a clause (A19).

### 🟢 Tier 3 — Cleanup

16. Boilerplate (A11), carrier non-affiliation line (B5), version archive (A22), broader export (§0.6), admin-access disclosure (§0.8), rewrite the Gemini training claim (B2), soften absolute security language (B3).

---

## Recommended next steps

The drafting is unusually clear and honest for a pre-lawyer draft — plain language, no dark patterns, opt-in genuinely off by default. Its weakness isn't tone; it's that **it describes a product more finished and more self-protective than the one in the repo.** Two things follow:

1. **Close the code/policy gap first, then re-freeze the text.** Seven of the findings above vanish the moment the code matches, and paying a lawyer to review a document that describes unshipped behaviour wastes the review.
2. **Take the entity question seriously before real users arrive.** A2 and B1 are the same problem from two angles: right now every liability in this product lands on you personally, and no clause you write fully fixes that.

When taking this to counsel, lead with Tier 1 plus section (d) — those are the parts where Israeli-specific judgment changes the answer. Tier 3 can be drafted in-house from standard forms.

---

## Appendix — Code references cited

Verified against `feat/smart-import-gemini-fallback` @ `a4e5cb4`.

| Finding | File |
|---|---|
| 0.1, 0.2 | `src/services/carrierApiProxy.js` (lines 1, 132), `src/services/trackingService.js`, `src/App.jsx` |
| 0.3, 0.8 | `firestore.rules` (`/feedback/{feedbackId}`, `isAdmin()`), `src/services/feedbackService.js` |
| 0.4 | `src/context/AuthContext.jsx:873` (`deleteUserAccountAndData`), `:452` (`purgeTrainingExamples`), `:855` (`updateAiTrainingOptIn`), `firestore.rules` (`/trainingExamples` delete rule) |
| 0.5 ✅ | `src/constants/legal.js` (`LEGAL_VERSION`), `src/components/LegalConsentGate.jsx`, `src/context/AuthContext.jsx:828` (`acceptLegalTerms`) |
| 0.6 | `src/services/deliveryService.js:118` (`exportData`) |
| 0.7 ✅ | `functions/src/index.js`, `functions/src/handler.js`, `src/services/aiParseService.js`, `firestore.rules` (`/usage`) |
| 0.9 🔴 | `src/services/trainingDataService.js` (raw `inputText`, embedded `userId`), `src/utils/privacySanitizer.js` (available, unused on this path) |
| 0.10 | `firestore.rules` (`/parseCorrections` create rule), `src/services/parseCorrectionService.js` |
| B4 | `src/utils/privacySanitizer.js` |
| Policy text under review | `src/constants/legal.js` (`TERMS_CONTENT`, `PRIVACY_CONTENT`) |
