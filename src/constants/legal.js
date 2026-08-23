/**
 * Terms of Use & Privacy Policy content, plus the version stamp that gates
 * LegalConsentGate (src/components/LegalConsentGate.jsx). Bump LEGAL_VERSION
 * whenever the substance of either document changes — every signed-in user
 * whose stored `legalAcceptedVersion` doesn't match gets re-gated.
 *
 * NOT LEGAL ADVICE: this is a working draft written by an engineer, not a
 * lawyer. It's meant to be honest and specific about what the app actually
 * does with user data (including the Gemini API integration and the AI
 * training opt-in), but it hasn't had a legal review. Get one — especially
 * for Israeli Privacy Protection Law (Amendment 13) and any GDPR exposure —
 * before this is relied on as an actual binding agreement.
 */

export const LEGAL_VERSION = '2026-08-23';

export const TERMS_CONTENT = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: August 23, 2026',
    sections: [
      {
        heading: 'What this is',
        body: 'Deliveree is a package-tracking app. It works fully offline without an account; creating an account adds cross-device sync via Firebase. This is an alpha-stage product built and operated by a single developer, not a company — treat it accordingly.'
      },
      {
        heading: 'Your data',
        body: 'Package and tracking information you enter is yours. Signed-in data is stored in Firebase (Google Cloud infrastructure) and isolated per account by server-side security rules. You can export or permanently delete your account and all associated data at any time from Account Settings.'
      },
      {
        heading: 'AI-assisted import',
        body: 'Pasted text or screenshots you submit to Smart Import may be sent to Google’s Gemini API to extract package details, only when the free built-in parser can’t handle it. This requires being signed in and is rate-limited. See the Privacy Policy for what that third-party call involves.'
      },
      {
        heading: 'No delivery guarantees',
        body: 'Deliveree displays tracking information sourced from carriers or estimated by the app; it does not ship, handle, or guarantee delivery of any package. Live tracking accuracy depends entirely on the carrier and, for AI-assisted parsing, on the accuracy of the underlying model — always verify important details independently.'
      },
      {
        heading: 'Acceptable use',
        body: 'Don’t use the app to submit unlawful, abusive, or someone else’s private information without their consent. Automated abuse of rate-limited features (e.g. scripting around the AI parsing caps) may result in account suspension.'
      },
      {
        heading: 'Changes',
        body: 'These terms may change as the app evolves. A meaningful change re-prompts every signed-in user for acceptance before they can continue using account features.'
      },
      {
        heading: 'Contact',
        body: 'Questions or a privacy concern: reach the maintainer through the feedback form in the app (Settings → About → Send Feedback).'
      }
    ]
  },
  he: {
    title: 'תנאי שימוש',
    updated: 'עודכן לאחרונה: 23 באוגוסט 2026',
    sections: [
      {
        heading: 'מה זה',
        body: 'Deliveree היא אפליקציית מעקב חבילות. היא פועלת באופן מלא גם ללא חיבור; יצירת חשבון מוסיפה סנכרון בין מכשירים דרך Firebase. מדובר במוצר בשלב אלפה, מפותח ומופעל על ידי מפתח יחיד, ולא חברה — יש להתייחס אליו בהתאם.'
      },
      {
        heading: 'המידע שלך',
        body: 'פרטי חבילות ומעקב שאתה מזין שייךים לך. מידע של משתמש מחובר נשמר ב-Firebase (תשתית Google Cloud) ומבודד לפי חשבון באמצעות כללי אבטחה בצד השרת. ניתן לייצא או למחוק לצמיתות את החשבון וכל המידע הקשור אליו בכל עת מהגדרות החשבון.'
      },
      {
        heading: 'ייבוא חכם בעזרת AI',
        body: 'טקסט מודבק או צילומי מסך שאתה מעביר בייבוא החכם עשויים להישלח ל-API של Gemini של Google לצורך חילוץ פרטי החבילה, רק כאשר המנתח החופשי המובנה אינו מצליח לטפל בו. זה דורש חיבור וכפוף למגבלת תדירות. פרטים במדיניות הפרטיות מופיעים במדיניות הפרטיות.'
      },
      {
        heading: 'אין התחייבות מסירה',
        body: 'Deliveree מציגה מידע מעקב ממקורות חיצוניות או מוערך על ידי האפליקציה; היא אינה משלחת או מטפלת בחבילות ואינה מבטיחה מסירה. יש לאמת פרטים חשובים באופן עצמאי.'
      },
      {
        heading: 'שימוש תקין',
        body: 'אין להשתמש באפליקציה כדי להעביר מידע בלתי-חוקי או פרטי אדם אחר ללא הסכמתו. שימוש לרעה במגבלות הקצב עלול להוביל להשהיית החשבון.'
      },
      {
        heading: 'שינויים',
        body: 'תנאים אלו עשויים להשתנות עם התפתחות האפליקציה. שינוי מהותי יגרום לבקשה מחודשת לאישור מכל משתמש מחובר טרם המשך השימוש.'
      },
      {
        heading: 'יצירת קשר',
        body: 'שאלות או פנייה בנושא פרטיות: דרך טופס המשוב באפליקציה (הגדרות ← אודות ← שלח משוב).'
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
        heading: 'What we collect',
        body: 'Account info (name, email) from your chosen sign-in method; package and tracking data you enter; optional feedback and screenshots you submit; and, only if you sign in, usage counters for the AI parsing feature (to enforce daily limits, not to profile you).'
      },
      {
        heading: 'Where it lives',
        body: 'Everything is stored in Firebase (Firestore + Authentication), operated by Google Cloud, isolated per account by server-enforced security rules — not just app-level checks. Guest/offline use never leaves your device.'
      },
      {
        heading: 'AI-assisted import & Google Gemini',
        body: 'When Smart Import’s built-in parser can’t read your pasted text, or you attach a screenshot, that content is sent to Google’s Gemini API (billed under Google’s paid tier) to extract package details. On the paid tier, Google contractually does not use that content to train its own models. We do not store the screenshot itself after parsing — only the extracted fields.'
      },
      {
        heading: 'Help us improve accuracy (opt-in)',
        body: 'By default, if you edit a field Smart Import auto-filled, we only log which field changed — never the actual text. If you separately opt in (at registration, or anytime in Settings), we additionally store the pasted text and the before/after values of what you corrected, tied to your account, so we can improve the parser on real mistakes. This is off by default. Turning it off, or deleting your account, deletes any training data already collected from you — it isn’t kept on a timer.'
      },
      {
        heading: 'What we never do',
        body: 'We don’t sell your data. We don’t use package contents or tracking data for advertising. We don’t retain raw screenshots. We don’t share account data with anyone except the infrastructure providers named here (Firebase/Google Cloud, and Google Gemini only for the specific parse request you trigger).'
      },
      {
        heading: 'Your rights',
        body: 'Export your data or permanently delete your account and everything tied to it, anytime, from Settings → Danger Zone. Deletion removes your packages, profile, feedback association, and any opted-in training data. It cannot be undone.'
      },
      {
        heading: 'Cookies & local storage',
        body: 'The app uses browser local storage and IndexedDB to work offline and remember your preferences on this device — not third-party tracking cookies.'
      },
      {
        heading: 'Changes',
        body: 'A meaningful change to this policy bumps its version and re-prompts every signed-in user for acceptance.'
      }
    ]
  },
  he: {
    title: 'מדיניות פרטיות',
    updated: 'עודכן לאחרונה: 23 באוגוסט 2026',
    sections: [
      {
        heading: 'מה אנחנו אוספים',
        body: 'פרטי חשבון (שם, אימייל) מאמצעי ההתחברות שבחרת; פרטי חבילות ומעקב שאתה מזין; משוב וצילומי מסך אופציונליים שאתה שולח; ורק אם התחברת — מוני שימוש עבור תכונת ה-AI (לאכיפת מגבלות יומיות, לא לפרופיל שלך).'
      },
      {
        heading: 'היכן זה נשמר',
        body: 'הכל נשמר ב-Firebase (Firestore + Authentication), מופעל על ידי Google Cloud, מבודד לפי חשבון באמצעות כללי אבטחה בצד השרת — ולא רק בדיקות ברמת האפליקציה. שימוש אורח/לא מקוון אינו יוצא מהמכשיר שלך.'
      },
      {
        heading: 'ייבוא בעזרת AI ו-Google Gemini',
        body: 'כאשר המנתח המובנה בייבוא החכם אינו מצליח לקרוא את הטקסט שהדבקת, או שצירפת צילום מסך, התוכן נשלח ל-API של Gemini של Google (מחויב במסלול המשולם של Google) לחילוץ פרטי החבילה. במסלול המשולם, Google מתחייבת חוזית שלא להשתמש בתוכן זה לאימון המודלים שלה. אנו לא שומרים את הצילום עצמו לאחר הניתוח — רק את השדות שחולצו.'
      },
      {
        heading: 'עזרו לשפר דיוק (הצטרפות)',
        body: 'כברירת מחדל, אם אתה מעריך שדה ש-Smart Import מילא אוטומטית, אנו רושמים רק איזה שדה השתנה — לא את הטקסט עצמו. אם תצטרף בנפרד (ברישום או בכל עת בהגדרות), נאגר גם את הטקסט שהדבקת ואת הערכים לפני/אחרי התיקון, מקושר לחשבונך, כדי לשפר את המנתח על בסיס טעויות אמיתיות. ברירת מחדל כבוית מוגדרת כבוי. כיבוי או מחיקת חשבון מוחקים את כל המידע שכבר נאסף ממך — הוא אינו נשמר לפי קצובת זמן.'
      },
      {
        heading: 'מה אנחנו לא עושים',
        body: 'אנו לא מוכרים את המידע שלך. אנו לא משתמשים בתוכן חבילות או נתוני מעקב לפרסומאות. אנו לא שומרים צילומי מסך גולמיים. אנו לא משתפים פרטי חשבון עם אף גורם מלבד ספקי התשתית המצוינים כאן.'
      },
      {
        heading: 'הזכויות שלך',
        body: 'יציאת מידע או מחיקת חשבון לצמיתות וכל המידע הקשור אליו, בכל עת, מ-Settings ← אזורת סכנה. מחיקה מסירה את החבילות, הפרופיל, המשובים וכל מידע אימון שנאסף. לא ניתן לבטל.'
      },
      {
        heading: 'עוגיות ואחסון מקומי',
        body: 'האפליקציה משתמשת באחסון מקומי ו-IndexedDB כדי לעבוד לא מקוון ולזכור העדפות שלך במכשיר זה — לא עוגיות מעקב צד שלישי.'
      },
      {
        heading: 'שינויים',
        body: 'שינוי מהותי במדיניות זו מעלה את גרסתה ומבקש אישור מחודש מכל משתמש מחובר.'
      }
    ]
  }
};
