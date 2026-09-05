#!/usr/bin/env node

/**
 * Deliveree Synthetic Training Data Generator
 * 
 * Generates mathematically valid, high-fidelity shipping notifications in Hebrew & English
 * across 16+ Israeli and global couriers, with exact character spans for custom model training,
 * adversarial distractors (phones, order IDs, BiDi brackets), and negative controls (OTP, spam).
 * 
 * Usage:
 *   node scripts/generate-synthetic-training-data.mjs --count=100 --output=corpus.json
 *   node scripts/generate-synthetic-training-data.mjs --format=spans --output=ner-training.json
 *   node scripts/generate-synthetic-training-data.mjs --format=gemini --output=gemini-dataset.jsonl
 */

export const CARRIER_SPECS = [
  // Israeli Couriers
  { id: 'israel-post', name: 'Israel Post', he: 'דואר ישראל', prefixes: ['RR', 'RS', 'CP', 'EE', 'RN', 'RM', 'LZ', 'RB'], suffix: 'IL', length: 13, type: 'upu-s10' },
  { id: 'chita', name: 'Chita Delivery', he: 'צ\'יטה שליחויות', prefixes: ['CH', 'CT', 'CHT'], length: 10, type: 'prefix-digits', domain: 'chtr.co.il' },
  { id: 'hfd', name: 'HFD / E-Post', he: 'אי פוסט HFD', prefixes: ['HFD', 'EP'], length: 10, type: 'prefix-digits', domain: 'epost.co.il' },
  { id: 'boxit', name: 'BoxIt', he: 'בוקסיט', prefixes: ['BOX', 'BX'], length: 9, type: 'prefix-digits', domain: 'boxit.co.il' },
  { id: 'buzzr', name: 'Buzzr', he: 'באזר', prefixes: ['BZR', 'BZ'], length: 9, type: 'prefix-digits', domain: 'link.buzzr.co.il' },
  { id: 'tapuz', name: 'Tapuz Delivery', he: 'תפוז שליחויות', prefixes: ['TPZ', 'YDM'], length: 9, type: 'prefix-digits', domain: 'tapuzdelivery.co.il' },
  { id: 'bar-distribution', name: 'Bar Distribution', he: 'בר הפצה', prefixes: ['BAR', 'BD'], length: 9, type: 'prefix-digits', domain: 'barexpress.co.il' },
  { id: 'zigzag', name: 'ZigZag', he: 'זיגזג', prefixes: ['ZZ'], length: 9, type: 'prefix-digits', domain: 'zigzag.co.il' },
  { id: 'lionwheel', name: 'LionWheel', he: 'ליאון וויל', prefixes: ['LW'], length: 9, type: 'prefix-digits', domain: 'tracking.lionwheel.com' },
  { id: 'cargo', name: 'Cargo Express', he: 'קרגו שליחויות', prefixes: ['CRG', 'ECSA'], length: 10, type: 'prefix-digits', domain: 'cargoexpress.co.il' },
  { id: 'orian', name: 'Orian', he: 'אוריאן', prefixes: ['OR', 'ORN'], length: 10, type: 'orian', domain: 'disttracking.orian.com' },

  // Global & Cross-Border
  { id: 'cainiao', name: 'Cainiao', he: 'קאיניאו עליאקספרס', prefixes: ['LP', 'S0000', 'AE'], length: 16, type: 'cainiao' },
  { id: 'yunexpress', name: 'YunExpress', he: 'יון אקספרס', prefixes: ['YT'], length: 18, type: 'yunexpress' },
  { id: 'shein', name: 'SHEIN', he: 'שיין', prefixes: ['GSH'], length: 13, type: 'shein' },
  { id: 'ups', name: 'UPS', he: 'יו פי אס', prefixes: ['1Z'], length: 18, type: 'ups' },
  { id: 'dhl', name: 'DHL Express', he: 'די אייץ\' אל', length: 10, type: 'dhl' },
  { id: 'fedex', name: 'FedEx', he: 'פדאקס', length: 12, type: 'fedex' },
  { id: 'usps', name: 'USPS', he: 'דואר ארה"ב', length: 22, type: 'usps' }
];

