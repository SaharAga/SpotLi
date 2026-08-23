/**
 * Terms of Use & Privacy Policy content, plus the version stamp that gates
 * LegalConsentGate (src/components/LegalConsentGate.jsx). Bump LEGAL_VERSION
 * whenever the substance of either document changes — every signed-in user
 * whose stored `legalAcceptedVersion` doesn't match gets re-gated.
 *
 * NOT LEGAL ADVICE: this is a working draft written by an engineer, not a
 * lawyer, revised once against a structured contract-review pass (see
 * docs/legal-review-2026-08-23.md if present in the repo). It's meant to be
 * honest and specific about what the app actually does with user data, but
 * it still hasn't had a qualified Israeli lawyer's review — get one,
 * especially for: Israeli Privacy Protection Law Amendment 13 and the 2017
 * Security Regulations (neither of which this app has the underlying
 * paperwork for yet — a database-definitions document, a security-level
 * classification, an incident register); entity formation (this is
 * currently an individual operating personally, which means unlimited
 * personal liability no clause below fully removes); and the unresolved
 * gap that /feedback is deliberately anonymous by design (no uid is ever
 * stored on a feedback doc) and therefore cannot currently be deleted
 * per-account — that's a real tension between anonymity and the erasure
 * right this document promises, not yet decided.
 *
 * Scope: this app is currently offered only to users in Israel (see the
 * "Where this is offered" section) — a deliberate choice to avoid carrying
 * an unresolved EU representative/international-transfer posture while
 * still in alpha.
 */

export const LEGAL_VERSION = '2026-08-23.2';

const CONTACT_EMAIL = 'saharaga97@gmail.com';

