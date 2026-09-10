/**
 * SpotLi Store / Merchant Detection Engine
 * 
 * Automatically detects online stores and merchants from item titles, tracking numbers, 
 * carrier metadata, or note snippets and provides visual branding metadata (badges, icons, brand colors).
 */

/**
 * @typedef {Object} StoreInfo
 * @property {string} id
 * @property {string} name
 * @property {string} hebrewName
 * @property {string} brandColor
 * @property {string} badgeBg
 * @property {string} textColor
 * @property {string} borderColor
 * @property {string} icon
 * @property {string} website
 */

/** @type {Record<string, StoreInfo>} */
export const STORES = {
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    hebrewName: 'אמזון',
    brandColor: '#FF9900',
    badgeBg: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    icon: 'Package',
    website: 'https://www.amazon.com'
  },
  aliexpress: {
    id: 'aliexpress',
    name: 'AliExpress',
    hebrewName: 'עליאקספרס',
    brandColor: '#FF4747',
    badgeBg: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.aliexpress.com'
  },
  shein: {
    id: 'shein',
    name: 'SHEIN',
    hebrewName: 'שיין (SHEIN)',
    brandColor: '#000000',
    badgeBg: 'bg-slate-500/10',
    textColor: 'text-slate-200',
    borderColor: 'border-slate-500/30',
    icon: 'Shirt',
    website: 'https://www.shein.com'
  },
  temu: {
    id: 'temu',
    name: 'Temu',
    hebrewName: 'טמו (Temu)',
    brandColor: '#FB7701',
    badgeBg: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.temu.com'
  },
  iherb: {
    id: 'iherb',
    name: 'iHerb',
    hebrewName: 'אייהרב (iHerb)',
    brandColor: '#458500',
    badgeBg: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    icon: 'Leaf',
    website: 'https://www.iherb.com'
  },
  asos: {
    id: 'asos',
    name: 'ASOS',
    hebrewName: 'אסוס (ASOS)',
    brandColor: '#2d2d2d',
    badgeBg: 'bg-zinc-500/10',
    textColor: 'text-zinc-300',
    borderColor: 'border-zinc-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.asos.com'
  },
  zara: {
    id: 'zara',
    name: 'Zara',
    hebrewName: 'זארה (Zara)',
    brandColor: '#000000',
    badgeBg: 'bg-stone-500/10',
    textColor: 'text-stone-300',
    borderColor: 'border-stone-500/30',
    icon: 'Shirt',
    website: 'https://www.zara.com'
  },
  nike: {
    id: 'nike',
    name: 'Nike',
    hebrewName: 'נייקי (Nike)',
    brandColor: '#FA5400',
    badgeBg: 'bg-orange-600/10',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-600/30',
    icon: 'Zap',
    website: 'https://www.nike.com'
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    hebrewName: 'אפל (Apple)',
    brandColor: '#A2AAAD',
    badgeBg: 'bg-slate-400/10',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-400/30',
    icon: 'Smartphone',
    website: 'https://www.apple.com'
  },
  ksp: {
    id: 'ksp',
    name: 'KSP',
    hebrewName: 'קיי.אס.פי (KSP)',
    brandColor: '#0053A0',
    badgeBg: 'bg-blue-600/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-600/30',
    icon: 'Laptop',
    website: 'https://ksp.co.il'
  },
  ivory: {
    id: 'ivory',
    name: 'Ivory',
    hebrewName: 'אייבורי (Ivory)',
    brandColor: '#E30613',
    badgeBg: 'bg-red-600/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-600/30',
    icon: 'Monitor',
    website: 'https://www.ivory.co.il'
  },
  ebay: {
    id: 'ebay',
    name: 'eBay',
    hebrewName: 'איביי (eBay)',
    brandColor: '#E53238',
    badgeBg: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    icon: 'Tag',
    website: 'https://www.ebay.com'
  },
  next: {
    id: 'next',
    name: 'Next',
    hebrewName: 'נקסט (Next)',
    brandColor: '#000000',
    badgeBg: 'bg-neutral-500/10',
    textColor: 'text-neutral-300',
    borderColor: 'border-neutral-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.next.co.il'
  },
  terminalx: {
    id: 'terminalx',
    name: 'Terminal X',
    hebrewName: 'טרמינל איקס (Terminal X)',
    brandColor: '#000000',
    badgeBg: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.terminalx.com'
  },
  superpharm: {
    id: 'superpharm',
    name: 'Super-Pharm',
    hebrewName: 'סופר-פארם',
    brandColor: '#004B97',
    badgeBg: 'bg-sky-500/10',
    textColor: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    icon: 'Heart',
    website: 'https://shop.super-pharm.co.il'
  },
  wolt: {
    id: 'wolt',
    name: 'Wolt',
    hebrewName: 'וולט (Wolt)',
    brandColor: '#009DE0',
    badgeBg: 'bg-sky-500/10',
    textColor: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    icon: 'ShoppingBag',
    website: 'https://wolt.com'
  },
  bug: {
    id: 'bug',
    name: 'Bug',
    hebrewName: 'באג (Bug)',
    brandColor: '#FFD700',
    badgeBg: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    icon: 'Laptop',
    website: 'https://www.bug.co.il'
  },
  shufersal: {
    id: 'shufersal',
    name: 'Shufersal',
    hebrewName: 'שופרסל',
    brandColor: '#E20613',
    badgeBg: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: 'ShoppingBag',
    website: 'https://www.shufersal.co.il'
  },
  castro: {
    id: 'castro',
    name: 'Castro',
    hebrewName: 'קסטרו (Castro)',
    brandColor: '#E60000',
    badgeBg: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: 'Shirt',
    website: 'https://www.castro.com'
  },
  renuar: {
    id: 'renuar',
    name: 'Renuar',
    hebrewName: 'רנואר (Renuar)',
    brandColor: '#1A1A1A',
    badgeBg: 'bg-stone-500/10',
    textColor: 'text-stone-300',
    borderColor: 'border-stone-500/30',
    icon: 'Shirt',
    website: 'https://www.renuar.co.il'
  }
};