export const MERCHANTS = [
  { id: 'amazon', name: 'Amazon', he: 'אמזון' },
  { id: 'aliexpress', name: 'AliExpress', he: 'עליאקספרס' },
  { id: 'shein', name: 'SHEIN', he: 'שיין' },
  { id: 'temu', name: 'Temu', he: 'טמו' },
  { id: 'iherb', name: 'iHerb', he: 'אייהרב' },
  { id: 'asos', name: 'ASOS', he: 'אסוס' },
  { id: 'zara', name: 'Zara', he: 'זארה' },
  { id: 'next', name: 'Next', he: 'נקסט' },
  { id: 'ksp', name: 'KSP', he: 'קיי.אס.פי' },
  { id: 'ivory', name: 'Ivory', he: 'אייבורי' },
  { id: 'terminalx', name: 'Terminal X', he: 'טרמינל איקס' },
  { id: 'superpharm', name: 'Super-Pharm', he: 'סופר-פארם' }
];

export const PICKUP_LOCATIONS = [
  { nameHe: 'סופר פארם דיזנגוף סנטר', nameEn: 'Super-Pharm Dizengoff Center' },
  { nameHe: 'לוקר מנטה פז השלום', nameEn: 'Menta Paz Hashalom Locker' },
  { nameHe: 'קיוסק הכרמל חיפה', nameEn: 'Carmel Kiosk Haifa' },
  { nameHe: 'שופרסל קניון עזריאלי', nameEn: 'Shufersal Azrieli Mall' },
  { nameHe: 'מכולת האחים הרצל 14', nameEn: 'Brothers Grocery Herzl 14' },
  { nameHe: 'חנות ספרים בזל 35', nameEn: 'Basel Books 35' },
  { nameHe: 'סניף דואר נווה שאנן', nameEn: 'Post Branch Neve Shaanan' },
  { nameHe: 'תחנת דלק סונול נמיר', nameEn: 'Sonol Gas Station Namir' }
];

/**
 * Programmatically generates a mathematically valid tracking number.
 * @param {object} carrierSpec
 * @returns {string}
 */
