/**
 * HELD-OUT evaluation corpus for the Smart Import parser.
 *
 * ⚠️  DO NOT TUNE AGAINST THIS FILE.
 *
 * `smsCorpus.js` is the *tuning* corpus — it was written alongside the regexes
 * in smartParser.js, so a 100% pass rate there measures self-consistency, not
 * accuracy. This file exists to measure accuracy: it is scored by
 * `scripts/eval_parser.mjs`, reported as a percentage rather than asserted
 * per-case, and is allowed to fail. Fixing a regex *because a case here failed*
 * is legitimate; adding a case here *because you changed a regex* is not — that
 * turns the held-out set back into a tuning set and destroys its only value.
 *
 * Roughly half the corpus is NEGATIVE (`trackingNumber: null`): messages that
 * contain digit runs but no shipment at all. Precision failures live almost
 * entirely in that half, and the tuning corpus contains none of them.
 *
 * All samples are synthetic and modelled on public courier message formats.
 * They contain no real customer data, tracking numbers, addresses or phones.
 *
 * Shape:
 *   id              stable slug, used in the eval report
 *   rawText         the text a user would paste / share into Smart Import
 *   expected.trackingNumber  the correct ID, or null for a true negative
 *   expected.carrier         the correct carrier id, or null
 *   group           bucket for per-group reporting
 *   note            why this case is interesting (shown on failure)
 */

