/**
 * Terms of Use & Privacy Policy content, plus the version stamp that gates
 * LegalConsentGate (src/components/LegalConsentGate.jsx). Bump LEGAL_VERSION
 * whenever the substance of either document changes — every signed-in user
 * whose stored `legalAcceptedVersion` doesn't match gets re-gated.
 *
 * Scope: this app is currently offered only to users in Israel (see the
 * "Where this is offered" section) — a deliberate choice to avoid carrying
 * an unresolved EU representative/international-transfer posture while
 * still in alpha.
 */

import { LEGAL_VERSION } from './legalVersion';
export { LEGAL_VERSION };

const CONTACT_EMAIL = 'contact@spotliapp.com';

export const TERMS_CONTENT = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: September 5, 2026',
    sections: [
      {
        heading: 'What this is',
        body: 'SpotLi is a personal package-tracking aggregator application, currently in alpha. It works fully offline without an account; creating an account adds cross-device sync and optional cloud-enabled features via Firebase. It is built and operated by a single individual developer, not a registered corporate entity. Features may change, experience downtime, or be modified or removed without notice at this alpha stage; you are strongly advised to keep your own independent backups of all important shipment records (the JSON export tool in Account Settings provides a complete backup).'
      },
      {
        heading: 'Where this is offered',
        body: 'This service is offered solely to individuals located in Israel. It is not offered to, and must not be used by, residents of the European Economic Area (EEA), the United Kingdom, or Switzerland.'
      },
      {
        heading: 'Eligibility',
        body: 'You must be at least 16 years old to create an account or use account-linked features. SpotLi does not knowingly collect account data from anyone younger, and has no mechanism for parental consent. If you believe a minor has created an account, contact us immediately and the account and associated records will be removed.'
      },
      {
        heading: 'Your content and the limited licence you grant us',
        body: 'Package and tracking information you enter remains yours. To operate the service — including syncing it across your devices, communicating with carrier status endpoints, executing AI-assisted text/image extraction via Google Gemini, processing inbound forwarding emails, or processing Gmail shipping emails — you grant us a non-exclusive, worldwide, royalty-free, limited licence to store, process, and transmit that content strictly and solely for those purposes. We do not use your shipment data for any other purpose or sell it to any third party (see Privacy Policy). Any unsolicited feedback, ideas, or feature suggestions you submit may be implemented to improve the app without obligation, compensation, or attribution to you.'
      },
      {
        heading: 'Third-party carriers and locker pickup points',
        body: 'SpotLi is NOT a shipping company, freight forwarder, postal operator, courier service, or delivery handler. SpotLi does not ship, transport, handle, store, or deliver packages. SpotLi queries supported carrier endpoints (currently Israel Post for live status updates), provides direct web portal tracking links for other domestic and international carriers (including Cheetah, HFD, BoxIt, Tapuz, Orian, Cainiao, and 17Track), and parses courier messages to display tracking status and locker pickup information for your personal convenience. Carrier names, trademarks, and logos displayed in the app belong to their respective owners. SpotLi is not affiliated with, endorsed by, or operated by any carrier, and has zero control over carrier shipping schedules, physical deliveries, tracking accuracy, locker availability, or access code validity.'
      },
      {
        heading: 'External navigation & courier messaging',
        body: 'The app may provide convenience links to open third-party navigation apps (such as Waze, Google Maps, Apple Maps, or Moovit) to direct you to lockers or pickup points, or one-click links to contact couriers via third-party messaging services (such as WhatsApp or SMS). These links launch external third-party applications and services governed entirely by their own terms and privacy policies. SpotLi has no control over and assumes zero responsibility or liability for third-party navigation routes, traffic conditions, map inaccuracies, or interactions with courier personnel.'
      },
      {
        heading: 'Email synchronization & forwarding (Gmail & CloudMailin)',
        body: 'SpotLi provides optional email-based shipment tracking: (1) Inbound Email Forwarding via CloudMailin: You may forward shipping confirmation emails to your personal ingestion address. Emails are processed transiently to extract tracking details, and raw emails are discarded. (2) Gmail Integration via Google OAuth 2.0: If you connect your Google account, SpotLi requests restricted read-only access (https://www.googleapis.com/auth/gmail.readonly) solely to search for and extract tracking numbers, carrier names, and delivery dates from shipping confirmation emails. SpotLi’s use and transfer to any other app of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We never read your personal emails, never sell your email data, and never use email content for advertising or AI model training. You may disconnect Gmail or discontinue forwarding at any time from Account Settings. SpotLi is not liable for missed, unparsed, delayed, or miscategorized emails.'
      },
      {
        heading: 'Web push notifications & alerts',
        body: 'If you enable web push notifications, SpotLi attempts to send delivery status updates to your registered browser. Push notifications are provided for convenience only and depend on network availability, third-party push servers, and device operating system power-saving policies. SpotLi does not guarantee timely delivery or receipt of notifications and is not liable for any missed deliveries or uncollected packages resulting from delayed, failed, or inaccurate notifications.'
      },
      {
        heading: 'AI-assisted import',
        body: 'Pasted text or screenshots you submit to Smart Import may be transmitted to Google’s Gemini API to extract package details when the local on-device parser cannot parse them. This feature requires being signed in and is subject to rate limits. Your use of this feature is strictly subject to Google’s Prohibited Use Policy. You agree not to submit unlawful, harmful, or prohibited content through AI-assisted import.'
      },
      {
        heading: 'No delivery guarantees; user assumes all risk',
        body: 'You acknowledge and agree that SpotLi is an informational tracking aggregator only. SpotLi makes no representations or warranties regarding the delivery, safety, or arrival of any package. You assume full and exclusive responsibility for verifying all shipping statuses, pickup locations, opening hours, locker codes, and customs requirements directly with the applicable shipping carrier or merchant.'
      },
      {
        heading: 'Acceptable use & indemnification',
        body: 'You agree not to use the app for any unlawful, harassing, infringing, or abusive purpose. When pasting courier messages or emails, you represent and warrant that you have the lawful right to share that information. While the app applies automated redaction to common personal identifiers before transmission, this redaction is best-effort; you remain solely responsible for the content you submit. You agree to defend, indemnify, and hold harmless the operator of SpotLi from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your violation of these Terms or misuse of the service.'
      },
      {
        heading: 'Absolute disclaimer of warranties',
        body: 'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE, APPLICATION, NOTIFICATIONS, AND ALL ASSOCIATED FEATURES ARE PROVIDED STRICTLY ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. THE OPERATOR EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, UNINTERRUPTED AVAILABILITY, SECURITY, FREEDOM FROM BUGS OR VIRUSES, ACCURACY OF TRACKING DATA, OR TIMELINESS OF DELIVERY ALERTS.'
      },
      {
        heading: 'Strict limitation of liability',
        body: 'TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, UNDER NO CIRCUMSTANCES SHALL THE OPERATOR OF SPOTLI, AFFILIATES, OR SERVICE PROVIDERS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, EXEMPLARY, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOST, DAMAGED, DELAYED, STOLEN, OR MISDELIVERED PACKAGES OR GOODS; LOSS OF PROFITS; BUSINESS INTERRUPTION; LOSS OF DATA; REPLACEMENT COSTS; OR PERSONAL DISTRESS) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE SERVICE, THIRD-PARTY CARRIER SYSTEMS, GMAIL INTEGRATION, PUSH NOTIFICATIONS, OR NAVIGATION LINKS, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN ALL CASES, THE TOTAL AGGREGATE LIABILITY OF THE OPERATOR FOR ALL CLAIMS ARISING UNDER OR RELATING TO THESE TERMS OR THE SERVICE SHALL BE STRICTLY LIMITED TO THE GREATER OF: (A) THE TOTAL AMOUNT PAID BY YOU TO SPOTLI IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM (CURRENTLY ZERO, AS THE APP IS OFFERED FREE OF CHARGE), OR (B) ONE HUNDRED NEW ISRAELI SHEKELS (NIS 100). THIS LIMITATION OF LIABILITY IS CUMULATIVE AND SHALL NOT BE ENLARGED BY MULTIPLE INCIDENTS OR CLAIMS.'
      },
      {
        heading: 'Suspending or discontinuing the service',
        body: 'We reserve the right to suspend or terminate your account or access to the service at any time, with or without notice, in our sole discretion, including for violation of these Terms, suspected abuse, or discontinuation of the project. Except in cases of urgent security concerns, legal compliance, or abuse, we will make reasonable efforts to provide prior notice in-app before discontinuing the service, allowing you to export your data.'
      },
      {
        heading: 'Changes to these terms',
        body: 'We may revise these Terms from time to time as the application evolves. Any material modification will be accompanied by an updated version stamp and will require re-confirmation via the in-app Legal Consent Gate before you may continue accessing cloud-synchronized account features. Declining updated Terms does not prevent you from exporting or permanently deleting your existing data.'
      },
      {
        heading: 'Governing law and jurisdiction',
        body: 'These Terms and any dispute, controversy, or claim arising out of or relating to them or the service shall be governed by and construed in accordance with the laws of the State of Israel, without giving effect to any principles of conflicts of law. You agree to submit to the exclusive jurisdiction of the competent courts in Tel Aviv-Jaffa, Israel.'
      },
      {
        heading: 'General provisions',
        body: 'If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. No failure or delay by us in exercising any right or remedy under these Terms shall operate as a waiver thereof. You may not assign or transfer your rights under these Terms without our prior written consent; we may freely assign our rights and obligations without restriction.'
      },
      {
        heading: 'Contact',
        body: `For questions regarding these Terms, privacy inquiries, or legal notices, contact: ${CONTACT_EMAIL}, or submit feedback through the in-app feedback modal (Settings → About → Send Feedback).`
      }
    ]
  },
  he: {
    title: 'תנאי שימוש',
    updated: 'עודכן לאחרונה: 5 בספטמבר 2026',
    sections: [
      {
        heading: 'מהו השירות',
        body: 'SpotLi היא אפליקציה אישית לריכוז ומעקב אחר חבילות ומשלוחים, הפועלת כעת בשלב אלפה (Alpha). האפליקציה פועלת במלואה באופן מקומי וללא צורך בחשבון; יצירת חשבון מאפשרת סנכרון רב-מכשירי ותכונות ענן אופציונליות באמצעות Firebase. האפליקציה מפותחת ומופעלת על ידי מפתח יחיד, ואינה מופעלת על ידי תאגיד או חברה רשומה. בשלב אלפה זה, תכונות עשויות להשתנות, לסבול מהשבתות, או להימחק ללא הודעה מוקדמת — מומלץ לגבות באופן שוטף נתונים חשובים (כלי ייצוא ה-JSON בהגדרות החשבון מאפשר גיבוי מלא בכל עת).'
      },
      {
        heading: 'היכן השירות מוצע',
        body: 'שירות זה מוצע אך ורק ליחידים הנמצאים בישראל. השירות אינו מוצע ואינו מיועד לשימוש על ידי תושבי האזור הכלכלי האירופי (EEA), בריטניה או שווייץ.'
      },
      {
        heading: 'זכאות וגיל מינימלי',
        body: 'עליך להיות בן/בת 16 לפחות כדי ליצור חשבון או להשתמש בתכונות מבוססות ענן. SpotLi אינה אוספת ביודעין נתונים ממי שצעיר מגיל זה ואינה מפעילה מנגנון להסכמת הורים. אם נודע לך כי קטין יצר חשבון, פנה/י אלינו מיידית והחשבון ופרטיו יימחקו לצמיתות.'
      },
      {
        heading: 'התוכן שלך והרישיון המוגבל',
        body: 'פרטי החבילות ומספרי המעקב שתזין/י נשארים בבעלותך הבלעדית. לצורך תפעול השירות — לרבות סנכרון הנתונים בין מכשיריך, פנייה למערכות המעקב של חברות השילוח, ביצוע חילוץ טקסט/תמונות מבוסס AI באמצעות Google Gemini, עיבוד הודעות דוא"ל נכנסות, או קריאת הודעות שילוח מ-Gmail — הנך מעניק/ה לנו רישיון מוגבל, בלתי בלעדי, ללא תמלוגים, לאחסן, לעבד ולהעביר תוכן זה אך ורק ולשם מטרות אלו בלבד. איננו עושים כל שימוש אחר בפרטי המשלוחים שלך ואיננו מוכרים אותם לצד שלישי (ראו מדיניות הפרטיות). כל משוב, רעיון או הצעה שתגיש/י לשיפור האפליקציה עשויים לשמש אותנו ללא צורך בתמורה, פיצוי או מתן קרדיט.'
      },
      {
        heading: 'ספקי שילוח חיצוניים ונקודות איסוף',
        body: 'SpotLi אינה חברת שילוח, אינה סוכנות דואר, אינה חברת בלדרות ואינה מספקת שירותי הובלה או מסירה. SpotLi אינה משנעת, אינה מחזיקה ואינה מוסרת חבילות בפועל. האפליקציה משמשת ככלי אגרגציה אינפורמטיבי בלבד, הפונה למערכות מעקב נתמכות (כיום דואר ישראל לעדכוני סטטוס חיים), מייצרת קישורי גישה ישירים לפורטלי המעקב של ספקי שילוח נוספים בארץ ובעולם (לרבות צ\'יטה, HFD, בוקסיט, תפוז, אוריאן, קאיניאו ו-17Track), ומפענחת הודעות שילוח לטובת נוחות אישית. שמות החברות, סימני המסחר והלוגואים שייכים לבעליהם בלבד; SpotLi אינה שלוחה שלהם, אינה מופעלת על ידם ואין לה כל שליטה על לוחות הזמנים, הדיוק של נתוני המעקב, זמינות לוקרים או תקינות קודי איסוף.'
      },
      {
        heading: 'קישורי ניווט חיצוניים והתקשרות עם שליחים',
        body: 'האפליקציה עשויה לכלול קישורי נוחות לפתיחת יישומי ניווט חיצוניים (כגון Waze, Google Maps, Apple Maps או Moovit) לניווט לנקודות חלוקה ולוקרים, או קישורים להתקשרות ישירה עם שליחים (כגון WhatsApp או SMS). קישורים אלו פותחים יישומים של צדדים שלישיים הכפופים לתנאי השימוש ומדיניות הפרטיות שלהם בלבד. ל-SpotLi אין כל שליטה, אחריות או חבות לגבי מסלולי נסיעה, תנאי תנועה, דיוק מפות, או אינטראקציות עם שליחים.'
      },
      {
        heading: 'סנכרון והעברת דוא"ל (Gmail ו-CloudMailin)',
        body: 'SpotLi מציעה שירותי מעקב מבוססי דוא"ל אופציונליים: (1) העברת דוא"ל נכנס באמצעות CloudMailin: באפשרותך להעביר הודעות אישור משלוח לכתובת ייעודית אישית. ההודעות מעובדות באופן רגעי בזיכרון לחילוץ פרטי המעקב ונמחקות מיידית. (2) סנכרון Gmail באמצעות Google OAuth 2.0: אם בחרת לחבר חשבון Google, האפליקציה מבקשת הרשאת קריאה מוגבלת בלבד (https://www.googleapis.com/auth/gmail.readonly) אך ורק לצורך איתור וחילוץ של מספרי מעקב, שמות ספקים ותאריכי מסירה מהודעות שילוח. השימוש וההעברה של מידע שהתקבל מ-Google APIs על ידי SpotLi נעשים בהתאם מלא למדיניות נתוני המשתמש של שירותי Google API, לרבות דרישות השימוש המוגבל (Limited Use). איננו קוראים הודעות אישיות, איננו מוכרים נתוני דוא"ל, ואיננו משתמשים במידע זה לפרסום או לאימון מודלים של בינה מלאכותית. ניתן לנתק את Gmail או להפסיק את ההעברה בכל עת מהגדרות החשבון. SpotLi אינה אחראית להודעות שלא נקלטו, שלא פוענחו, או שנשמטו.'
      },
      {
        heading: 'התראות דחיפה בדפדפן (Web Push)',
        body: 'במידה שתאשר/י קבלת התראות בדפדפן, המערכת תנסה לשלוח התראות על עדכוני סטטוס של חבילותיך. התראות אלו מיועדות לנוחות בלבד ותלויות בחיבור רשת, שרתי דחיפה חיצוניים והגדרות חיסכון בסוללה של מכשירך. SpotLi אינה מתחייבת להגעת ההתראות במועד ואינה נושאת בכל אחריות בגין חבילות שלא נאספו או איחורים כתוצאה מהתראה שלא התקבלה או שאיחרה.'
      },
      {
        heading: 'ייבוא בעזרת AI',
        body: 'טקסט שהודבק או צילומי מסך בייבוא החכם עשויים להישלח ל-API של Google Gemini לחילוץ פרטי המשלוח כאשר המפענח המקומי אינו מצליח לזהותם. שימוש זה דורש התחברות לחשבון וכפוף למגבלות קצב יומיות. השימוש בתכונה כפוף למדיניות השימוש האסור של Google; הנך מתחייב/ת שלא להעלות תוכן פוגעני, בלתי חוקי או אסור.'
      },
      {
        heading: 'היעדר התחייבות למסירה; המשתמש נושא בכל הסיכון',
        body: 'הנך מאשר/ת ומסכים/ה במפורש כי SpotLi מהווה כלי עזר אינפורמטיבי בלבד. SpotLi אינה מספקת כל התחייבות, מצג או ערובה בנוגע למסירתן, שלמותן או הגעתן של חבילות. הנך נושא/ת באחריות המלאה והבלעדית לבדוק ולאמת כל סטטוס משלוח, שעות פתיחה, מיקום נקודת איסוף, קוד איסוף ודרישות מכס ישירות מול חברת השילוח או המוכר.'
      },
      {
        heading: 'שימוש מותר ושיפוי',
        body: 'הנך מתחייב/ת שלא לעשות שימוש בשירות לכל מטרה בלתי חוקית, מטרידה או פוגענית. בעת הדבקת הודעות משלוח, הנך מצהיר/ה כי יש לך זכות חוקית לשתף מידע זה. על אף שהאפליקציה מסתירה דפוסי זיהוי אישי בסיסיים באופן אוטומטי, הסתרה זו אינה מושלמת והנך נושא/ת באחריות הבלעדית לתוכן המועלה. הנך מסכים/ה לשפות ולפצות את מפעיל SpotLi בגין כל תביעה, חבות, נזק, הפסד או הוצאה (לרבות שכר טרחת עורכי דין סביר) הנובעים משימושך באפליקציה או מהפרת תנאים אלו.'
      },
      {
        heading: 'היעדר אחריות מוחלט (AS-IS)',
        body: 'במידה המרבית המותרת על פי כל דין חל, השירות, האפליקציה, ההתראות וכל התכונות הנלוות ניתנים strictly על בסיס "כפי שהם" ("AS IS") ו"כפי שהם זמינים" ("AS AVAILABLE"), ללא כל אחריות, הצהרה או ערובה מכל סוג שהוא, מפורשת, משתמעת, חוקית או אחרת. המפעיל מתנער מפורשות מכל אחריות משתמעת להתאמה למטרה מסוימת, איכות מסחרית, אי-הפרת זכויות, זמינות רציפה, היעדר שגיאות או וירוסים, דיוק נתוני המעקב או מהימנות ההתראות.'
      },
      {
        heading: 'הגבלת חבות מוחלטת',
        body: 'במידה המרבית המותרת על פי דין, בשום מקרה ובשום עילה משפטית (בין אם חוזית, נזיקית, רשלנות, אחריות קפידה או אחרת), לא יהיה מפעיל SpotLi אחראי כלפיך או כלפי צד שלישי כלשהו לכל נזק ישיר, עקיף, מיוחד, תוצאתי, עונשי או נלווה מכל סוג שהוא — לרבות, ומבלי לגרוע, בגין חבילות או טובין שאבדו, ניזוקו, התעכבו, נגנבו או נמסרו בטעות; אובדן רווחים; אובדן מידע; השבתת עסק; עלויות שחזור; או עוגמת נפש — הנובעים מהשימוש בשירות או מחוסר היכולת להשתמש בו, תקלות במערכות שילוח, אינטגרציית Gmail, התראות דחיפה או קישורי ניווט, גם אם הודע למפעיל על האפשרות לנזקים כאמור. בכל מקרה, סך החבות הכוללת והמצטברת של מפעיל האפליקציה בגין כל עילה או תביעה תוגבל לסכום הגבוה מבין: (א) הסכומים ששולמו על ידך בפועל עבור השירות ב-12 החודשים שקדמו לאירוע (כיום אפס, שכן האפליקציה ניתנת בחינם), או (ב) סך של 100 שקלים חדשים (100 ש"ח).'
      },
      {
        heading: 'השעיה או הפסקת השירות',
        body: 'אנו שומרים לעצמנו את הזכות להשעות, להגביל או לסיים את גישתך לשירות בכל עת ומכל סיבה, לפי שיקול דעתנו הבלעדי, לרבות עקב חשד לשימוש לרעה, הפרת תנאים אלו, או סגירת הפרויקט. למעט במקרי חירום ביטחוניים, משפטיים או ניצול לרעה, נעשה מאמץ סביר לספק הודעה מוקדמת בתוך האפליקציה כדי לאפשר לך לייצא את נתוניך.'
      },
      {
        heading: 'שינויים בתנאים אלו',
        body: 'אנו רשאים לעדכן תנאים אלו מעת לעת. שינוי מהותי ילווה בעדכון מספר הגרסה ויחייב אישור מחודש של המשתמש במסך ההסכמה המשפטית בטרם המשך שימוש בתכונות מבוססות ענן. סירוב לא ימנע ייצוא או מחיקה מלאה של המידע הקיים שלך.'
      },
      {
        heading: 'דין חל וסמכות שיפוט',
        body: 'על תנאים אלו, פרשנותם וכל סכסוך הנובע מהם או מהשירות יחולו אך ורק דיני מדינת ישראל, ללא מתן תוקף לכללי ברירת הדין. סמכות השיפוט הבלעדית והייחודית בכל עניין נתונה לבתי המשפט המוסמכים בעיר תל אביב-יפו.'
      },
      {
        heading: 'שונות',
        body: 'אם ייקבע על ידי ערכאה מוסמכת כי הוראה מהוראות תנאים אלו אינה חוקית או אינה ניתנת לאכיפה, יתר ההוראות יישארו במלוא תוקפן. אי-אכיפת זכות לא תיחשב כויתור עליה. אינך רשאי/ת להמחות או להעביר את זכויותיך לפי תנאים אלו ללא הסכמה מראש ובכתב; המפעיל רשאי להמחות את זכויותיו וחובותיו ללא כל הגבלה.'
      },
      {
        heading: 'יצירת קשר',
        body: `לבירורים בנוגע לתנאים אלו, הודעות משפטיות או שאלות: ${CONTACT_EMAIL}, או באמצעות טופס המשוב באפליקציה (הגדרות ← אודות ← שלח משוב).`
      }
    ]
  }
};