export function generateValidTrackingNumber(carrierSpec) {
  if (carrierSpec.type === 'upu-s10') {
    const prefix = carrierSpec.prefixes[Math.floor(Math.random() * carrierSpec.prefixes.length)];
    const serial = Math.floor(10000000 + Math.random() * 90000000).toString();
    const weights = [8, 6, 4, 2, 3, 5, 9, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(serial[i], 10) * weights[i];
    }
    const rem = sum % 11;
    let check = 11 - rem;
    if (check === 10) check = 0;
    else if (check === 11) check = 5;
    const num = `${prefix}${serial}${check}${carrierSpec.suffix}`;
    return num;
  }

  if (carrierSpec.type === 'prefix-digits') {
    const prefix = carrierSpec.prefixes[Math.floor(Math.random() * carrierSpec.prefixes.length)];
    const remaining = prefix === 'HFD' ? 8 : (prefix === 'ECSA' ? 7 : (carrierSpec.length - prefix.length));
    const digits = Math.floor(Math.pow(10, remaining - 1) + Math.random() * (9 * Math.pow(10, remaining - 1))).toString();
    return `${prefix}${digits}`;
  }

  if (carrierSpec.type === 'cainiao') {
    const prefix = carrierSpec.prefixes[Math.floor(Math.random() * carrierSpec.prefixes.length)];
    if (prefix === 'LP') {
      return `LP${Math.floor(10000000000000 + Math.random() * 90000000000000)}CN`;
    }
    if (prefix === 'S0000') {
      return `S0000${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }
    return `AE${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  }

  if (carrierSpec.type === 'yunexpress') {
    return `YT${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;
  }

  if (carrierSpec.type === 'shein') {
    return `GSH${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  }

  if (carrierSpec.type === 'ups') {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '1Z';
    for (let i = 0; i < 16; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  if (carrierSpec.type === 'dhl') {
    const firstDigit = [1, 2, 4, 5, 6, 7, 8, 9][Math.floor(Math.random() * 8)];
    const remaining = Math.floor(100000000 + Math.random() * 900000000).toString();
    return `${firstDigit}${remaining}`;
  }

  if (carrierSpec.type === 'fedex') {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  }

  if (carrierSpec.type === 'usps') {
    const raw21 = `94001${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;
    const digits = raw21.split('').map(Number);
    const weights = [3, 1];
    let sum = 0;
    for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
      sum += digits[i] * weights[w % 2];
    }
    const rem = sum % 10;
    const check = (10 - rem) % 10;
    return `${raw21}${check}`;
  }

  if (carrierSpec.type === 'orian') {
    if (Math.random() > 0.5) {
      return `${Math.floor(100000000 + Math.random() * 900000000)}-${Math.floor(Math.random() * 10)}`;
    }
    const prefix = carrierSpec.prefixes[Math.floor(Math.random() * carrierSpec.prefixes.length)];
    return `${prefix}${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

/**
 * Programmatically generates a 4 to 6 digit locker PIN or collection OTP.
 */
export function generateLockerPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generates an Israeli phone number to act as an adversarial distractor.
 */
export function generateDistractorPhone() {
  const prefixes = ['050', '052', '053', '054', '058', '03', '04', '02'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `${p}-${num}`;
}

/**
 * Builds a realistic text message with ground-truth slots and calculates exact entity offsets.
 * @param {object} opts
 * @returns {{ rawText: string, expected: object, entities: Array<object> }}
 */
export function buildSyntheticSample(opts = {}) {
  const carrier = opts.carrier || CARRIER_SPECS[Math.floor(Math.random() * CARRIER_SPECS.length)];
  const merchant = opts.merchant || MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
  const location = opts.location || PICKUP_LOCATIONS[Math.floor(Math.random() * PICKUP_LOCATIONS.length)];
  const trackingNumber = opts.trackingNumber || generateValidTrackingNumber(carrier);
  const lockerPin = generateLockerPin();
  const distractorPhone = opts.hasPhone ? generateDistractorPhone() : null;
  const orderId = opts.hasOrderId ? `ORD-${Math.floor(10000 + Math.random() * 90000)}` : null;

  // Choose scenario
  const scenarios = [
    // 1. Locker Pickup with PIN and URL
    {
      lang: 'he',
      status: 'ready_for_pickup',
      hasPin: true,
      hasLocation: true,
      template: (c, m, l, t, pin, phone, _ord) => {
        let text = `שלום, חבילתך מ-${m.he} שמספרה ${t} הגיעה ללוקר ${l.nameHe}. קוד לאיסוף: ${pin}.`;
        if (c.domain) text += ` למעקב: https://${c.domain}/t/${t}`;
        if (phone) text += ` לבירורים: ${phone}.`;
        return text;
      }
    },
    // 2. Post Office / Branch with Shelf Code (Israel Post style)
    {
      lang: 'he',
      status: 'ready_for_pickup',
      hasPin: true,
      hasLocation: true,
      template: (c, m, l, t, pin, phone) => {
        const shelf = Math.floor(100 + Math.random() * 899);
        const prefixWord = c.id === 'israel-post' ? 'דבר דואר' : 'חבילה';
        let text = `${c.he}: ${prefixWord} שמספרו ${t} ממתין עבורך בסניף ${l.nameHe}. מדף ${shelf}. קוד איסוף: ${pin}.`;
        if (phone) text += ` טלפון: ${phone}.`;
        return text;
      }
    },
    // 3. Out for delivery with driver
    {
      lang: 'he',
      status: 'out_for_delivery',
      hasPin: false,
      hasLocation: false,
      template: (c, m, l, t, pin, phone, ord) => {
        const driver = ['יוסי', 'דניאל', 'אבי', 'מוחמד', 'אלכס'][Math.floor(Math.random() * 5)];
        let text = `שליח ${c.he} (${driver}) בדרך אליך עם משלוח ${t}`;
        if (ord) text += ` (הזמנה ${ord})`;
        text += `. שעת הגעה משוערת בין 13:00 ל-15:00.`;
        if (c.domain) text += ` תיאום מסירה: https://${c.domain}/track?num=${t}`;
        return text;
      }
    },
    // 4. English Global notification (AliExpress, Amazon, DHL, FedEx)
    {
      lang: 'en',
      status: 'ready_for_pickup',
      hasPin: true,
      hasLocation: true,
      template: (c, m, l, t, pin, phone) => {
        let text = `${m.name} update: Your shipment ${t} via ${c.name} has arrived at pickup point ${l.nameEn}. Collection PIN: ${pin}.`;
        if (phone) text += ` Support: ${phone}.`;
        return text;
      }
    },
    // 5. English Out For Delivery
    {
      lang: 'en',
      status: 'out_for_delivery',
      hasPin: false,
      hasLocation: false,
      template: (c, m, l, t, pin, phone, ord) => {
        let text = `${c.name}: Package with tracking ${t} is out for delivery today.`;
        if (ord) text += ` Order #${ord}.`;
        if (phone) text += ` Driver contact: ${phone}.`;
        return text;
      }
    },
    // 6. Redirected locker notice
    {
      lang: 'he',
      status: 'ready_for_pickup',
      hasPin: true,
      hasLocation: true,
      isRedirected: true,
      template: (c, m, l, t, pin) => {
        let text = `שינוי יעד משלוח ${c.he}: עקב עומס בלוקר המקורי, החבילה ${t} הועברה לנקודת איסוף ${l.nameHe}. קוד איסוף: ${pin}.`;
        return text;
      }
    }
  ];

  const scenario = scenarios[opts.scenarioIndex !== undefined ? opts.scenarioIndex : Math.floor(Math.random() * scenarios.length)];
  const rawText = scenario.template(carrier, merchant, location, trackingNumber, lockerPin, distractorPhone, orderId);

  // Compute exact character span offsets for NER / micro-model training
  const entities = [];
  const addEntity = (label, value) => {
    if (!value) return;
    const start = rawText.indexOf(value);
    if (start !== -1) {
      entities.push({
        label,
        start,
        end: start + value.length,
        value
      });
    }
  };

  addEntity('TRACKING_NUMBER', trackingNumber);
  if (scenario.hasPin) addEntity('LOCKER_PIN', lockerPin);
  addEntity('CARRIER', scenario.lang === 'he' ? carrier.he : carrier.name);
  addEntity('STORE', scenario.lang === 'he' ? merchant.he : merchant.name);
  if (scenario.hasLocation) {
    addEntity('LOCATION', scenario.lang === 'he' ? location.nameHe : location.nameEn);
  }

  const expected = {
    trackingNumber,
    carrier: carrier.id,
    store: merchant.name,
    status: scenario.status
  };
  if (scenario.hasPin) {
    expected.lockerPin = lockerPin;
  }
  if (scenario.hasLocation) {
    expected.pickupLocation = scenario.lang === 'he' ? location.nameHe : location.nameEn;
  }
  if (scenario.isRedirected) {
    expected.isRedirected = true;
  }

  return {
    id: `syn-${carrier.id}-${Math.floor(1000 + Math.random() * 9000)}`,
    rawText,
    expected,
    entities
  };
}

/**
 * Generates negative control samples (OTP, bank alerts, spam, chat) that must NOT extract any tracking number.
 */
export function generateNegativeControls() {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  return [
    {
      id: 'neg-otp-google',
      rawText: `G-${otpCode} is your Google verification code. Do not share this code with anyone.`,
      expected: { trackingNumber: '', carrier: 'other' },
      entities: []
    },
    {
      id: 'neg-otp-whatsapp',
      rawText: `Your WhatsApp code is ${otpCode}. You can also tap on this link to verify your phone: v.whatsapp.com/${otpCode}`,
      expected: { trackingNumber: '', carrier: 'other' },
      entities: []
    },
    {
      id: 'neg-bank-alert',
      rawText: `בנק הפועלים: בוצעה העברה בחשבונך על סך 350.00 ש"ח בתאריך 05/09/2026. לפרטים היכנס לאפליקציה.`,
      expected: { trackingNumber: '', carrier: 'other' },
      entities: []
    },
    {
      id: 'neg-spam-loan',
      rawText: `הלוואה מיידית לכל מטרה עד 60,000 ש"ח בריבית נוחה! פריסה עד 60 תשלומים. לפרטים חייגו 054-9988776. להסרה השב הסר.`,
      expected: { trackingNumber: '', carrier: 'other' },
      entities: []
    },
    {
      id: 'neg-chat-meetup',
      rawText: `היי, מתי אנחנו נפגשים היום בדיזנגוף סנטר? אהיה שם בסביבות 18:30, תודיע לי כשתצא.`,
      expected: { trackingNumber: '', carrier: 'other' },
      entities: []
    }
  ];
}

/**
 * Generates a complete balanced dataset.
 * @param {{ count?: number, includeNegatives?: boolean }} options
 * @returns {Array<object>}
 */
export function generateCorpus(options = {}) {
  const count = options.count || 50;
  const samples = [];

  // 1. Generate diverse positive samples across all carriers
  for (let i = 0; i < count; i++) {
    const carrier = CARRIER_SPECS[i % CARRIER_SPECS.length];
    const merchant = MERCHANTS[i % MERCHANTS.length];
    const location = PICKUP_LOCATIONS[i % PICKUP_LOCATIONS.length];
    const hasPhone = i % 2 === 0;
    const hasOrderId = i % 3 === 0;

    samples.push(buildSyntheticSample({
      carrier,
      merchant,
      location,
      hasPhone,
      hasOrderId
    }));
  }

  // 2. Append negative controls
  if (options.includeNegatives !== false) {
    samples.push(...generateNegativeControls());
  }

  return samples;
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('generate-synthetic-training-data.mjs')) {
  const args = process.argv.slice(2);
  let count = 60;
  let format = 'json';
  let output = null;

  for (const arg of args) {
    if (arg.startsWith('--count=')) count = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--format=')) format = arg.split('=')[1];
    if (arg.startsWith('--output=')) output = arg.split('=')[1];
  }

  console.log(`[Synthetic Data Generator] Generating ${count} ground-truth delivery samples (format: ${format})...`);
  const corpus = generateCorpus({ count, includeNegatives: true });

  let outData = '';
  if (format === 'gemini') {
    outData = corpus
      .filter(s => s.expected.trackingNumber)
      .map(s => JSON.stringify({
        messages: [
          { role: 'user', content: s.rawText },
          { role: 'model', content: JSON.stringify(s.expected) }
        ]
      }))
      .join('\n');
  } else if (format === 'spans') {
    outData = JSON.stringify(corpus.map(s => ({
      text: s.rawText,
      entities: s.entities,
      expected: s.expected
    })), null, 2);
  } else {
    outData = JSON.stringify(corpus, null, 2);
  }

  if (output) {
    import('fs').then(fs => {
      fs.writeFileSync(output, outData, 'utf-8');
      console.log(`[Synthetic Data Generator] Successfully saved ${corpus.length} samples to ${output}`);
    });
  } else {
    console.log(`[Synthetic Data Generator] Generated ${corpus.length} samples successfully.`);
    console.log(`Sample output:\n${JSON.stringify(corpus[0], null, 2)}`);
  }
}
