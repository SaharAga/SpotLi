/**
 * Phrase-frequency analysis for a real SMS export.
 *
 * Today's parser accuracy is measured against 37 hand-annotated corpus cases —
 * one person's judgement about which phrasings matter. A real export replaces
 * that judgement with the actual distribution: which Hebrew delivery phrasings
 * occur, how often, and which of them the parser currently has no answer for.
 *
 * Pure functions only, no I/O, so the CLI (`scripts/analyze_sms_corpus.mjs`)
 * and the tests can share them — same split as parserEval.js / eval_parser.mjs.
 *
 * PRIVACY: everything here normalizes before it counts. Digits, URLs and Latin
 * identifier tokens are replaced with placeholders *before* any phrase is
 * recorded, so a counted phrase cannot carry a tracking number, a phone number
 * or a link. That is also what makes the counts useful — two messages differing
 * only by their tracking number are the same phrasing and should collapse into
 * one row.
 */

/** Hebrew roots that carry a delivery stage. An n-gram without one is noise. */
const STAGE_ROOTS = [
  'מסר', 'אסף', 'איסוף', 'הגיע', 'ממתין', 'ממתינה', 'המתנ', 'יצא', 'נשלח',
  'ניסי', 'ניסינו', 'נקלט', 'מחכה', 'מוכן', 'מוכנה', 'זמין', 'נסרק', 'חזר',
  'בדרך', 'יונח', 'תימסר', 'דיווח', 'בוצע', 'ביצוע', 'לדרג', 'דירוג', 'משוב'
];

/** Words that mean a message is about a shipment at all. */
const SHIPPING_KEYWORDS = [
  'משלוח', 'חבילה', 'חבילת', 'שליח', 'מעקב', 'דואר', 'הזמנה', 'לוקר', 'איסוף',
  'הפצה', 'שליחות', 'דבר דואר', 'נקודת'
];