export const PRIVACY_CONTENT = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: September 14, 2026',
    sections: [
      {
        heading: 'Data Controller & Contact',
        body: `SpotLi is developed and operated by an individual developer, not a corporate entity. For any privacy requests, data access, or questions, contact: ${CONTACT_EMAIL}. This direct email channel is monitored and available even if you do not have an active account.`
      },
      {
        heading: 'Geographic Scope',
        body: 'SpotLi is offered exclusively to individuals located in Israel. It is not offered to, and must not be used by, residents of the European Economic Area (EEA), the United Kingdom, or Switzerland.'
      },
      {
        heading: 'What Data We Collect, and Why',
        body: 'We collect and process only the minimal data strictly necessary to provide the features you use: (1) Account Profile: Name and email from your chosen authentication provider (Firebase Auth) to operate your account and enable cross-device synchronization (contractual necessity). (2) Package and Shipment Data: Tracking numbers, carrier names, statuses, dates, and optional notes that you enter or sync, to display and track your packages (contractual necessity). (3) Email Synchronization Data: If you enable Gmail sync or email forwarding, tracking numbers and courier metadata extracted from shipping confirmation emails. (4) Push Notification Tokens: Browser web push subscription endpoints to send you delivery alerts when granted (consent). (5) Crash & Diagnostic Telemetry: Automated client runtime error reports (error stack trace, browser version, operating system) sent to /crashReports to maintain stability and fix critical defects (legitimate interest). (6) Smart Import Usage Counters: Daily counters to enforce fair usage limits on third-party AI APIs (legitimate interest). (7) Voluntary Feedback: Text and optional screenshots submitted via the feedback modal (consent).'
      },
      {
        heading: 'Where Data Lives and Security Measures',
        body: 'All backend data is stored in Google Cloud / Firebase (Firestore and Firebase Authentication), protected by server-enforced Firestore security rules ensuring strict user data isolation, encrypted in transit using TLS 1.3, and encrypted at rest by Google-managed encryption. While we implement modern security baselines, no digital transmission or cloud storage is 100% immune to breach, and we cannot guarantee absolute security.'
      },
      {
        heading: 'Google API User Data & Gmail Integration (Google Limited Use Disclosure)',
        body: 'SpotLi provides an optional Gmail synchronization feature. SpotLi’s use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements: (1) We request access only to the restricted scope "https://www.googleapis.com/auth/gmail.readonly". (2) We use this access strictly and solely to discover, read, and extract tracking numbers, carrier names, and delivery dates from package shipment and delivery confirmation emails. (3) We do not read, process, or store personal or unrelated email correspondence. (4) We do not transfer, disclose, or sell Google user data to third parties, except as necessary to provide or improve tracking features, comply with applicable law, or as part of a merger/acquisition. (5) We do not use Google user data to serve advertisements, including retargeting, personalized, or interest-based advertising. (6) We do not allow humans to read your email data unless you provide explicit affirmative consent for troubleshooting specific issues, or where required by law. (7) We never use your email content to train generalized artificial intelligence or machine learning models. You can disconnect Gmail at any time from Account Settings, which immediately cancels watch subscriptions, revokes OAuth access, and purges stored authentication tokens from our database.'
      },
      {
        heading: 'Inbound Email Forwarding (CloudMailin)',
        body: 'If you use manual email forwarding, emails you forward to your personal ingestion address are processed by CloudMailin (acting as a data processor). The webhook extracts courier tracking information and saves the detected package into your user collection. Raw email contents are processed in memory and immediately discarded.'
      },
      {
        heading: 'Web Push Notifications',
        body: 'If you grant push notification permissions, a browser push subscription token is saved in your Firestore profile. This token is used solely to deliver automated shipment notifications to your device. You can revoke notification permissions at any time through your browser settings.'
      },
      {
        heading: 'Automated Diagnostic Crash Reporting',
        body: 'To diagnose crashes and maintain application reliability, unhandled frontend exceptions may automatically send technical error reports to a secure Firestore collection (/crashReports). These reports include the error message, stack trace, user agent, app version, and timestamp. Crash reports do not collect passwords, tracking numbers, or personal package details.'
      },
      {
        heading: 'Third-Party Data Sharing',
        body: 'We never sell your data or use it for marketing or advertising. We share data only with infrastructure and service providers strictly required to deliver the app: (1) Google Cloud / Firebase: Cloud infrastructure, database, authentication, and hosting. (2) Shipping Carriers: When you refresh live tracking, your tracking number is queried against supported carrier endpoints (currently Israel Post); for other domestic and international carriers, SpotLi generates direct outbound links to the carrier’s official tracking portal (such as Cainiao, 17Track, etc., which operate from China / Hong Kong) for you to view on their websites. (3) Google Gemini API: For AI-assisted parsing of pasted text or screenshots when triggered by you. (4) CloudMailin: Inbound email parsing processor. (5) External Navigation / Messaging: Clicking navigation (Waze, Google Maps) or WhatsApp links opens external third-party services that operate under their own independent privacy policies.'
      },
      {
        heading: 'AI-assisted import & Gemini Processing',
        body: 'When you submit text or screenshots to Smart Import and local parsing fails, the data is sent to Google’s Gemini API under Google Cloud paid API terms. Before text is transmitted, client-side algorithms redact recognized email addresses, phone numbers, and recipient names. Images are not redacted on-device. Paid Gemini API data is not used by Google to train foundation models. SpotLi does not retain screenshots after parsing.'
      },
      {
        heading: 'Parser Accuracy Improvement Opt-In',
        body: 'By default, if you correct a field in Smart Import, only the field name is logged — not the text. If you explicitly opt in (at registration or in Settings), we store the pasted text and corrected values linked to your account to improve extraction accuracy. Redaction of common PII is applied before storage. You can disable this opt-in at any time in Settings, which permanently deletes your stored samples.'
      },
      {
        heading: 'Guest (Offline) Use',
        body: 'When using SpotLi without signing in, all package data is stored exclusively on your device via browser localStorage and local application cache. Nothing is transmitted to or stored on our cloud servers, except when you explicitly refresh carrier tracking.'
      },
      {
        heading: 'Data Retention & Account Deletion',
        body: 'Your account profile and package records are retained until you delete your account. You can permanently delete your account and all associated package data at any time via Settings → Danger Zone. Upon account deletion, your profile, package records, push tokens, Gmail connection tokens, and stored package documents are permanently purged. Two categories are deliberately collected without any link to your account and therefore cannot be located or deleted per user: feedback you submit, and anonymous crash reports generated automatically when the application encounters an error. Neither contains your name, email address or account identifier. Crash reports are additionally stripped of personal data before they are stored.'
      },
      {
        heading: 'Your Rights',
        body: `Under applicable Israeli privacy law, you have the right to inspect data held about you, correct inaccuracies, request export of your data (via Account Settings), or request account deletion. For any privacy requests, contact: ${CONTACT_EMAIL}.`
      },
      {
        heading: 'Cookies & Local Storage',
        body: 'SpotLi does not use third-party tracking or advertising cookies. We use browser localStorage and session storage exclusively for essential operational purposes: maintaining your offline state, caching package data, and saving your preferences.'
      },
      {
        heading: 'Children\'s Privacy',
        body: 'SpotLi is not directed to children under 16 years of age. We do not knowingly collect personal data from minors. If we discover that a minor under 16 has registered an account, we will promptly delete it.'
      },
      {
        heading: 'Changes to this Privacy Policy',
        body: 'We may update this Privacy Policy periodically. Substantive changes will be reflected in an updated version date and will require confirmation via the Legal Consent Gate upon your next login.'
      }
    ]
  },
  he: {
    title: 'מדיניות פרטיות',
    updated: 'עודכן לאחרונה: 14 בספטמבר 2026',
    sections: [
      {
        heading: 'בעל השליטה במידע ויצירת קשר',
        body: `SpotLi מפותחת ומופעלת על ידי מפתח יחיד, ואינה ישות תאגידית. לכל שאלה, בקשה לעיון או מימוש זכויות פרטיות, ניתן לפנות ישירות לכתובת: ${CONTACT_EMAIL}. כתובת דוא"ל זו זמינה ומנוטרת באופן קבוע גם עבור משתמשים שאינם מחוברים לחשבון.`
      },
      {
        heading: 'תחולה גיאוגרפית',
        body: 'השירות מוצע אך ורק ליחידים השוהים בישראל, ומדיניות זו נוסחה בהתאם. השירות אינו מיועד ואינו מוצע לתושבי האזור הכלכלי האירופי (EEA), בריטניה או שווייץ.'
      },
      {
        heading: 'איזה מידע אנו אוספים, ועבור מה',
        body: 'אנו אוספים ומעבדים אך ורק את המידע המינימלי הנדרש להפעלת התכונות שבהן בחרת להשתמש: (1) פרטי חשבון: שם וכתובת דוא"ל מספק האימות (Firebase Auth) לצורך ניהול החשבון וסנכרון בין מכשירים (הכרח חוזי). (2) נתוני חבילות ומשלוחים: מספרי מעקב, שמות ספקים, סטטוסים, תאריכים והערות אישיות שהזנת, לצורך הצגת ומעקב אחר חבילותיך (הכרח חוזי). (3) נתוני סנכרון דוא"ל: במידה שהפעלת סנכרון Gmail או העברת דוא"ל, מספרי מעקב ופרטי משלוח שחולצו מהודעות שילוח בלבד. (4) מזהי התראות דחיפה: כתובת מזהה הדפדפן (Web Push Subscription Token) לשליחת עדכוני משלוח בדפדפן כאשר ניתנה הסכמה לכך. (5) נתוני קריסות ואבחון תקלות: דיווחי שגיאות טכניים אוטומטיים של הדפדפן הנשלחים ל-crashReports/ לצורך תחזוקת יציבות האפליקציה (אינטרס לגיטימי). (6) מוני שימוש ב-AI: מוני שימוש יומיים לאכיפת מגבלות קצב ומניעת ניצול לרעה (אינטרס לגיטימי). (7) משוב יזום: טקסט וצילומי מסך שתבחר/י להעלות בטופס המשוב (הסכמה).'
      },
      {
        heading: 'היכן המידע נשמר ואבטחת מידע',
        body: 'כל הנתונים בצד השרת נשמרים ב-Google Cloud / Firebase (מסדי נתונים Firestore ושירותי אימות), מוגנים באמצעות כללי אבטחה קפדניים ברמת השרת המבטיחים בידוד מוחלט בין חשבונות משתמשים, ומוצפנים הן בהעברה (TLS 1.3) והן במנוחה (Google-managed encryption). עם זאת, שום שיטת שידור או אחסון דיגיטלי אינה חסינה במאת האחוזים, ואיננו יכולים להבטיח אבטחה מוחלטת מפני כל אירוע אבטחה.'
      },
      {
        heading: 'נתוני משתמשי Google ושירותי Gmail (גילוי שימוש מוגבל - Google Limited Use)',
        body: 'SpotLi מציעה תכונת סנכרון אופציונלית עם חשבון Gmail. השימוש וההעברה של כל מידע שהתקבל מ-Google APIs נעשים בהתאם מלא למדיניות נתוני המשתמש של Google API Services, לרבות דרישות השימוש המוגבל (Limited Use): (1) אנו מבקשים גישה להרשאה המוגבלת "https://www.googleapis.com/auth/gmail.readonly" בלבד. (2) אנו משתמשים בגישה זו אך ורק לצורך סריקה, איתור וחילוץ של מספרי מעקב, שמות ספקי שילוח ותאריכי מסירה מתוך הודעות דוא"ל של אישורי הזמנה ומשלוח. (3) איננו קוראים, מעבדים או שומרים הודעות דוא"ל אישיות שאינן קשורות לשילוח. (4) איננו מעבירים, מגלים או מוכרים נתוני משתמש מ-Google לצדדים שלישיים, למעט ככל שנדרש לספק או לשפר את תכונות המעקב, לעמוד בדרישות החוק, או במסגרת מיזוג/העברת בעלות. (5) איננו עושים כל שימוש בנתוני משתמשי Google להצגת פרסומות, לרבות פרסום ממוקד או מותאם אישית. (6) אין גישה אנושית לקריאת הודעות הדוא"ל שלך, למעט אם ניתנה הסכמה מפורשת לצורך פתרון בעיה טכנית נקודתית או על פי צו שיפוטי. (7) איננו משתמשים בתוכן הדוא"ל לאימון מודלים כלליים של בינה מלאכותית או למידת מכונה. באפשרותך לנתק את חשבון ה-Gmail בכל עת בהגדרות החשבון, פעולה המבטלת מיידית את ההרשאות ומוחקת את מפתחות הגישה המאוחסנים במסד הנתונים.'
      },
      {
        heading: 'העברת דוא"ל נכנס (CloudMailin)',
        body: 'אם בחרת להשתמש בהעברה ידנית של הודעות שילוח לכתובת האישית שלך, ההודעות מעובדות באמצעות ספק עיבוד הדוא"ל CloudMailin (כמעבד נתונים). המערכת מחלצת את פרטי המעקב ושומרת את החבילה בחשבונך. תוכן ההודעה הגולמי מעובד רגעית בזיכרון ונמחק מיידית.'
      },
      {
        heading: 'התראות דחיפה בדפדפן (Web Push)',
        body: 'במידה שתאשר/י קבלת התראות, מזהה התראה ייחודי של הדפדפן יישמר בפרופיל המשתמש שלך ב-Firestore. מזהה זה משמש אך ורק למשלוח התראות סטטוס על חבילותיך. באפשרותך לבטל הרשאה זו בכל עת דרך הגדרות הדפדפן שלך.'
      },
      {
        heading: 'דיווח קריסות ואבחון תקלות',
        body: 'לצורך ניטור יציבות ופתרון תקלות, שגיאות דפדפן חמורות עשויות לשדר באופן אוטומטי דיווח טכני לאוסף מאובטח ב-Firestore (crashReports/). דיווח זה כולל הודעת שגיאה, פירוט שורות קוד (Stack trace), סוג דפדפן, מערכת הפעלה וזמן האירוע. הדיווח אינו כולל סיסמאות, מספרי מעקב או פרטי חבילות אישיים.'
      },
      {
        heading: 'שיתוף מידע עם צדדים שלישיים',
        body: 'איננו מוכרים את המידע שלך ואיננו משתפים אותו למטרות שיווקיות. המידע מועבר אך ורק לספקי תשתית חיוניים: (1) Google Cloud / Firebase: שירותי ענן, אחסון, אימות ומסדי נתונים. (2) ספקי שילוח: בעת רענון מעקב חי, מספר המעקב נשלח למערכות ספקי שילוח נתמכים (כיום דואר ישראל); עבור ספקים אחרים בארץ ובעולם, SpotLi מפיקה קישורי מעקב ישירים לאתרי הספקים (כגון קאיניאו, 17Track וכו\', הפועלים מסין/הונג קונג) לצפייה יזומה על ידך בדפדפן. (3) Google Gemini API: לעיבוד טקסט ותמונות בייבוא חכם. (4) CloudMailin: מעבד דוא"ל נכנס. (5) שירותי ניווט והודעות חיצוניים: לחיצה על קישורי ניווט (Waze, Maps) או WhatsApp מפעילה שירותי צד שלישי הפועלים תחת מדיניות הפרטיות שלהם בלבד.'
      },
      {
        heading: 'ייבוא בעזרת AI ו-Google Gemini',
        body: 'בעת שימוש בייבוא חכם בטקסט או צילום מסך כאשר המפענח המקומי אינו מספיק, הנתונים נשלחים ל-API של Google Gemini במסלול API עסקי. לפני שליחת טקסט, אלגוריתמים במכשיר מסתירים מספרי טלפון, אימיילים ושמות. מידע זה אינו משמש את Google לאימון מודלים של בינה מלאכותית. SpotLi אינה שומרת צילומי מסך לאחר השלמת הפיענוח.'
      },
      {
        heading: 'הצטרפות לשיפור דיוק המפענח (Opt-in)',
        body: 'כברירת מחדל, תיקון שדה בייבוא חכם רושם רק את שם השדה שהשתנה. רק אם הצטרפת מפורשות לתכנית שיפור הדיוק (בהרשמה או בהגדרות), נשמור את הטקסט שהודבק ואת התיקונים לטובת טיוב המנוע. הסתרת פרטי זיהוי מוחלת טרם האחסון. ניתן לבטל הצטרפות זו בכל עת בהגדרות החשבון, פעולה שתמחק מיידית את הדוגמאות שנאספו ממך.'
      },
      {
        heading: 'שימוש כאורח (מקומי)',
        body: 'בשימוש ללא חשבון, כל פרטי החבילות נשמרים מקומית במכשירך (ב-localStorage ובמטמון האפליקציה) ואינם מועברים לשרתינו, למעט פניות יזומות לבדיקת סטטוס מול מערכות חברות שילוח נתמכות.'
      },
      {
        heading: 'שמירת מידע ומחיקת חשבון',
        body: 'פרטי החשבון והמשלוחים נשמרים עד למחיקת החשבון על ידך. באפשרותך למחוק לצמיתות את החשבון ואת כל המידע המקושר אליו בכל עת דרך הגדרות ← אזור סכנה ← מחיקת חשבון. עם המחיקה, פרטי הפרופיל, רשומות המשלוחים, מזהי ההתראות, טוקני ה-Gmail ומסמכי החבילות נמחקים לצמיתות. שני סוגי מידע נאספים במכוון ללא כל קישור לחשבון, ולכן אינם ניתנים לאיתור או למחיקה לפי משתמש: משוב שנשלח על ידך, ודיווחי קריסה אנונימיים הנוצרים אוטומטית כאשר היישום נתקל בשגיאה. אף אחד מהם אינו כולל את שמך, כתובת הדוא"ל או מזהה החשבון שלך. מדיווחי הקריסה מוסר מידע אישי לפני השמירה.'
      },
      {
        heading: 'זכויותיך',
        body: `על פי חוק הגנת הפרטיות, התשמ"א-1981, הנך זכאי/ת לעיין במידע המוחזק אודותיך, לבקש את תיקונו או לבקש את מחיקתו. לייצוא הנתונים השמורים, ניתן להשתמש בכלי הגיבוי בהגדרות החשבון. לכל פנייה בנושא פרטיות: ${CONTACT_EMAIL}.`
      },
      {
        heading: 'עוגיות ואחסון מקומי',
        body: 'SpotLi אינה משתמשת בעוגיות מעקב או שיווק של צדדים שלישיים. אנו עושים שימוש ב-localStorage ובאחסון הפעלה (sessionStorage) לצורך תפעולו התקין של השירות, שמירת העדפותיך ומצב לא-מקוון בלבד.'
      },
      {
        heading: 'פרטיות קטינים',
        body: 'השירות אינו מיועד לקטינים מתחת לגיל 16 ואיננו אוספים ביודעין מידע מקטינים. חשבון שיימצא כי נפתח על ידי קטין מתחת לגיל 16 יימחק לאלתר.'
      },
      {
        heading: 'שינויים במדיניות הפרטיות',
        body: 'אנו עשויים לעדכן מדיניות זו מעת לעת. שינוי מהותי ילווה בעדכון תאריך הגרסה ויחייב אישור מחודש במסך ההסכמה המשפטית בעת כניסתך הבאה לחשבון.'
      }
    ]
  }
};