export const TERMS_CONTENT = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: August 23, 2026',
    sections: [
      {
        heading: 'What this is',
        body: 'Deliveree is a package-tracking app, currently in alpha. It works fully offline without an account; creating an account adds cross-device sync via Firebase. It is built and operated by a single individual developer, not a registered company — every liability below falls on that individual personally, not a corporate entity. Features may change, break, or be removed without notice at this stage; keep your own backup of anything important (the export tool in Account Settings makes this easy).'
      },
      {
        heading: 'Where this is offered',
        body: 'This service is offered only to individuals located in Israel. It is not offered to, and should not be used by, residents of the European Economic Area, the UK, or Switzerland.'
      },
      {
        heading: 'Eligibility',
        body: 'You must be at least 16 years old to create an account. Deliveree does not knowingly collect account data from anyone younger, and has no mechanism for parental consent — if you believe a minor has created an account, contact us and it will be removed.'
      },
      {
        heading: 'Your content and the licence you grant us',
        body: 'Package and tracking information you enter remains yours. To operate the service — including syncing it across your devices, sending it to a carrier to check status, or sending pasted text/screenshots to Google’s Gemini API when you use Smart Import — you grant us a limited licence to store, process, and transmit that content solely for those purposes. We don’t use it for anything else (see the Privacy Policy). Feedback and suggestions you submit may be used to improve the app without further compensation or attribution to you.'
      },
      {
        heading: 'Third-party carriers',
        body: 'To check live status, Deliveree sends your tracking number directly to the relevant carrier’s own systems (currently Israel Post, HFD, Cheetah, BoxIt, Cainiao, and 17Track, depending on which carrier you’re tracking with — see the Privacy Policy for what that involves). Carrier names and logos shown in the app belong to their respective owners; Deliveree is not affiliated with, endorsed by, or operated by any of them, and has no control over their tracking data’s accuracy.'
      },
      {
        heading: 'AI-assisted import',
        body: 'Pasted text or screenshots you submit to Smart Import may be sent to Google’s Gemini API to extract package details, only when the free built-in parser can’t handle it (for pasted text) or always (for a screenshot, which the built-in parser can’t read at all). This requires being signed in and is rate-limited. Your use of this feature is also subject to Google’s Gemini API prohibited-use policy — don’t submit content through it that would violate Google’s terms.'
      },
      {
        heading: 'No delivery guarantees',
        body: 'Deliveree displays tracking information sourced from carriers or estimated by the app; it does not ship, handle, or guarantee delivery of any package. Live tracking accuracy depends entirely on the carrier and, for AI-assisted parsing, on the accuracy of the underlying model — always verify important details independently.'
      },
      {
        heading: 'Acceptable use',
        body: 'Don’t use the app to submit unlawful or abusive content. Smart Import is built around pasting real courier messages, which often contain a third party’s name, address, or phone number — the app automatically redacts common PII patterns before that content is sent anywhere or stored for the accuracy-improvement opt-in, but this redaction isn’t perfect, so don’t rely on it as a substitute for your own judgment about what you paste. You’re responsible for having a lawful basis to share any third party’s information you do submit, and agree to indemnify us against claims arising from your submission of content that violates this section. Automated abuse of rate-limited features (e.g. scripting around the AI parsing caps) may result in account suspension.'
      },
      {
        heading: 'No warranty; limitation of liability',
        body: 'The service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, or uninterrupted/error-free operation. To the fullest extent permitted by law, and except for liability that cannot be excluded by law (such as for fraud or willful misconduct), total liability for any claim arising from your use of the service is limited to the greater of (a) amounts you’ve paid to use it (currently zero — the service is free) or (b) NIS 500. This limitation reflects that the service is provided free of charge by an individual, not a company with the resources to absorb unlimited exposure — it is not intended to exclude liability more broadly than that, and won’t be enforced to the extent doing so would be an unduly disadvantageous term under Israel’s Standard Form Contracts Law.'
      },
      {
        heading: 'Suspending or discontinuing the service',
        body: 'We may suspend an account for abuse (see "Acceptable use"), or discontinue the service entirely at our discretion. Outside of an abuse suspension, we’ll give at least 30 days’ notice in-app before discontinuing the service, so you have time to export your data.'
      },
      {
        heading: 'Changes to these terms',
        body: 'These terms may change as the app evolves. A meaningful change bumps the version below and re-prompts every signed-in user for acceptance before they can continue using account-linked features — declining doesn’t block you from exporting or deleting your existing data, only from further use of the service.'
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws of the State of Israel, and any dispute is subject to the exclusive jurisdiction of the competent courts in Israel.'
      },
      {
        heading: 'General',
        body: 'If any provision of these terms is found unenforceable, the rest remains in effect. Not enforcing a provision on one occasion isn’t a waiver of it. These terms aren’t transferable by you without consent, but may be assigned by us if the project changes hands.'
      },
      {
        heading: 'Contact',
        body: `Questions, a privacy concern, or a legal notice: ${CONTACT_EMAIL}, or the in-app feedback form (Settings → About → Send Feedback) for anything that doesn’t require a reply to an account you can no longer access.`
      }
    ]
  },
  he: {
    title: 'תנאי שימוש',
    updated: 'עודכן לאחרונה: 23 באוגוסט 2026',
    sections: [
      {
        heading: 'מה זה',
        body: 'Deliveree היא אפליקציית מעקב חבילות, כרגע בשלב אלפה. היא פועלת באופן מלא גם ללא חשבון; יצירת חשבון מוסיפה סנכרון בין מכשירים דרך Firebase. היא מפותחת ומופעלת על ידי מפתח יחיד, ולא חברה רשומה — כל אחריות המפורטת להלן חלה על אותו יחיד באופן אישי, לא על ישות תאגידית. תכונות עשויות להשתנות, להישבר או להוסר ללא הודעה מוקדמת בשלב זה — שמרו גיבוי משלכם לכל דבר חשוב (כלי הייצוא בהגדרות החשבון מקל על כך).'
      },
      {
        heading: 'היכן השירות מוצע',
        body: 'שירות זה מוצע רק ליחידים הנמצאים בישראל. הוא אינו מוצע, ואין להשתמש בו, על ידי תושבי האזור הכלכלי האירופי, בריטניה או שווייץ.'
      },
      {
        heading: 'זכאות',
        body: 'עליך להיות בן/בת 16 לפחות כדי ליצור חשבון. Deliveree אינה אוספת ביודעין מידע חשבון ממי שצעיר יותר, ואין לה מנגנון להסכמת הורים — אם לדעתך קטין יצר חשבון, צרו קשר והוא יוסר.'
      },
      {
        heading: 'התוכן שלך והרישיון שאתה מעניק לנו',
        body: 'פרטי חבילות ומעקב שאתה מזין נשארים שלך. כדי להפעיל את השירות — כולל סנכרון בין המכשירים שלך, שליחה לספק לבדיקת סטטוס, או שליחת טקסט מודבק/צילומי מסך ל-API של Gemini של Google בשימוש בייבוא חכם — אתה מעניק לנו רישיון מוגבל לאחסן, לעבד ולהעביר תוכן זה אך ורק למטרות אלו. איננו משתמשים בו לכל מטרה אחרת (ראו מדיניות פרטיות). משוב והצעות שאתה שולח עשויים לשמש לשיפור האפליקציה ללא תמורה או ייחוס נוספים.'
      },
      {
        heading: 'ספקי שילוח צד שלישי',
        body: 'כדי לבדוק סטטוס בזמן אמת, Deliveree שולחת את מספר המעקב שלך ישירות למערכות הספק הרלוונטי (כיום דואר ישראל, HFD, צ\'יטה, בוקסיט, קאיניאו ו-17Track, בהתאם לספק שאתו אתה עוקב — ראו מדיניות פרטיות). שמות ולוגואים של ספקים המוצגים באפליקציה שייכים לבעליהם; Deliveree אינה קשורה, מאושרת או מופעלת על ידי אף אחד מהם, ואין לה שליטה על דיוק נתוני המעקב שלהם.'
      },
      {
        heading: 'ייבוא בעזרת AI',
        body: 'טקסט מודבק או צילומי מסך שאתה מעביר בייבוא החכם עשויים להישלח ל-API של Gemini של Google לצורך חילוץ פרטי החבילה, רק כאשר המנתח החופשי המובנה אינו מצליח לטפל בו (לטקסט מודבק) או תמיד (לצילום מסך, שהמנתח המובנה אינו יכול לקרוא כלל). זה דורש חיבור וכפוף למגבלת תדירות. השימוש שלך בתכונה זו כפוף גם למדיניות השימוש האסור של API של Gemini של Google.'
      },
      {
        heading: 'אין התחייבות מסירה',
        body: 'Deliveree מציגה מידע מעקב ממקורות חיצוניים או מוערך על ידי האפליקציה; היא אינה משלחת או מטפלת בחבילות ואינה מבטיחה מסירה. יש לאמת פרטים חשובים באופן עצמאי.'
      },
      {
        heading: 'שימוש תקין',
        body: 'אין להשתמש באפליקציה כדי להעביר תוכן בלתי-חוקי או פוגעני. ייבוא חכם בנוי סביב הדבקת הודעות שילוח אמיתיות, שלעיתים קרובות כוללות שם, כתובת או מספר טלפון של צד שלישי — האפליקציה מסתירה אוטומטית דפוסי מידע אישי נפוצים לפני שהתוכן נשלח לכל מקום או נשמר עבור הצטרפות שיפור הדיוק, אך הסתרה זו אינה מושלמת, אז אל תסתמכו עליה כתחליף לשיקול דעתכם. אתה אחראי לכך שיש לך בסיס חוקי לשתף מידע של צד שלישי שאתה מגיש, ומסכים לשפות אותנו מפני תביעות הנובעות מהגשת תוכן המפר סעיף זה. שימוש לרעה במגבלות הקצב עלול להוביל להשהיית החשבון.'
      },
      {
        heading: 'אין אחריות; הגבלת חבות',
        body: 'השירות ניתן "כפי שהוא" ו"כפי שזמין", ללא אחריות מכל סוג. במידה המרבית המותרת בחוק, וללא אחריות שלא ניתן להחריג בחוק (כגון הונאה או זדון), החבות הכוללת לכל תביעה הנובעת משימושך בשירות מוגבלת לגבוה מבין: (א) סכומים ששילמת עבור השירות (כיום אפס — השירות ניתן ללא תשלום) או (ב) 500 ש"ח. הגבלה זו משקפת שהשירות ניתן ללא תשלום על ידי יחיד, לא חברה עם משאבים לספוג חשיפה בלתי מוגבלת — היא אינה מיועדת להחריג אחריות מעבר לכך, ולא תיאכף במידה שהדבר יהווה תנאי מקפח לפי חוק החוזים האחידים.'
      },
      {
        heading: 'השהיה או הפסקת השירות',
        body: 'אנו רשאים להשהות חשבון בגין שימוש לרעה (ראו "שימוש תקין"), או להפסיק את השירות כליל לפי שיקול דעתנו. מלבד השהיה בגין שימוש לרעה, ניתן הודעה של 30 יום לפחות באפליקציה לפני הפסקת השירות, כדי לאפשר לך לייצא את המידע שלך.'
      },
      {
        heading: 'שינויים בתנאים אלו',
        body: 'תנאים אלו עשויים להשתנות עם התפתחות האפליקציה. שינוי מהותי מעלה את הגרסה למטה ומבקש אישור מחודש מכל משתמש מחובר טרם המשך השימוש בתכונות הקשורות לחשבון — סירוב אינו חוסם ייצוא או מחיקה של המידע הקיים שלך, רק המשך שימוש בשירות.'
      },
      {
        heading: 'דין חל',
        body: 'תנאים אלו כפופים לדיני מדינת ישראל, וכל מחלוקת כפופה לסמכות השיפוט הבלעדית של בתי המשפט המוסמכים בישראל.'
      },
      {
        heading: 'כללי',
        body: 'אם הוראה כלשהי בתנאים אלו תימצא בלתי אכיפה, השאר יישאר בתוקף. אי אכיפת הוראה במקרה אחד אינה ויתור עליה. תנאים אלו אינם ניתנים להעברה על ידך ללא הסכמה, אך עשויים להיות מומחים על ידינו אם הפרויקט יעבור לידיים אחרות.'
      },
      {
        heading: 'יצירת קשר',
        body: `שאלות, פנייה בנושא פרטיות, או הודעה משפטית: ${CONTACT_EMAIL}, או טופס המשוב באפליקציה (הגדרות ← אודות ← שלח משוב) לכל דבר שאינו דורש מענה לחשבון שאין לך יותר גישה אליו.`
      }
    ]
  }
};

