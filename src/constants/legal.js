/**
 * Terms of Use, Privacy Policy & Accessibility Statement content, plus the version
 * stamp that gates LegalConsentGate (src/components/LegalConsentGate.jsx).
 * Bump LEGAL_VERSION whenever the substance of either document changes — every signed-in
 * user whose stored `legalAcceptedVersion` doesn't match gets re-gated.
 *
 * Scope: this app is currently offered only to users in Israel (see the
 * "Where this is offered" section) — conforming with Israeli Privacy Protection Law
 * (including Amendment 13), Israeli Standard IS 5568 (WCAG 2.1 AA), Communications Law §30A,
 * and Standard Form Contracts Law.
 */

import { LEGAL_VERSION } from './legalVersion';
export { LEGAL_VERSION };

const CONTACT_EMAIL = 'contact@spotliapp.com';

export const TERMS_CONTENT = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: September 22, 2026',
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
        body: 'SpotLi is NOT a shipping company, freight forwarder, postal operator, courier service, or delivery handler. SpotLi does not ship, transport, handle, store, or deliver packages. SpotLi queries supported carrier endpoints and tracking APIs (including Israel Post, 17TRACK API, and Gaash Worldwide for live status updates), provides direct web portal tracking links for other domestic and international carriers (including Cheetah, HFD, BoxIt, Tapuz, Orian, and Cainiao), and parses courier messages to display tracking status and locker pickup information for your personal convenience. Carrier names, trademarks, and logos displayed in the app belong to their respective owners. SpotLi is not affiliated with, endorsed by, or operated by any carrier, and has zero control over carrier shipping schedules, physical deliveries, tracking accuracy, locker availability, or access code validity.'
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
        heading: 'Web push notifications & Anti-Spam statutory compliance',
        body: 'If you enable web push notifications, SpotLi attempts to send delivery status updates to your registered browser. In accordance with Section 30A of the Israeli Communications (Telecommunications and Broadcasting) Law, 5742-1982 (Anti-Spam Law), all push notifications and alerts sent by SpotLi are strictly operational and transactional delivery status updates requested directly by you. SpotLi does not send any commercial advertising, marketing, or promotional messages ("דבר פרסומת"). You may revoke notification permissions at any time through your browser settings or device operating system. Push notifications are provided for convenience only and depend on network availability, third-party push servers, and device operating system power-saving policies. SpotLi does not guarantee timely delivery or receipt of notifications and is not liable for any missed deliveries or uncollected packages resulting from delayed, failed, or inaccurate notifications.'
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
        body: 'TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, AND EXCEPT WHERE LIABILITY CANNOT BE EXCLUDED OR LIMITED UNDER MANDATORY, NON-WAIVABLE PROVISIONS OF APPLICABLE ISRAELI LAW (SUCH AS INTENTIONAL MISCONDUCT OR GROSS NEGLIGENCE UNDER THE STANDARD FORM CONTRACTS LAW, 5743-1982), UNDER NO CIRCUMSTANCES SHALL THE OPERATOR OF SPOTLI, AFFILIATES, OR SERVICE PROVIDERS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, EXEMPLARY, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOST, DAMAGED, DELAYED, STOLEN, OR MISDELIVERED PACKAGES OR GOODS; LOSS OF PROFITS; BUSINESS INTERRUPTION; LOSS OF DATA; REPLACEMENT COSTS; OR PERSONAL DISTRESS) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE SERVICE, THIRD-PARTY CARRIER SYSTEMS, GMAIL INTEGRATION, PUSH NOTIFICATIONS, OR NAVIGATION LINKS, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN ALL CASES, THE TOTAL AGGREGATE LIABILITY OF THE OPERATOR FOR ALL CLAIMS ARISING UNDER OR RELATING TO THESE TERMS OR THE SERVICE SHALL BE STRICTLY LIMITED TO THE GREATER OF: (A) THE TOTAL AMOUNT PAID BY YOU TO SPOTLI IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM (CURRENTLY ZERO, AS THE APP IS OFFERED FREE OF CHARGE), OR (B) ONE HUNDRED NEW ISRAELI SHEKELS (NIS 100). THIS LIMITATION OF LIABILITY IS CUMULATIVE AND SHALL NOT BE ENLARGED BY MULTIPLE INCIDENTS OR CLAIMS.'
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
    updated: 'עודכן לאחרונה: 22 בספטמבר 2026',
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
        body: 'SpotLi אינה חברת שילוח, אינה סוכנות דואר, אינה חברת בלדרות ואינה מספקת שירותי הובלה או מסירה. SpotLi אינה משנעת, אינה מחזיקה ואינה מוסרת חבילות בפועל. האפליקציה משמשת ככלי אגרגציה אינפורמטיבי בלבד, הפונה למערכות מעקב נתמכות וממשקי API (לרבות דואר ישראל, ממשק 17TRACK וחברת געש וורלדווייד לעדכוני סטטוס חיים), מייצרת קישורי גישה ישירים לפורטלי המעקב של ספקי שילוח נוספים בארץ ובעולם (לרבות צ\'יטה, HFD, בוקסיט, תפוז, אוריאן וקאיניאו), ומפענחת הודעות שילוח לטובת נוחות אישית. שמות החברות, סימני המסחר והלוגואים שייכים לבעליהם בלבד; SpotLi אינה שלוחה שלהם, אינה מופעלת על ידם ואין לה כל שליטה על לוחות הזמנים, הדיוק של נתוני המעקב, זמינות לוקרים או תקינות קודי איסוף.'
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
        heading: 'התראות דחיפה בדפדפן (Web Push) והוראות חוק התקשורת',
        body: 'במידה שתאשר/י קבלת התראות בדפדפן, המערכת תנסה לשלוח התראות על עדכוני סטטוס של חבילותיך. בהתאם להוראות סעיף 30א לחוק התקשורת (בזק ושידורים), התשמ"ב-1982 ("חוק הספאם"), מובהר בזאת במפורש כי כל ההתראות וההודעות הנשלחות על ידי SpotLi הינן הודעות שירותיות ותפעוליות בלבד אודות סטטוס המשלוחים שלך, אשר התבקשו על ידך באופן ישיר. SpotLi אינה שולחת כל מסר פרסומי, שיווקי או מסחרי ("דבר פרסומת"). באפשרותך לבטל את הרשאת ההתראות בכל עת דרך הגדרות הדפדפן או מערכת ההפעלה. התראות אלו מיועדות לנוחות בלבד ותלויות בחיבור רשת, שרתי דחיפה חיצוניים והגדרות חיסכון בסוללה של מכשירך. SpotLi אינה מתחייבת להגעת ההתראות במועד ואינה נושאת בכל אחריות בגין חבילות שלא נאספו או איחורים כתוצאה מהתראה שלא התקבלה או שאיחרה.'
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
        heading: 'הגבלת חבות והוראות חוק החוזים האחידים',
        body: 'במידה המרבית המותרת על פי דין (ולמעט במקרים שבהם לא ניתן להתנות על אחריות או להגבילה על פי הוראות קוגנטיות שאינן ניתנות להתנאה לפי הדין הישראלי החל, לרבות בגין מעשה מכוון או רשלנות רבתי בהתאם להוראות חוק החוזים האחידים, התשמ"ג-1982), בשום מקרה ובשום עילה משפטית (בין אם חוזית, נזיקית, רשלנות, אחריות קפידה או אחרת), לא יהיה מפעיל SpotLi אחראי כלפיך או כלפי צד שלישי כלשהו לכל נזק ישיר, עקיף, מיוחד, תוצאתי, עונשי או נלווה מכל סוג שהוא — לרבות, ומבלי לגרוע, בגין חבילות או טובין שאבדו, ניזוקו, התעכבו, נגנבו או נמסרו בטעות; אובדן רווחים; אובדן מידע; השבתת עסק; עלויות שחזור; או עוגמת נפש — הנובעים מהשימוש בשירות או מחוסר היכולת להשתמש בו, תקלות במערכות שילוח, אינטגרציית Gmail, התראות דחיפה או קישורי ניווט, גם אם הודע למפעיל על האפשרות לנזקים כאמור. בכל מקרה, סך החבות הכוללת והמצטברת של מפעיל האפליקציה בגין כל עילה או תביעה תוגבל לסכום הגבוה מבין: (א) הסכומים ששולמו על ידך בפועל עבור השירות ב-12 החודשים שקדמו לאירוע (כיום אפס, שכן האפליקציה ניתנת בחינם), או (ב) סך של 100 שקלים חדשים (100 ש"ח).'
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
    updated: 'Last updated: September 22, 2026',
    sections: [
      {
        heading: 'Data Controller & Contact',
        body: `SpotLi is developed and operated by an individual developer, not a corporate entity. For any privacy requests, data access, or questions, contact: ${CONTACT_EMAIL}. This direct email channel is monitored and available even if you do not have an active account.`
      },
      {
        heading: 'Statutory Notice Under Section 11 of the Privacy Protection Law',
        body: 'In accordance with Section 11 of the Israeli Privacy Protection Law, 5741-1981 (including Amendment 13), you are hereby notified that: (1) Voluntary Provision: You have no statutory legal obligation to provide any personal data to SpotLi; the provision of all personal data (including name, email address, tracking numbers, or courier messages) is entirely voluntary and is based solely on your explicit consent and free choice. (2) Purposes of Collection: The personal data you provide is collected and processed solely for the purposes detailed in this policy, specifically to operate your account, aggregate and track shipments, provide automated delivery status alerts, and enable cross-device cloud synchronization. (3) Consequences of Refusal: If you choose not to provide personal data, you may still use SpotLi as a local offline guest tracker on your device; however, you will not be able to create an account, synchronize shipments across multiple devices, connect Gmail, or receive cloud push notifications. (4) Recipients of Information: Personal data is transferred only to authorized infrastructure processors (Google Firebase, Google Gemini, CloudMailin) and carrier status endpoints as strictly necessary to operate the service and detailed herein.'
      },
      {
        heading: 'Geographic Scope',
        body: 'SpotLi is offered exclusively to individuals located in Israel. It is not offered to, and must not be used by, residents of the European Economic Area (EEA), the United Kingdom, or Switzerland.'
      },
      {
        heading: 'What Data We Collect, and Why',
        body: 'We collect and process only the minimal personal data strictly necessary to provide the features you use: (1) Account Profile: Name and email from your chosen authentication provider (Firebase Auth) to operate your account and enable cross-device synchronization (contractual necessity). (2) Package and Shipment Data: Tracking numbers, carrier names, statuses, dates, and optional notes that you enter or sync, to display and track your packages (contractual necessity). (3) Email Synchronization Data: If you enable Gmail sync or email forwarding, tracking numbers and courier metadata extracted from shipping confirmation emails. (4) Push Notification Tokens: Browser web push subscription endpoints to send you delivery alerts when granted (consent). (5) Crash & Diagnostic Telemetry: Automated client runtime error reports (error stack trace, browser version, operating system) sent to /crashReports to maintain stability and fix critical defects (legitimate interest). (6) Smart Import Usage Counters: Daily counters to enforce fair usage limits on third-party AI APIs (legitimate interest). (7) Voluntary Feedback: Text and optional screenshots submitted via the feedback modal (consent).'
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
        heading: 'Third-Party Data Sharing & Carrier Tracking APIs',
        body: 'We never sell your data or use it for marketing or advertising. We share data only with infrastructure and service providers strictly required to deliver the app: (1) Google Cloud / Firebase: Cloud infrastructure, database, authentication, and hosting. (2) Shipping Carriers & Live Tracking APIs: When you refresh live tracking, your tracking number and carrier identifier (never your identity, name, or email) are queried server-to-server against supported tracking endpoints: (a) Israel Post APIs for domestic mail status; (b) 17TRACK API (operated by 17TRACK, with cloud infrastructure in China / Hong Kong) to aggregate real-time delivery checkpoints across international carriers (such as Cainiao, Yanwen, Sunyou); (c) Gaash Worldwide APIs for customs and local logistics status; and (d) direct web portal tracking links generated for domestic carriers (Cheetah, HFD, BoxIt, Tapuz, Orian). (3) Google Gemini API: For AI-assisted parsing of pasted text or screenshots when triggered by you. (4) CloudMailin: Inbound email parsing processor. (5) External Navigation / Messaging: Clicking navigation (Waze, Google Maps) or WhatsApp links opens external third-party services that operate under their own independent privacy policies.'
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
        heading: 'Your Statutory Rights Under Israeli Law (Sections 13–14)',
        body: `Under Sections 13 and 14 of the Israeli Privacy Protection Law, 5741-1981, you have the right to inspect personal data held about you in our database and request the correction or deletion of data that is inaccurate, incomplete, or out of date. To exercise these rights: (1) Self-service access and deletion: You can view all your stored packages directly in the app at any time, export a complete JSON backup via Account Settings, or permanently delete your account and all associated cloud data via Settings → Danger Zone. (2) Written requests: You may submit a formal request to inspect, correct, or delete your data by writing to: ${CONTACT_EMAIL}. Under statutory Israeli law, we will review and respond to your request within 30 days. (3) Right of Appeal: If we refuse a request to inspect or correct your data, you have the statutory right to appeal that refusal to the Magistrates' Court (בית משפט השלום) in accordance with the Privacy Protection Regulations. (4) Regulatory Inquiries: You also have the right to lodge an inquiry or complaint with the Israeli Privacy Protection Authority (הרשות להגנת הפרטיות) via its official government portal (gov.il/ppa).`
      },
      {
        heading: 'Cookies & Local Storage Inventory',
        body: 'SpotLi does not use third-party advertising cookies, marketing pixels, or cross-site tracking technologies. We use browser LocalStorage and SessionStorage exclusively for essential operational and performance purposes: (1) "spotli_theme" / "deliveree_theme" (LocalStorage): Stores your preferred UI theme (dark, light, or system). (2) "spotli_app_build_version" / "deliveree_app_build_version" (LocalStorage): Stores the active client build version to detect updates and invalidate stale caches. (3) "deliveree_packages" / "deliveree_packages_*" (LocalStorage): Stores cached package records, statuses, and checkpoints to enable offline resilience and instant rendering. (4) "deliveree_auth_user_v1" & Firebase Auth tokens (LocalStorage / IndexedDB): Managed by Google Firebase Authentication to maintain your authenticated session. (5) "deliveree_date_format", "deliveree_preferred_nav_app", "deliveree_notification_prefs" (LocalStorage): Stores client interface preferences. (6) "deliveree_deleted_tombstones_*" (LocalStorage): Tracks deleted package IDs to ensure offline deletions synchronize properly with Firestore without resurrecting deleted items.'
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
    updated: 'עודכן לאחרונה: 22 בספטמבר 2026',
    sections: [
      {
        heading: 'בעל השליטה במידע ויצירת קשר',
        body: `SpotLi מפותחת ומופעלת על ידי מפתח יחיד, ואינה ישות תאגידית. לכל שאלה, בקשה לעיון או מימוש זכויות פרטיות, ניתן לפנות ישירות לכתובת: ${CONTACT_EMAIL}. כתובת דוא"ל זו זמינה ומנוטרת באופן קבוע גם עבור משתמשים שאינם מחוברים לחשבון.`
      },
      {
        heading: 'הודעה על פי סעיף 11 לחוק הגנת הפרטיות (חובת יידוע)',
        body: 'בהתאם להוראות סעיף 11 לחוק הגנת הפרטיות, התשמ"א-1981 (לרבות תיקון 13), הנך מיודע/ת בזאת כי: (1) אי-תחולת חובה חוקית: לא חלה עליך כל חובה חוקית למסור מידע אישי כלשהו ל-SpotLi, ומסירת כל מידע (לרבות שם, כתובת דוא"ל, מספרי מעקב או הודעות שילוח) תלויה ברצונך, בהסכמתך המפורשת ונעשית מבחירה חופשית. (2) מטרות איסוף המידע: המידע הנמסר על ידך מבוקש ונאסף אך ורק למטרות המפורטות במדיניות זו — תפעול חשבונך, ריכוז ומעקב אחר משלוחים, שליחת עדכוני סטטוס תפעוליים וסנכרון נתונים בענן בין מכשיריך. (3) השלכות אי-הסכמה למסירת המידע: אינך מחויב/ת למסור מידע זה, ובאפשרותך להשתמש באפליקציה במלואה באופן מקומי כאורח/ת (Guest); עם זאת, ללא מסירת כתובת דוא"ל לא ניתן יהיה לפתוח חשבון, לסנכרן חבילות בין מכשירים שונים, לחבר את שירות Gmail או לקבל התראות ענן. (4) מקבלי המידע: המידע נמסר אך ורק לספקי תשתית עיבוד מוסמכים (Google Firebase, Google Gemini, CloudMailin) ולמערכות המעקב של חברות השילוח, אך ורק במידה הנדרשת להפעלת השירות וכמפורט להלן במדיניות זו.'
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
        heading: 'שיתוף מידע עם צדדים שלישיים וממשקי מעקב (APIs)',
        body: 'איננו מוכרים את המידע שלך ואיננו משתפים אותו למטרות שיווקיות. המידע מועבר אך ורק לספקי תשתית חיוניים: (1) Google Cloud / Firebase: שירותי ענן, אחסון, אימות ומסדי נתונים. (2) ספקי שילוח וממשקי מעקב: בעת רענון מעקב חי, מספר המעקב וקוד הספק בלבד (ולעולם לא שמך, כתובת הדוא"ל או זהותך) נשלחים בין שרתים (server-to-server) למערכות ספקי שילוח ומאגרי מעקב: (א) ממשק דואר ישראל לעדכוני דואר מקומי; (ב) ממשק ה-API של 17TRACK (המופעל על ידי 17TRACK ותשתיות ענן בסין / הונג קונג) לצורך משיכה וריכוז של סטטוסי משלוח בינלאומיים מחברות שילוח גלובליות (כגון קאיניאו, Yanwen, Sunyou); (ג) ממשקי חברת געש וורלדווייד (Gaash Worldwide) לבירור סטטוס שחרור ממכס והפצה בישראל; (ד) הפקת קישורי מעקב ישירים לפורטלים של חברות שילוח מקומיות (צ\'יטה, HFD, בוקסיט, תפוז, אוריאן). (3) Google Gemini API: לעיבוד טקסט ותמונות בייבוא חכם. (4) CloudMailin: מעבד דוא"ל נכנס. (5) שירותי ניווט והודעות חיצוניים: לחיצה על קישורי ניווט (Waze, Maps) או WhatsApp מפעילה שירותי צד שלישי הפועלים תחת מדיניות הפרטיות שלהם בלבד.'
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
        heading: 'זכויותיך על פי הדין הישראלי (סעיפים 13–14)',
        body: `על פי סעיפים 13 ו-14 לחוק הגנת הפרטיות, התשמ"א-1981, הנך זכאי/ת לעיין במידע המוחזק אודותיך במאגר המידע, וכן לבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן. למימוש זכויות אלו: (1) עיון, ייצוא ומחיקה עצמאיים: באפשרותך לעיין בכל פרטי החבילות ישירות באפליקציה, לייצא גיבוי מלא של נתוניך בקובץ JSON דרך הגדרות החשבון, או למחוק לצמיתות את חשבונך ואת כל נתוני הענן דרך הגדרות ← אזור סכנה ← מחיקת חשבון. (2) פניות בכתב: ניתן להגיש בקשה רשמית לעיון, תיקון או מחיקה של מידע בפנייה ישירה לכתובת: ${CONTACT_EMAIL}. בהתאם לחוק, אנו נשיב לבקשתך תוך 30 ימים ממועד קבלתה. (3) זכות ערעור לבית המשפט: במידה שבקשת עיון או תיקון תידחה, הנך זכאי/ת לערער על סירוב זה בפני בית משפט השלום בהתאם לתקנות הגנת הפרטיות (תנאים לעיון במידע וסדרי הדין בערעור על סירוב לבקשת עיון), התשמ"א-1981. (4) תלונות לרשות להגנת הפרטיות: כמו כן, שמורה לך הזכות להגיש פנייה או תלונה לרשות להגנת הפרטיות במשרד המשפטים באמצעות הפורטל הממשלתי (gov.il/ppa).`
      },
      {
        heading: 'פירוט עוגיות ומאגרי אחסון מקומי (Local Storage)',
        body: 'SpotLi אינה משתמשת בעוגיות מעקב, שיווק, פיקסלים או פרסום של צדדים שלישיים. אנו עושים שימוש באחסון מקומי (LocalStorage) ובאחסון הפעלה (SessionStorage) אך ורק לצרכים תפעוליים חיוניים: (1) "spotli_theme" / "deliveree_theme" (אחסון מקומי): שמירת ערכת הנושא הנבחרת (כהה, בהיר או לפי מערכת ההפעלה). (2) "spotli_app_build_version" / "deliveree_app_build_version" (אחסון מקומי): שמירת גרסת המערכת הפעילה לצורך זיהוי עדכוני גרסה ורענון קבצי מטמון (Cache). (3) "deliveree_packages" / "deliveree_packages_*" (אחסון מקומי): שמירת נתוני החבילות, מספרי המעקב והסטטוסים במכשירך לתמיכה במצב לא-מקוון וטעינה מהירה. (4) "deliveree_auth_user_v1" וטוקני אימות של Firebase Auth (ב-IndexedDB / LocalStorage): מנוהלים על ידי שירותי Google Firebase Authentication לשמירת החיבור המאובטח של חשבונך. (5) "deliveree_date_format", "deliveree_preferred_nav_app", "deliveree_notification_prefs" (אחסון מקומי): שמירת העדפות ממשק המשתמש (פורמט תאריכים, אפליקציית ניווט מועדפת, הגדרות התראות). (6) "deliveree_deleted_tombstones_*" (אחסון מקומי): תיעוד מחיקות שבוצעו במצב לא-מקוון למניעת שחזור שגוי בסנכרון מול הענן.'
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

export const ACCESSIBILITY_CONTENT = {
  en: {
    title: 'Accessibility Statement',
    updated: 'Last updated: September 22, 2026',
    sections: [
      {
        heading: 'Compliance Statement',
        body: 'SpotLi is committed to ensuring digital accessibility for all users, including people with disabilities. We continuously improve the user experience and apply relevant accessibility standards. This digital application conforms to the requirements of the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013, and Israeli Standard IS 5568 ("Guidelines for Accessibility of Internet Content"), which adopts the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.'
      },
      {
        heading: 'Accessibility Features Implemented',
        body: 'SpotLi includes the following built-in accessibility adjustments: (1) Keyboard Navigation: All interactive elements, controls, dialogues, and form inputs are fully accessible and operable via standard keyboard commands (Tab, Shift+Tab, Enter, Escape, Arrow keys) with high-visibility focus indicators. (2) Screen Reader Optimization: Semantic HTML5 elements and ARIA landmarks/roles (dialog, alertdialog, button, status) are used throughout, ensuring screen readers (such as NVDA, JAWS, VoiceOver, and TalkBack) can accurately convey content, status changes, and notifications. (3) Touch Ergonomics: All interactive touch targets (buttons, list items, toggles) meet or exceed the minimum 48x48px physical bounding box requirement to prevent accidental activations. (4) Visual Clarity & Contrast: The user interface adheres to strict WCAG 2.1 Level AA color contrast ratios (minimum 4.5:1 for normal text and 3:1 for large text or graphical components) across light, dark, and system themes. (5) Bilingual Symmetry & Motion: Pixel-perfect layout mirroring between Hebrew (RTL) and English (LTR) using CSS logical properties, with support for the "prefers-reduced-motion" system setting.'
      },
      {
        heading: 'Digital-Only Service Nature',
        body: 'SpotLi operates exclusively as a digital application (Progressive Web Application). SpotLi has no physical offices, branches, or reception desks open to the public. As such, physical on-site accessibility arrangements (such as ramps, elevators, accessible parking, or service animal access) are not applicable.'
      },
      {
        heading: 'Accessibility Coordinator & Contact Information',
        body: `If you encounter an accessibility barrier, have questions regarding accessibility, or require specific accommodations in an alternative format, please contact our Accessibility Coordinator directly at: ${CONTACT_EMAIL}. We review all accessibility inquiries and commit to responding and providing reasonable accommodations within 14 business days.`
      }
    ]
  },
  he: {
    title: 'הצהרת נגישות',
    updated: 'עודכן לאחרונה: 22 בספטמבר 2026',
    sections: [
      {
        heading: 'הצהרת מחויבות ותקן נגישות',
        body: 'SpotLi רואה חשיבות עליונה בהנגשת השירות הדיגיטלי לאנשים עם מוגבלויות, מתוך מחויבות לשוויון זכויות, כבוד האדם ועצמאותו. יישום זה הותאם בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013, ולתקן הישראלי ת"י 5568 ("קווים מנחים לנגישות תכנים באינטרנט"), המאמץ את הנחיות הנגישות הבינלאומיות של ארגון W3C (תקן WCAG 2.1) ברמת עמידה AA.'
      },
      {
        heading: 'התאמות הנגישות שבוצעו ביישום',
        body: 'ביישום בוצעו התאמות נגישות קפדניות, לרבות: (1) ניווט מקלדת מלא: כל הרכיבים האינטראקטיביים, הכפתורים, הטפסים ותיבות הדו-שיח ניתנים להפעלה מלאה באמצעות המקלדת בלבד (מקשי Tab, Shift+Tab, Enter, הרווח, חיצים ומקש Esc לסגירת חלונות), תוך הדגשת פוקוס ויזואלית ברורה. (2) תאימות לקוראי מסך: שימוש במבנה סמנטי תקני (HTML5) ורכיבי ARIA (כגון dialog, status, button) המאפשרים לקוראי מסך (דוגמת NVDA, JAWS, VoiceOver ו-TalkBack) להקריא במדויק את המידע, הסטטוסים וההודעות. (3) אזורי מגע מוגדלים (Touch Targets): כל כפתורי הפעולה והרכיבים הלחיצים נבנו בגודל מינימלי של 48x48 פיקסלים, לנוחות הפעלה מקסימלית במכשירי מגע ולמניעת לחיצות שגויות. (4) ניגודיות חזותית ועיצוב: צבעי הממשק נבדקו ועומדים ביחסי ניגודיות מחמירים (מינימום 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול) במצב בהיר ובמצב כהה כאחד. (5) התאמה דו-לשונית והפחתת תנועה: תמיכה מלאה בהתאמת כיווניות (RTL לעברית, LTR לאנגלית) וכיבוד הגדרות מערכת להפחתת תנועה והנפשות (prefers-reduced-motion).'
      },
      {
        heading: 'אופי השירות (שירות דיגיטלי בלבד)',
        body: 'SpotLi הינה אפליקציית רשת מתקדמת (PWA) הפועלת באופן מקוון ודיגיטלי בלבד. לשירות אין משרדים, סניפים, עמדות קבלת קהל פיזיות או מרכז שירות לקוחות פרונטלי. לפיכך, התאמות נגישות פיזיות (כגון מעליות, חניות נכים, רמפות או שילוט מישושי) אינן רלוונטיות לשירות זה.'
      },
      {
        heading: 'רכז נגישות ודרכי פנייה',
        body: `אנו ממשיכים במאמצים לשפר את נגישות היישום. אם נתקלת בקושי, בתקלה בנגישות או אם נדרשת התאמה מיוחדת, ניתן לפנות לרכז הנגישות בכתובת הדוא"ל: ${CONTACT_EMAIL}. אנו מתחייבים לבדוק כל פנייה ולספק מענה והתאמות נגישות נדרשות תוך 14 ימי עסקים לכל היותר.`
      }
    ]
  }
};