/** @type {Array<{id:string,rawText:string,group:string,note?:string,expected:{trackingNumber:string|null,carrier:string|null}}>} */
export const PARSER_EVAL_CORPUS = [
  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — Israel Post (UPU S10, checksum-valid)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-ilp-plain',
    group: 'israel-post',
    rawText: 'דואר ישראל - דבר דואר RS736102941IL ממתין לאיסוף בסניף רמת אביב עד 14/03.',
    expected: { trackingNumber: 'RS736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-ilp-no-keyword',
    group: 'israel-post',
    note: 'S10 format alone, no Hebrew tracking keyword anywhere',
    rawText: 'החבילה שלך RR617283948IL בדרך.',
    expected: { trackingNumber: 'RR617283948IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-ilp-with-phone-nearby',
    group: 'israel-post',
    note: 'phone number adjacent — must not be preferred over the S10',
    rawText: 'דואר ישראל: EE482103946IL הגיע לסניף. לבירורים חייגו 03-9445566 בין 08:00-16:00.',
    expected: { trackingNumber: 'EE482103946IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-ilp-among-dates-and-price',
    group: 'israel-post',
    note: 'date + price + branch number all compete as digit runs',
    rawText: 'הזמנה מ-12/02/2026 בסך 249.90 ₪ נשלחה. מספר מעקב CP736102941IL. סניף 4471.',
    expected: { trackingNumber: 'CP736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-ilp-lowercase-spaced',
    group: 'israel-post',
    note: 'lowercase + internal spaces, as pasted from some webmail clients',
    rawText: 'Israel Post tracking: rs 7361 0294 1 il — arriving Sunday.',
    expected: { trackingNumber: 'RS736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-ilp-english-mypost-url',
    group: 'israel-post',
    rawText: 'Your item EA482103946US is now in transit. Track: https://mypost.israelpost.co.il/itemtrace?itemcode=EA482103946US',
    expected: { trackingNumber: 'EA482103946US', carrier: 'israel-post' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — Israeli last-mile couriers (no checksum available)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-chita-courier-eta',
    group: 'israeli-courier',
    rawText: 'צ\'יטה: השליח בדרך אליך עם משלוח CH20481937. חלון הגעה משוער 14:00-16:00.',
    expected: { trackingNumber: 'CH20481937', carrier: 'chita' }
  },
  {
    id: 'pos-chita-bare-no-label',
    group: 'israeli-courier',
    note: 'carrier phrase present but no "מספר מעקב" label before the ID',
    rawText: 'שלום! חבילתך מצ\'יטה CHT10294857 נמסרה לשליח.',
    expected: { trackingNumber: 'CHT10294857', carrier: 'chita' }
  },
  {
    id: 'pos-hfd-with-pin',
    group: 'israeli-courier',
    note: 'locker PIN (4 digits) must not win over the HFD id',
    rawText: 'HFD: חבילה HFD73610294 ממתינה בלוקר בסופר יודה. קוד פתיחה: 5512',
    expected: { trackingNumber: 'HFD73610294', carrier: 'hfd' }
  },
  {
    id: 'pos-boxit-locker',
    group: 'israeli-courier',
    rawText: 'בוקסיט - החבילה שלך BOX4820193 ממתינה בעמדה בקניון הזהב ראשל"צ. קוד איסוף 7734.',
    expected: { trackingNumber: 'BOX4820193', carrier: 'boxit' }
  },
  {
    id: 'pos-tapuz-url-only',
    group: 'israeli-courier',
    note: 'ID appears only inside the tracking URL, not in prose',
    rawText: 'תפוז שליחויות: המשלוח יצא. מעקב: https://tapuzdelivery.co.il/tracking?num=TPZ84920194',
    expected: { trackingNumber: 'TPZ84920194', carrier: 'tapuz' }
  },
  {
    id: 'pos-zigzag-delivered',
    group: 'israeli-courier',
    rawText: 'זיגזג: משלוח ZIG492013 נמסר בהצלחה. תודה שבחרת בנו!',
    expected: { trackingNumber: 'ZIG492013', carrier: 'zigzag' }
  },
  {
    id: 'pos-buzzr-attempt',
    group: 'israeli-courier',
    rawText: 'באזר: ניסינו למסור את BZR2039485 ולא היית בבית. ננסה שוב מחר בין 09:00-13:00.',
    expected: { trackingNumber: 'BZR2039485', carrier: 'buzzr' }
  },
  {
    id: 'pos-bar-distribution',
    group: 'israeli-courier',
    rawText: 'בר הפצה - דבר דואר BAR9018372 נמסר לנקודת האיסוף ברחוב הרצל 44.',
    expected: { trackingNumber: 'BAR9018372', carrier: 'bar-distribution' }
  },
  {
    id: 'pos-orian-warehouse',
    group: 'israeli-courier',
    rawText: 'אוריאן: משלוח ORN20394857 שוחרר מהמכס ויצא להפצה.',
    expected: { trackingNumber: 'ORN20394857', carrier: 'orian' }
  },
  {
    id: 'pos-getpackage-locker',
    group: 'israeli-courier',
    rawText: 'GetPackage: החבילה GP61728394 מחכה לך. קוד: 2841. הלוקר פתוח 24/7.',
    expected: { trackingNumber: 'GP61728394', carrier: 'getpackage' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — global carriers
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-ups-formatted',
    group: 'global',
    note: 'UPS 1Z with the spacing UPS itself uses in emails',
    rawText: 'UPS: Your package 1Z 999 AA1 01 2345 6784 is out for delivery.',
    expected: { trackingNumber: '1Z999AA10123456784', carrier: 'ups' }
  },
  {
    id: 'pos-aliexpress-cainiao',
    group: 'global',
    rawText: 'AliExpress: Order shipped! Tracking LP00582910482CN. Estimated arrival Mar 12.',
    expected: { trackingNumber: 'LP00582910482CN', carrier: 'cainiao' }
  },
  {
    id: 'pos-yunexpress',
    group: 'global',
    rawText: 'YunExpress shipment YT2109849201948201 has departed the origin facility.',
    expected: { trackingNumber: 'YT2109849201948201', carrier: 'yunexpress' }
  },
  {
    id: 'pos-4px-hebrew-context',
    group: 'global',
    rawText: 'המשלוח שלך מ-4PX בדרך. מספר מעקב: 4PX30004928194',
    expected: { trackingNumber: '4PX30004928194', carrier: '4px' }
  },
  {
    id: 'pos-usps-impb',
    group: 'global',
    rawText: 'USPS: Item 9400100000000000000006 was delivered to your mailbox.',
    expected: { trackingNumber: '9400100000000000000006', carrier: 'usps' }
  },
  {
    id: 'pos-royal-mail',
    group: 'global',
    rawText: 'Royal Mail: your parcel RN203948576GB is being prepared for export.',
    expected: { trackingNumber: 'RN203948576GB', carrier: 'royal-mail' }
  },
  {
    id: 'pos-dhl-10digit-labeled',
    group: 'global',
    note: 'bare 10 digits — only the DHL keyword makes this a tracking number',
    rawText: 'DHL Express waybill 3094829104 has cleared customs in Tel Aviv.',
    expected: { trackingNumber: '3094829104', carrier: 'dhl' }
  },
  {
    id: 'pos-fedex-12digit-labeled',
    group: 'global',
    note: 'bare 12 digits, distinguished from a phone number only by context',
    rawText: 'FedEx tracking number 794820194821 — delivery scheduled for tomorrow.',
    expected: { trackingNumber: '794820194821', carrier: 'fedex' }
  },
  {
    id: 'pos-shein-order',
    group: 'global',
    rawText: 'SHEIN: your parcel GSH2039485716 has arrived in Israel and moved to local delivery.',
    expected: { trackingNumber: 'GSH2039485716', carrier: 'shein' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — harder / adversarial but still real shipments
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-hard-otp-and-tracking',
    group: 'hard-positive',
    note: 'an OTP AND a tracking number in one message — must pick the tracking one',
    rawText: 'קוד האימות שלך הוא 483920. בנוסף, חבילתך RS736102941IL הגיעה לסניף.',
    expected: { trackingNumber: 'RS736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-hard-order-and-tracking',
    group: 'hard-positive',
    note: 'Amazon-style order id must lose to the real carrier id',
    rawText: 'Order 114-8291029-1928301 has shipped via UPS. Tracking: 1Z999AA10123456784',
    expected: { trackingNumber: '1Z999AA10123456784', carrier: 'ups' }
  },
  {
    id: 'pos-hard-shortlink',
    group: 'hard-positive',
    note: 'ID only reachable through the link text, not resolvable offline',
    rawText: 'צ\'יטה: חבילה CH48201937 בדרך. פרטים: https://chtr.co.il/t/CH48201937',
    expected: { trackingNumber: 'CH48201937', carrier: 'chita' }
  },
  {
    id: 'pos-hard-two-tracking-numbers',
    group: 'hard-positive',
    note: 'split shipment — either ID is acceptable, first is preferred',
    rawText: 'ההזמנה פוצלה לשני משלוחים: RS736102941IL ו-RR617283948IL. שניהם בדרך.',
    expected: { trackingNumber: 'RS736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-hard-address-numbers',
    group: 'hard-positive',
    note: 'street number, apartment, floor and zip all compete',
    rawText: 'משלוח HFD20394857 יגיע לכתובת: הרצל 128, דירה 14, קומה 3, מיקוד 6473921.',
    expected: { trackingNumber: 'HFD20394857', carrier: 'hfd' }
  },
  {
    id: 'pos-hard-rtl-punctuation',
    group: 'hard-positive',
    note: 'RTL text wraps the Latin ID in punctuation that must be stripped',
    rawText: 'מספר המעקב הוא (RS736102941IL), ניתן לעקוב באתר.',
    expected: { trackingNumber: 'RS736102941IL', carrier: 'israel-post' }
  },
  {
    id: 'pos-hard-email-signature',
    group: 'hard-positive',
    note: 'long email body with footer noise around the ID',
    rawText: 'Hi,\n\nThanks for your order. It shipped today.\n\nTracking number: 1Z999AA10123456784\nCarrier: UPS\n\nQuestions? Call 1-800-555-0199 or reply to this email.\nOrder #99182 | Invoice 20260214 | VAT 514829371',
    expected: { trackingNumber: '1Z999AA10123456784', carrier: 'ups' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — the order number IS the tracking number.
  //
  // Added after a real-world report: Tapuz and others hand the customer one
  // number that serves as both. These are not tuned-to-a-regex cases — they
  // cover a slice of the input distribution the corpus was missing entirely,
  // and they are the counterpart to the `negative-order` cases below, which
  // use near-identical wording for parcels that have NOT shipped.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-order-as-tracking-tapuz',
    group: 'order-as-tracking',
    rawText: 'תפוז שליחויות: הזמנה מספר 8471293 יצאה למשלוח. נגיע אליך מחר בין 10:00-14:00.',
    expected: { trackingNumber: '8471293', carrier: 'tapuz' }
  },
  {
    id: 'pos-order-as-tracking-courier-en',
    group: 'order-as-tracking',
    rawText: 'Your order 8471293 has shipped with Tapuz and is on its way.',
    expected: { trackingNumber: '8471293', carrier: 'tapuz' }
  },
  {
    id: 'pos-order-as-tracking-with-url',
    group: 'order-as-tracking',
    rawText: 'תפוז שליחויות: הזמנה 8471293 יצאה. מעקב: https://tapuzdelivery.co.il/tracking?num=8471293',
    expected: { trackingNumber: '8471293', carrier: 'tapuz' }
  },

  {
    id: 'pos-real-cargo-wa-link',
    group: 'hard-positive',
    note: 'from a real user correction: labeled number must beat both the URL path token and the WhatsApp phone number',
    rawText: 'שלום, הזמנתך מ-Cotton Club לשדרות בן גוריון 23 ראש העין, נקלטה בחברת ההפצה CARGO ותימסר אליך בימים הקרובים. מס מעקב 68709580, למעקב אחר המשלוח: https://www.cargo-ship.co.il/cs/cs-client/delivery-status/VJ452WCTHFEI לבירורים נוספים בוואטסאפ https://wa.me/972504328304',
    expected: { trackingNumber: '68709580', carrier: 'cargo' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // POSITIVES — real messages, anonymised.
  //
  // Structure, punctuation and carrier wording are preserved exactly as sent,
  // because that is what the parser reads. Names, street addresses and phone
  // numbers are replaced, and every tracking number is altered while keeping
  // its format, so no case here identifies a person or a real delivery.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'pos-real-ilp-mailbox',
    group: 'real-world',
    note: 'Israel Post מהיר לתיבה format (MA…N8) — matched no rule at all, and the carrier is never named',
    rawText: 'לקוח יקר, משלוח MA002378449N8 מהשולח ישראכרט מהיר לתיבה יונח בתיבת המכתבים שלך במהלך הימים הקרובים.',
    expected: { trackingNumber: 'MA002378449N8', carrier: 'israel-post' }
  },
  {
    id: 'pos-real-zigzag-multilink',
    group: 'real-world',
    note: 'carrier identifiable only by host; three URLs, two base64 blobs and a WhatsApp number compete',
    rawText: 'שלום לקוח יקר\nשליחות מטעם אליטה אופק && לכתובת רחוב הדוגמה 1 תל אביב שמספרה 9214846123 עברה לחברת המשלוחים למעקב אחרי ההזמנה - לינק למעקב - https://api.zig-zag.co.il/isufatzmi/#!/deliveryTracking?num=DFA8E4BF45FD9B61\n\nלאישור השארת חבילה ליד הדלת יש להכנס לקישור https://www.zig-zag.co.il/bythedoor?num=eyJpZCI6IjExMTExIiwibnVtIjoiMTAwMDAwMDAwMDAifQ==\n\nניתן לפנות אלינו בווצאפ https://wa.me/972500000000\nבברכה זיגזג',
    expected: { trackingNumber: '9214846123', carrier: 'zigzag' }
  },
  {
    id: 'pos-real-tapuz-return',
    group: 'real-world',
    note: 'a return pickup, carrier named only in the sign-off',
    rawText: 'היי, שליח של Seestarz online מבקש לאסוף מרחוב הדוגמה 1 תל אביב פריט/ים חזרה. מספר משלוח 47927811. במידה ואינכם נמצאים בכתובת - ניתן להשאיר במיקום המוסכם ולעדכן את השליח שלכם. לוואטסאפ עם נציג https://wa.me/972500000000 אין צורך לחכות לשליח בכתובת. יום נעים, תפוז שליחויות',
    expected: { trackingNumber: '47927811', carrier: 'tapuz' }
  },
  {
    id: 'pos-real-chita-survey',
    group: 'real-world',
    note: "typographic apostrophe in צ’יטה, plus a shortlink whose path must not beat the number in the text",
    rawText: 'היי, המשלוח 101300711 הגיע לד21, איך היה עם השליח? נשמח לשמוע! לדירוג קצר או פנייה לצוות שלנו – לחצו כאן: https://u.cheetahint.com/rvi7q91 תודה שבחרתם בצ’יטה שליחויות.',
    expected: { trackingNumber: '101300711', carrier: 'chita' }
  },

  {
    id: 'pos-real-ilp-domestic-letter',
    group: 'real-world',
    note: 'two letters, ten digits, one trailing letter — matched no rule, so every message like it produced nothing',
    rawText: 'שלום, דוור עתיד להגיע לביתך בימים הקרובים על מנת למסור את משלוח RU0126608199Z מהלקוח Amazon. תודה דואר ישראל.',
    expected: { trackingNumber: 'RU0126608199Z', carrier: 'israel-post' }
  },
  {
    id: 'pos-real-ilp-registered',
    group: 'real-world',
    rawText: 'שלום, דואר רשום RR0126918911X מרשות האוכלוסין התקבל בדואר ישראל ובדרכו אליך. לשירותך, דואר ישראל.',
    expected: { trackingNumber: 'RR0126918911X', carrier: 'israel-post' }
  },
  {
    id: 'pos-real-ilp-counter-item',
    group: 'real-world',
    note: 'counter-issued YY item, eleven digits',
    rawText: 'לקוח יקר, תודה שאספת את דבר הדואר YY00370128099 בדואר ישראל.',
    expected: { trackingNumber: 'YY00370128099', carrier: 'israel-post' }
  },
  {
    id: 'pos-real-ilp-foreign-s10',
    group: 'real-world',
    note: 'inbound S10 from Sweden — a valid registered item dropped purely for not ending in IL',
    rawText: 'לקוח יקר, תודה שאספת את דבר הדואר RE477128799SE בדואר ישראל.',
    expected: { trackingNumber: 'RE477128799SE', carrier: 'israel-post' }
  },
  {
    id: 'neg-real-ilp-portal-otp',
    group: 'negative-otp',
    note: 'Israel Post sends login OTPs from the same sender as real shipment notices',
    rawText: 'קוד האימות הוא 946770 לשירות כניסה לפורטל MYPOST, דואר ישראל. (WfvxU7SGIO9)',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-real-ilp-appointment-cancelled',
    group: 'negative-admin',
    rawText: 'לקוח/ה יקר/ה, בוטל התור בסוכנות פארק אפק בתאריך 28/01/25 בשעה 10:25 על ידי הלקוח. דואר ישראל.',
    expected: { trackingNumber: null, carrier: null }
  },

  // ─────────────────────────────────────────────────────────────────────
  // NEGATIVES — no shipment in the message at all.
  // These are where precision dies. Correct output is NO tracking number.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'neg-otp-bank',
    group: 'negative-otp',
    rawText: 'קוד האימות שלך לכניסה לחשבון הוא 738492. הקוד תקף ל-5 דקות. אל תעבירו אותו לאף אחד.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-otp-english',
    group: 'negative-otp',
    rawText: 'Your one-time password is 902847. It expires in 10 minutes.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-otp-whatsapp-style',
    group: 'negative-otp',
    note: '6-digit code with no "code" keyword directly before it',
    rawText: 'WhatsApp: 483-920. Do not share this code with others.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-bank-transaction',
    group: 'negative-financial',
    rawText: 'בנק הפועלים: חויב חשבונך 12-345-678901 בסך 1,249.00 ₪ בתאריך 14/02/2026. יתרה: 8,392.55 ₪',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-credit-card',
    group: 'negative-financial',
    note: '12+ digit runs that must never become tracking numbers',
    rawText: 'ישראכרט: עסקה בכרטיס המסתיים ב-4821 בסך 89.90 ₪ אושרה. אסמכתא 20260214093412.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-invoice',
    group: 'negative-financial',
    rawText: 'חשבונית מס 20260001482 על סך 3,410.00 ₪ נשלחה למייל שלך. לתשלום עד 28/02/2026.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-marketing-sale',
    group: 'negative-marketing',
    rawText: 'מבצע! 50% הנחה על כל האתר עד חצות. קוד קופון: SAVE50. קנו עכשיו: https://shop.example.co.il',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-marketing-with-numbers',
    group: 'negative-marketing',
    note: 'coupon code shaped exactly like a courier id prefix',
    rawText: 'טרמינל איקס: הקופון שלך CH50000000 מזכה ב-50 ₪ הנחה ברכישה מעל 300 ₪. בתוקף עד 31/03.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-appointment',
    group: 'negative-admin',
    rawText: 'תזכורת: תור לרופא ביום ראשון 16/03/2026 בשעה 10:30, מרפאת כללית סניף 4471. לביטול חייגו 03-5551234.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-parking-ticket',
    group: 'negative-admin',
    rawText: 'עיריית תל אביב: דוח חניה מספר 830294857192 בסך 250 ₪. לתשלום או ערעור היכנסו לאתר העירייה.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-order-confirmation-no-shipment',
    group: 'negative-order',
    note: 'THE hardest negative — commerce language, order id, but nothing shipped yet',
    rawText: 'תודה על הזמנתך! הזמנה מספר 18492013 התקבלה ותטופל תוך 2 ימי עסקים. נעדכן כשהמשלוח יצא.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-order-confirmation-english',
    group: 'negative-order',
    rawText: 'Thanks for your order #8291029! We\'ll email you a tracking number as soon as it ships.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-payment-received',
    group: 'negative-order',
    rawText: 'KSP: התשלום עבור הזמנה 4820194 התקבל. המוצר יסופק מהמלאי תוך 3-5 ימי עסקים.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-phone-only',
    group: 'negative-phone',
    rawText: 'היי, תחזור אליי בבקשה למספר 052-8419203, דחוף.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-phone-landline',
    group: 'negative-phone',
    rawText: 'למוקד השירות שלנו: 03-7654321 או 1-800-300-400, ימים א-ה 09:00-17:00.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-id-number',
    group: 'negative-identity',
    note: '9-digit Israeli ID collides with several courier length rules',
    rawText: 'לצורך אימות זהות נא לספק את מספר תעודת הזהות 038492017 ותאריך לידה.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-license-plate',
    group: 'negative-identity',
    rawText: 'הרכב שלך מספר 8492017 נגרר מרחוב אלנבי. לפרטים: 03-5559999',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-electricity-bill',
    group: 'negative-admin',
    rawText: 'חברת חשמל: חשבון תקופתי מספר צרכן 482019374 בסך 412.30 ₪. חיוב אוטומטי ב-01/03/2026.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-flight-booking',
    group: 'negative-travel',
    note: 'PNR and flight number look like courier ids',
    rawText: 'אל על: הזמנתך אושרה. קוד הזמנה: LY4820. טיסה LY315 ב-22/04/2026 בשעה 06:40.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-delivery-marketing',
    group: 'negative-marketing',
    note: 'courier brand named, but this is an ad — no shipment exists',
    rawText: 'צ\'יטה שליחויות: פתחנו סניף חדש בחיפה! משלוח חינם בהזמנה ראשונה עם הקוד NEW2026.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-delivery-survey',
    group: 'negative-marketing',
    rawText: 'HFD: איך היה השירות שלנו? דרגו אותנו מ-1 עד 10 בקישור: https://survey.example.com/r/48201',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-2fa-with-delivery-word',
    group: 'negative-otp',
    note: 'OTP inside a message that also says "משלוח" — worst-case ambiguity',
    rawText: 'קוד לאישור שינוי כתובת המשלוח שלך: 592013. הקוד תקף ל-3 דקות.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-locker-pin-only',
    group: 'negative-otp',
    note: 'pickup code with no tracking number — must not promote the PIN',
    rawText: 'קוד פתיחת הלוקר שלך: 7734. הלוקר ממוקם בכניסה לקניון, פתוח 24 שעות.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-timestamp-log',
    group: 'negative-technical',
    rawText: 'System notice 20260214T093412Z: scheduled maintenance completed in 1482 ms. No action required.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-url-no-tracking',
    group: 'negative-technical',
    note: 'long numeric path segment in a non-carrier URL',
    rawText: 'ראית את זה? https://news.example.co.il/article/482019374/politics — שווה קריאה.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-empty-ish',
    group: 'negative-technical',
    rawText: 'תודה!',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-repeated-digits',
    group: 'negative-technical',
    rawText: 'Test message 000000000000 please ignore.',
    expected: { trackingNumber: null, carrier: null }
  },
  {
    id: 'neg-voting-poll',
    group: 'negative-marketing',
    rawText: 'סקר: הצביעו עכשיו! שלחו 1 לתמיכה או 2 להתנגדות למספר 5544. עלות הודעה 0.50 ₪.',
    expected: { trackingNumber: null, carrier: null }
  }
];

/** Cases where a tracking number should be found. */
export const POSITIVE_CASES = PARSER_EVAL_CORPUS.filter((c) => c.expected.trackingNumber !== null);

/** Cases where finding any tracking number is a false positive. */
export const NEGATIVE_CASES = PARSER_EVAL_CORPUS.filter((c) => c.expected.trackingNumber === null);