export const PRIVACY_CONTENT = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: August 23, 2026',
    sections: [
      {
        heading: 'Who controls this data',
        body: `Deliveree is operated by an individual developer, not a registered company. Contact for any privacy request or question: ${CONTACT_EMAIL}. Use this address (not only in-app feedback) if you’ve deleted your account or otherwise can’t sign in — it's the one channel guaranteed to reach us regardless of your account state.`
      },
      {
        heading: 'Where this is offered',
        body: 'This service is offered only to individuals located in Israel, and this policy is written on that basis. It isn’t offered to residents of the EEA, UK, or Switzerland.'
      },
      {
        heading: 'What we collect, and why',
        body: 'Account info (name, email) from your chosen sign-in method — to operate your account (contractual necessity). Package and tracking data you enter — to provide the tracking feature itself (contractual necessity). Optional feedback and screenshots you submit — with your consent, to improve the app. Usage counters for the AI parsing feature, only if you sign in — to enforce daily limits (our legitimate interest in preventing abuse of a paid third-party API), not to profile you. Providing account and package data is required for those features to work; declining doesn’t affect anything else in the app, since account creation itself is optional.'
      },
      {
        heading: 'Where it lives, and security',
        body: 'Everything is stored in Firebase (Firestore + Authentication), operated by Google Cloud, isolated per account by server-enforced security rules — not just app-level checks — and encrypted in transit (TLS) and at rest (Firebase-managed). A single allowlisted, email-verified administrator account can read submitted feedback (including any attached screenshot) for support and triage purposes; no other account has that access. No method of transmission or storage is completely secure, and we can’t guarantee absolute security.'
      },
      {
        heading: 'Who we share data with',
        body: 'We don’t sell your data or use it for advertising. We do share it with the specific third parties needed to provide the features you use: Google Cloud / Firebase (hosting, database, authentication — all your account and package data passes through this infrastructure); the shipping carrier for a package you’re tracking (currently Israel Post, HFD, Cheetah, BoxIt, Cainiao, or 17Track, depending on the carrier — your tracking number is sent directly to that carrier’s own systems each time you check live status, whether or not you’re signed in); and Google’s Gemini API, only for the specific Smart Import request you trigger. Cainiao and 17Track are operated from mainland China / Hong Kong — checking a package tracked with those carriers means your tracking number is transferred there; we haven’t yet documented a formal international-transfer safeguard for that beyond what those carriers’ own terms provide, which is a known gap flagged for legal review.'
      },
      {
        heading: 'AI-assisted import & Google Gemini',
        body: 'When Smart Import’s built-in parser can’t read your pasted text, or you attach a screenshot, that content is sent to Google’s Gemini API (billed under Google’s paid tier) to extract package details, on the legal basis of performing the feature you’ve asked for. Before pasted text is sent, common PII patterns (emails, phone numbers, "recipient:"/"c/o:"-style labels) are automatically redacted on your device — this is best-effort, not guaranteed complete, and doesn’t apply to screenshots (redacting an image before sending it would defeat the point of reading it). As described in Google’s published API terms as of this writing, the paid tier isn’t used to train Google’s models, though Google may briefly retain content for abuse monitoring — we don’t control Google’s practices beyond what they publish. We don’t store the screenshot itself after parsing, and don’t store the pasted text either unless you’ve separately opted in below.'
      },
      {
        heading: 'Help us improve accuracy (opt-in)',
        body: 'By default, if you edit a field Smart Import auto-filled, we only log which field changed — never the actual text. If you separately opt in (at registration, or anytime in Settings), we additionally store the pasted text and the before/after values of what you corrected, tied to your account (not anonymized to a separate identifier), so we can improve the parser on real mistakes. The same on-device PII redaction described above is applied before storage. This is off by default and requires no functionality — declining doesn’t limit anything else. You can withdraw this consent anytime in Settings; withdrawing doesn’t affect the lawfulness of processing already done, and deletes the samples already stored from you (it can’t undo any improvement already made to the parser using them — only the stored data disappears, not its prior effect).'
      },
      {
        heading: 'Live tracking and guest use',
        body: 'Guest (signed-out) use works fully offline and nothing is stored on our servers for you. However, refreshing live status — signed in or not — sends your tracking number to the relevant carrier’s systems each time, as described above; that part isn’t local-only regardless of sign-in state.'
      },
      {
        heading: 'Feedback',
        body: 'Feedback is intentionally collected without any account link — no user ID, name, or email is attached, even if you were signed in when you submitted it. This means feedback can’t currently be located or deleted by account: it isn’t covered by the account-deletion process below. This is a known open gap between our anonymity design and full data-subject rights, and is flagged for resolution rather than silently accepted.'
      },
      {
        heading: 'Retention',
        body: 'Account and package data: kept until you delete your account. Feedback: no fixed retention period is currently defined — flagged above as needing one. AI-parsing usage counters: reset daily, not kept beyond the current day’s count. Opted-in training samples: kept until you turn the opt-in off or delete your account, whichever comes first — no separate timer.'
      },
      {
        heading: 'Your rights',
        body: 'You can access, correct, or export your account and package data anytime from Account Settings. You can withdraw the AI-training opt-in, and object to or restrict processing, from the same place. You can request permanent deletion of your account and everything tied to it (except feedback, per the gap noted above) from Settings → Danger Zone — this cannot be undone. If you believe we’ve mishandled your data, you can also complain to Israel’s Privacy Protection Authority.'
      },
      {
        heading: 'Cookies & local storage',
        body: 'The app uses browser local storage and IndexedDB to work offline and remember your preferences on this device — not third-party tracking cookies.'
      },
      {
        heading: 'Children',
        body: 'This service isn’t directed at, and account creation requires being at least 16 — see the Terms of Use.'
      },
      {
        heading: 'Changes',
        body: 'A meaningful change to this policy bumps the version below and re-prompts every signed-in user for acceptance.'
      }
    ]
  },
  he: {
    title: 'מדיניות פרטיות',
    updated: 'עודכן לאחרונה: 23 באוגוסט 2026',
    sections: [
      {
        heading: 'מי שולט במידע זה',
        body: `Deliveree מופעלת על ידי מפתח יחיד, ולא חברה רשומה. ליצירת קשר בכל בקשת או שאלת פרטיות: ${CONTACT_EMAIL}. השתמשו בכתובת זו (לא רק במשוב באפליקציה) אם מחקתם את חשבונכם או שאינכם יכולים להתחבר — זהו הערוץ היחיד המובטח שיגיע אלינו ללא תלות במצב החשבון שלכם.`
      },
      {
        heading: 'היכן השירות מוצע',
        body: 'שירות זה מוצע רק ליחידים הנמצאים בישראל, ומדיניות זו נכתבה על בסיס זה. הוא אינו מוצע לתושבי האזור הכלכלי האירופי, בריטניה או שווייץ.'
      },
      {
        heading: 'מה אנחנו אוספים, ולמה',
        body: 'פרטי חשבון (שם, אימייל) מאמצעי ההתחברות שבחרת — להפעלת חשבונך (הכרח חוזי). פרטי חבילות ומעקב שאתה מזין — לספק את תכונת המעקב עצמה (הכרח חוזי). משוב וצילומי מסך אופציונליים שאתה שולח — בהסכמתך, לשיפור האפליקציה. מוני שימוש עבור תכונת ה-AI, רק אם התחברת — לאכיפת מגבלות יומיות (האינטרס הלגיטימי שלנו במניעת שימוש לרעה ב-API צד שלישי בתשלום), לא לפרופיל שלך. מתן פרטי חשבון וחבילות נדרש כדי שתכונות אלו יעבדו; סירוב אינו משפיע על שאר האפליקציה, שכן יצירת חשבון עצמה היא אופציונלית.'
      },
      {
        heading: 'היכן זה נשמר, ואבטחה',
        body: 'הכל נשמר ב-Firebase (Firestore + Authentication), מופעל על ידי Google Cloud, מבודד לפי חשבון באמצעות כללי אבטחה בצד השרת — ולא רק בדיקות ברמת האפליקציה — ומוצפן בהעברה (TLS) ובמנוחה (מנוהל על ידי Firebase). חשבון מנהל יחיד ברשימה מורשית ומאומת-אימייל יכול לקרוא משוב שהוגש (כולל צילום מסך מצורף) למטרות תמיכה ומיון; לאף חשבון אחר אין גישה זו. אין שיטת העברה או אחסון בטוחה לחלוטין, ואיננו יכולים להבטיח אבטחה מוחלטת.'
      },
      {
        heading: 'עם מי אנחנו משתפים מידע',
        body: 'איננו מוכרים את המידע שלך או משתמשים בו לפרסום. אנו כן משתפים אותו עם הצדדים השלישיים הספציפיים הנדרשים לספק את התכונות שבהן אתה משתמש: Google Cloud / Firebase (אחסון, מסד נתונים, אימות); ספק השילוח של חבילה שאתה עוקב אחריה (כיום דואר ישראל, HFD, צ\'יטה, בוקסיט, קאיניאו או 17Track — מספר המעקב שלך נשלח ישירות למערכות אותו ספק בכל בדיקת סטטוס בזמן אמת, בין אם אתה מחובר ובין אם לא); ו-API של Gemini של Google, רק עבור בקשת ייבוא חכם ספציפית שהפעלת. קאיניאו ו-17Track מופעלות מסין היבשתית / הונג קונג — בדיקת חבילה שנעקבת דרך ספקים אלו משמעה שמספר המעקב שלך מועבר לשם; טרם תיעדנו מנגנון הגנה פורמלי להעברה בינלאומית מעבר למה שמספקים תנאי הספקים עצמם — פער ידוע המסומן לבדיקה משפטית.'
      },
      {
        heading: 'ייבוא בעזרת AI ו-Google Gemini',
        body: 'כאשר המנתח המובנה בייבוא החכם אינו מצליח לקרוא את הטקסט שהדבקת, או שצירפת צילום מסך, התוכן נשלח ל-API של Gemini של Google (מחויב במסלול המשולם) לחילוץ פרטי החבילה, על בסיס ביצוע התכונה שביקשת. לפני שליחת טקסט מודבק, דפוסי מידע אישי נפוצים (אימיילים, מספרי טלפון, תוויות מסוג "recipient:"/"c/o:") מוסתרים אוטומטית במכשירך — זהו מאמץ סביר, לא מובטח כמושלם, ואינו חל על צילומי מסך. כמתואר בתנאי ה-API הפומביים של Google נכון לכתיבת שורות אלו, המסלול המשולם אינו משמש לאימון מודלים של Google, אם כי Google עשויה לשמור תוכן לזמן קצר לניטור שימוש לרעה — איננו שולטים בפרקטיקות של Google מעבר למה שהיא מפרסמת. איננו שומרים את הצילום עצמו לאחר הניתוח, ואיננו שומרים גם את הטקסט המודבק אלא אם הצטרפת בנפרד להלן.'
      },
      {
        heading: 'עזרו לשפר דיוק (הצטרפות)',
        body: 'כברירת מחדל, אם אתה מעריך שדה ש-Smart Import מילא אוטומטית, אנו רושמים רק איזה שדה השתנה — לא את הטקסט עצמו. אם תצטרף בנפרד (ברישום או בכל עת בהגדרות), נאגר גם את הטקסט שהדבקת ואת הערכים לפני/אחרי התיקון, מקושר לחשבונך (לא מאונונם למזהה נפרד), כדי לשפר את המנתח על בסיס טעויות אמיתיות. אותה הסתרת מידע אישי מתוארת לעיל מוחלת לפני האחסון. ברירת מחדל כבויה ואינה מגבילה שום פונקציונליות. ניתן למשוך הסכמה זו בכל עת בהגדרות; משיכה אינה משפיעה על חוקיות העיבוד שכבר בוצע, ומוחקת את הדוגמאות שכבר נאספו ממך (אינה יכולה לבטל שיפור שכבר בוצע במנתח באמצעותן — רק המידע השמור נעלם).'
      },
      {
        heading: 'מעקב חי ושימוש אורח',
        body: 'שימוש אורח (לא מחובר) פועל באופן מלא לא מקוון ושום דבר אינו נשמר בשרתינו עבורך. עם זאת, רענון סטטוס חי — מחובר או לא — שולח את מספר המעקב שלך למערכות הספק הרלוונטי בכל פעם, כמתואר לעיל; חלק זה אינו מקומי בלבד ללא תלות במצב ההתחברות.'
      },
      {
        heading: 'משוב',
        body: 'משוב נאסף בכוונה ללא כל קישור לחשבון — לא מזהה משתמש, שם או אימייל מצורפים, גם אם היית מחובר בעת ההגשה. משמעות הדבר שמשוב אינו ניתן כרגע לאיתור או מחיקה לפי חשבון: הוא אינו מכוסה בתהליך מחיקת החשבון להלן. זהו פער פתוח ידוע בין עיצוב האנונימיות שלנו לבין זכויות מלאות של נושא המידע, והוא מסומן לפתרון ולא מתקבל בשתיקה.'
      },
      {
        heading: 'שמירת מידע',
        body: 'פרטי חשבון וחבילות: נשמרים עד למחיקת חשבונך. משוב: אין כרגע תקופת שמירה קבועה — מסומן לעיל כדורש הגדרה. מוני שימוש ב-AI: מתאפסים יומית. דוגמאות אימון שהצטרפת אליהן: נשמרות עד לכיבוי ההצטרפות או מחיקת החשבון, המוקדם מביניהם.'
      },
      {
        heading: 'הזכויות שלך',
        body: 'ניתן לגשת, לתקן או לייצא את פרטי החשבון והחבילות שלך בכל עת מהגדרות החשבון. ניתן למשוך את ההצטרפות לשיפור AI, ולהתנגד או להגביל עיבוד, מאותו מקום. ניתן לבקש מחיקה לצמיתות של חשבונך וכל המידע הקשור אליו (מלבד משוב, כמצוין לעיל) מ-Settings ← אזורת סכנה — לא ניתן לבטל. אם לדעתך טיפלנו במידע שלך שלא כראוי, ניתן גם להגיש תלונה לרשות להגנת הפרטיות.'
      },
      {
        heading: 'עוגיות ואחסון מקומי',
        body: 'האפליקציה משתמשת באחסון מקומי ו-IndexedDB כדי לעבוד לא מקוון ולזכור העדפות שלך במכשיר זה — לא עוגיות מעקב צד שלישי.'
      },
      {
        heading: 'קטינים',
        body: 'שירות זה אינו מיועד לקטינים, ויצירת חשבון דורשת גיל 16 לפחות — ראו תנאי שימוש.'
      },
      {
        heading: 'שינויים',
        body: 'שינוי מהותי במדיניות זו מעלה את הגרסה למטה ומבקש אישור מחודש מכל משתמש מחובר.'
      }
    ]
  }
};