const STORE_MATCHERS = [
  {
    id: 'amazon',
    patterns: [/\bamazon\b/i, /\bamzn\b/i, /אמזון/i, /אמאזון/i]
  },
  {
    id: 'aliexpress',
    patterns: [/\baliexpress\b/i, /\bcainiao\b/i, /\bali\s*express\b/i, /עלי\s*אקספרס/i, /אלי\s*אקספרס/i, /עליאקספרס/i, /אליאקספרס/i]
  },
  {
    id: 'shein',
    patterns: [/\bshein\b/i, /שיין/i, /שאין/i, /שי\s*אין/i]
  },
  {
    id: 'temu',
    patterns: [/\btemu\b/i, /טמו/i, /טימו/i, /טאמו/i]
  },
  {
    id: 'iherb',
    patterns: [/\biherb\b/i, /אייהרב/i, /אי\s*הרב/i, /איי\s*הרב/i, /איהרב/i]
  },
  {
    id: 'asos',
    patterns: [/\basos\b/i, /אסוס/i, /אזוס/i]
  },
  {
    id: 'zara',
    patterns: [/\bzara\b/i, /זארה/i, /זארא/i]
  },
  {
    id: 'nike',
    patterns: [/\bnike\b/i, /נייקי/i, /נייק/i]
  },
  {
    id: 'apple',
    patterns: [/\bapple\b/i, /אפל/i]
  },
  {
    id: 'ksp',
    patterns: [/\bksp\b/i, /קיי\s*\.?\s*אס\s*\.?\s*פי/i, /קיי\s*אס\s*פי/i, /ק\.?ס\.?פ/i, /קספ/i]
  },
  {
    id: 'ivory',
    patterns: [/\bivory\b/i, /אייבורי/i, /איבורי/i]
  },
  {
    id: 'ebay',
    patterns: [/\bebay\b/i, /איביי/i, /אי\s*ביי/i]
  },
  {
    id: 'next',
    patterns: [/\bnext\b/i, /נקסט/i]
  },
  {
    id: 'terminalx',
    patterns: [/terminal\s*x/i, /טרמינל\s*איקס/i, /טרמינל\s*X/i]
  },
  {
    id: 'superpharm',
    patterns: [/super-?pharm/i, /סופר-?פארם/i]
  },
  {
    id: 'wolt',
    patterns: [/\bwolt\b/i, /וולט/i]
  },
  {
    id: 'bug',
    patterns: [/\bbug\b/i, /באג/i]
  },
  {
    id: 'shufersal',
    patterns: [/\bshufersal\b/i, /שופרסל/i]
  },
  {
    id: 'castro',
    patterns: [/\bcastro\b/i, /קסטרו/i]
  },
  {
    id: 'renuar',
    patterns: [/\brenuar\b/i, /רנואר/i]
  }
];

const objectStoreCache = new WeakMap();
const stringStoreCache = new Map();
const MAX_STRING_CACHE_SIZE = 256;

/**
 * Clear the store detection cache (useful for tests).
 */
export function clearStoreDetectionCache() {
  stringStoreCache.clear();
}

/**
 * Detects the store / merchant from package fields (title, notes, origin, or raw text).
 * Uses WeakMap for package objects and Map for string inputs to avoid redundant regex evaluations.
 * 
 * @param {object|string} input - Either a package object or an unstructured text string
 * @returns {StoreInfo | null} - Detected store info object or null if none detected
 */
export function detectStore(input) {
  if (!input) return null;

  if (typeof input === 'object') {
    if (objectStoreCache.has(input)) {
      return objectStoreCache.get(input);
    }
  } else if (typeof input === 'string') {
    if (stringStoreCache.has(input)) {
      return stringStoreCache.get(input);
    }
  }

  let combinedText = '';

  if (typeof input === 'string') {
    combinedText = input;
  } else if (typeof input === 'object') {
    const parts = [
      input.title,
      input.titleHe,
      input.notes,
      input.notesHe,
      input.origin,
      input.store
    ].filter(Boolean);
    combinedText = parts.join(' ');
  }

  if (!combinedText || typeof combinedText !== 'string') {
    if (typeof input === 'object') {
      objectStoreCache.set(input, null);
    } else if (typeof input === 'string') {
      if (stringStoreCache.size >= MAX_STRING_CACHE_SIZE) {
        const firstKey = stringStoreCache.keys().next().value;
        stringStoreCache.delete(firstKey);
      }
      stringStoreCache.set(input, null);
    }
    return null;
  }

  let result = null;
  // Linear bounded check
  for (const matcher of STORE_MATCHERS) {
    for (const pattern of matcher.patterns) {
      if (pattern.test(combinedText)) {
        result = STORES[matcher.id] || null;
        break;
      }
    }
    if (result) break;
  }

  if (typeof input === 'object') {
    objectStoreCache.set(input, result);
  } else if (typeof input === 'string') {
    if (stringStoreCache.size >= MAX_STRING_CACHE_SIZE) {
      const firstKey = stringStoreCache.keys().next().value;
      stringStoreCache.delete(firstKey);
    }
    stringStoreCache.set(input, result);
  }

  return result;
}