/**
 * Replaces everything identifying with a stable placeholder.
 *
 * Order matters: URLs before digits, so a link's digits do not become <NUM>
 * inside a URL that then fails to match as a URL.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeMessage(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/https?:\/\/\S+/gi, ' <URL> ')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/gi, ' <EMAIL> ')
    .replace(/(?:\+972[- ]?|0)(?:5\d|[23489])[- ]?\d{7}(?!\d)/g, ' <PHONE> ')
    // A Latin/digit mix of four or more is an identifier, not a word.
    .replace(/\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{4,}\b/g, ' <ID> ')
    .replace(/\d+(?:[:.,]\d+)*/g, ' <NUM> ')
    // Punctuation is dropped rather than kept: "אליך," and "אליך" are the same
    // phrasing, and leaving the comma attached splits one count into two.
    .replace(/[״"'`)(\[\]{},;:!?.\u05F3\u05F4־–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether a message is about a shipment at all.
 *
 * Deliberately generous: a message wrongly included shows up as a low-frequency
 * phrase and is ignored, while one wrongly excluded is invisible — and the
 * whole point is to find phrasings nobody thought of.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeShippingMessage(text) {
  if (typeof text !== 'string' || text.length < 10) return false;
  return SHIPPING_KEYWORDS.some((word) => text.includes(word))
    || /\b(?:tracking|shipment|parcel|delivery|courier)\b/i.test(text);
}

/**
 * Phrases worth counting: a window around each stage-bearing word.
 *
 * Only used for the messages the parser DID stage, where the question is "which
 * known phrasing carried this" and the root list is the right filter.
 *
 * It is deliberately NOT used on the unstaged bucket. STAGE_ROOTS is a list of
 * roots someone already thought of, and anchoring discovery on it can only ever
 * surface phrasings that were already imagined — the same blind spot as scoring
 * a parser on 37 hand-picked cases. A first run of this tool proved the point:
 * "שוחרר מהמכס" and "נמצאת אצל השכן" were both absent from the fix list purely
 * because neither root was listed. Unstaged messages go through extractNgrams
 * instead, which assumes nothing.
 *
 * @param {string} normalized output of normalizeMessage
 * @param {number} [window=2] words of context on each side
 * @returns {string[]} unique phrases found in this message
 */
export function extractStagePhrases(normalized, window = 2) {
  const words = normalized.split(' ').filter(Boolean);
  const found = new Set();

  words.forEach((word, i) => {
    if (!STAGE_ROOTS.some((root) => word.includes(root))) return;
    const from = Math.max(0, i - window);
    const to = Math.min(words.length, i + window + 1);
    found.add(words.slice(from, to).join(' '));
  });

  return Array.from(found);
}

/**
 * Decodes the XML entities an SMS export actually emits.
 *
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Splits a CSV line, honouring quoted fields that contain commas.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { cell += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(cell); cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

/**
 * Pulls message bodies out of whichever export format this is.
 *
 * Detection is by content first and extension second, because the adb dump has
 * no extension at all when piped to a file.
 *
 * @param {string} raw file contents
 * @param {string} [filename] used only as a tiebreaker
 * @returns {string[]}
 */
export function extractMessagesFromExport(raw, filename = '') {
  const ext = (filename.match(/\.(\w+)$/)?.[1] || '').toLowerCase();

  // `adb shell content query --uri content://sms/inbox --projection body`
  // emits one "Row: N body=…" per message. Body last (or alone) is the point:
  // a message containing a comma would otherwise run into the next column.
  if (/^Row:\s*\d+\s/m.test(raw)) {
    return raw.split(/\r?\n/)
      .map((line) => line.match(/^Row:\s*\d+\s.*?\bbody=([\s\S]*)$/)?.[1])
      .filter((body) => typeof body === 'string')
      .map((body) => body.trim())
      // A row with no body reads as the literal "null" from the content provider.
      .filter((body) => body && body !== 'null');
  }

  if (ext === 'xml' || raw.trimStart().startsWith('<?xml') || /<sms\b/.test(raw)) {
    return Array.from(raw.matchAll(/\bbody="([^"]*)"/g)).map((m) => decodeEntities(m[1]));
  }

  if (ext === 'json' || raw.trimStart().startsWith('[')) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('A JSON export must be an array.');
    return data.map((row) => (
      typeof row === 'string' ? row : (row.text || row.body || row.message || '')
    ));
  }

  if (ext === 'csv') {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const rawHeader = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
    const header = rawHeader.map((h) => h.toLowerCase());
    // iMazing calls it "Text", iExplorer "Message", others "body".
    const col = ['text', 'message', 'body', 'content']
      .map((name) => header.indexOf(name)).find((i) => i >= 0);
    if (col === undefined) {
      // Original casing, so it can be compared against the file by eye.
      throw new Error(`No text column in CSV. Columns seen: ${rawHeader.join(', ')}`);
    }
    return lines.slice(1).map((line) => splitCsvLine(line)[col] || '');
  }

  // Plain text: blank-line-separated blocks where they exist, else one per line.
  return raw.includes('\n\n') ? raw.split(/\n{2,}/) : raw.split(/\r?\n/);
}

/**
 * Every n-gram in a message, assuming nothing about what a stage looks like.
 *
 * Frequency does the filtering that a keyword list cannot: a phrasing used by a
 * real courier recurs across hundreds of messages, while a one-off sentence
 * sits at count 1 and is skimmed past. Filler like "לקוח יקר" ranks high too,
 * which is why the report prints how often each n-gram also appears in messages
 * that WERE staged — a phrase common in both is not what is blocking staging.
 *
 * @param {string} normalized output of normalizeMessage
 * @param {{min?: number, max?: number}} [widths]
 * @returns {string[]} unique n-grams in this message
 */
export function extractNgrams(normalized, { min = 2, max = 4 } = {}) {
  const words = normalized.split(' ').filter(Boolean);
  const grams = new Set();

  for (let width = min; width <= max; width += 1) {
    for (let i = 0; i + width <= words.length; i += 1) {
      const gram = words.slice(i, i + width).join(' ');
      // An n-gram made only of placeholders says nothing about phrasing.
      if (/[\u0590-\u05FFA-Za-z]/.test(gram.replace(/<[A-Z]+>/g, ''))) {
        grams.add(gram);
      }
    }
  }

  return Array.from(grams);
}

/**
 * Runs a corpus through the parser and counts phrases by the stage it assigned.
 *
 * The interesting bucket is `unstaged`: `in_transit` and `ordered` are what the
 * parser falls back to, so a phrase common there is one it has no answer for.
 * That is the ranked list of what to fix next, in order of real-world volume —
 * which is the thing 37 hand-picked cases cannot tell anyone.
 *
 * @param {string[]} messages raw message bodies
 * @param {(text: string) => object} parseFn
 * @returns {object} report
 */
export function analyzeCorpus(messages, parseFn) {
  const shipping = messages.filter(looksLikeShippingMessage);

  const byStage = new Map();
  const unstagedPhrases = new Map();
  const stagedPhrases = new Map();
  const stagedNgrams = new Map();
  const byCarrier = new Map();
  let withTracking = 0;

  for (const raw of shipping) {
    let parsed;
    try {
      parsed = parseFn(raw);
    } catch {
      continue; // a parser throw is a finding, but not this report's job
    }

    const stage = parsed?.status || 'none';
    byStage.set(stage, (byStage.get(stage) || 0) + 1);

    if (parsed?.trackingNumber) {
      withTracking += 1;
      const carrier = parsed.carrier || 'unknown';
      byCarrier.set(carrier, (byCarrier.get(carrier) || 0) + 1);
    }

    // `ordered` and `in_transit` are the two fall-throughs: neither is reached
    // by a phrase that named them, so both mean "nothing here said a stage".
    const isUnstaged = stage === 'in_transit' || stage === 'ordered';
    const normalized = normalizeMessage(raw);

    if (isUnstaged) {
      // Discovery: assume nothing about what a stage phrase looks like.
      for (const gram of extractNgrams(normalized)) {
        const entry = unstagedPhrases.get(gram) || { phrase: gram, count: 0, alsoWhenStaged: 0 };
        entry.count += 1;
        unstagedPhrases.set(gram, entry);
      }
    } else {
      // Coverage: which known phrasing carried this one.
      for (const phrase of extractStagePhrases(normalized)) {
        const entry = stagedPhrases.get(phrase) || { phrase, count: 0, stage };
        entry.count += 1;
        stagedPhrases.set(phrase, entry);
      }
      // Counted separately so the report can say whether an n-gram common in
      // the unstaged bucket is actually discriminative or just filler.
      for (const gram of extractNgrams(normalized)) {
        stagedNgrams.set(gram, (stagedNgrams.get(gram) || 0) + 1);
      }
    }
  }

  for (const entry of unstagedPhrases.values()) {
    entry.alsoWhenStaged = stagedNgrams.get(entry.phrase) || 0;
  }

  const rank = (map) => Array.from(map.values()).sort((a, b) => b.count - a.count);

  return {
    total: messages.length,
    shipping: shipping.length,
    withTracking,
    trackingRate: shipping.length ? withTracking / shipping.length : 0,
    stages: Array.from(byStage.entries())
      .map(([stage, count]) => ({ stage, count, share: count / (shipping.length || 1) }))
      .sort((a, b) => b.count - a.count),
    carriers: Array.from(byCarrier.entries())
      .map(([carrier, count]) => ({ carrier, count }))
      .sort((a, b) => b.count - a.count),
    // The deliverable: phrasings the parser could not stage, most common first.
    unstagedPhrases: rank(unstagedPhrases),
    stagedPhrases: rank(stagedPhrases)
  };
}
