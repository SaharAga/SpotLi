/**
 * Metamorphic transformations for the Smart Import parser.
 *
 * A metamorphic test needs no new labels. Instead of asking "is this answer
 * right?", it asks "does the answer survive a change that did not alter what
 * the message says?". Real courier SMS arrive full of noise that carries no
 * meaning — a typographic apostrophe instead of an ASCII one, invisible bidi
 * marks around Latin identifiers in Hebrew text, a forwarding header — and
 * each of those has already cost a carrier detection at least once.
 *
 * The value is leverage: every corpus case, and every real message added
 * later, is automatically multiplied into ~25 harder variants.
 *
 * ── The rule that makes this trustworthy ──────────────────────────────────
 *
 * A transformation must be genuinely meaning-preserving. If applying it could
 * legitimately change the correct answer, then a failure is a bug in the test,
 * and false alarms are what kill a suite like this.
 *
 * That is why every transform declares a `scope`:
 *
 *   'anywhere'      safe across the whole message (envelope, URL spelling,
 *                   whitespace between words)
 *   'outside-ids'   must not touch an identifier — swapping `'`→`’` inside
 *                   צ'יטה is safe, but swapping `-`→`–` inside
 *                   RS-948-219-481-IL rewrites the identifier itself
 *
 * `outside-ids` transforms are applied only to the parts of the message that
 * are not a candidate identifier, using `maskIdentifiers` below. When in
 * doubt, a transform belongs in `outside-ids`.
 */

/** Characters that only ever appear inside an identifier-looking run. */
const IDENTIFIER_RUN = /\b[A-Za-z0-9][A-Za-z0-9\-_]{4,}\b/g;

/**
 * Splits text into identifier and non-identifier segments, applies `fn` to the
 * non-identifier segments only, and reassembles.
 *
 * @param {string} text
 * @param {(chunk: string) => string} fn
 * @returns {string}
 */
export function maskIdentifiers(text, fn) {
  let out = '';
  let lastIndex = 0;

  for (const match of text.matchAll(IDENTIFIER_RUN)) {
    out += fn(text.slice(lastIndex, match.index));
    out += match[0];
    lastIndex = match.index + match[0].length;
  }

  return out + fn(text.slice(lastIndex));
}

/** Bidi and zero-width characters that are invisible but present in real SMS. */
const RLM = '‏';
const LRM = '‎';
const ZWJ = '‍';
const BOM = '﻿';
const NBSP = ' ';

/**
 * @typedef {object} Transform
 * @property {string} name        identifier used in the robustness report
 * @property {string} models      the real-world thing this imitates
 * @property {'anywhere'|'outside-ids'} scope
 * @property {(text: string) => string} apply
 */

/** @type {Transform[]} */
export const TRANSFORMS = [
  // ── Typography ─────────────────────────────────────────────────────────
  {
    name: 'curly-apostrophe',
    models: "phone keyboards type ’ where fixtures are written with '",
    scope: 'outside-ids',
    apply: (t) => t.replace(/'/g, '’')
  },
  {
    name: 'hebrew-geresh',
    models: 'Hebrew geresh ׳ used instead of an apostrophe',
    scope: 'outside-ids',
    apply: (t) => t.replace(/'/g, '׳')
  },
  {
    name: 'curly-quotes',
    models: 'smart quotes substituted by the sending system',
    scope: 'outside-ids',
    apply: (t) => t.replace(/"/g, '”')
  },
  {
    name: 'en-dash',
    models: 'en dash substituted for a hyphen in prose',
    scope: 'outside-ids',
    apply: (t) => t.replace(/ - /g, ' – ')
  },

  // ── Invisible characters ───────────────────────────────────────────────
  {
    name: 'rlm-around-latin',
    models: 'bidi marks Hebrew senders wrap around Latin identifiers',
    scope: 'anywhere',
    apply: (t) => t.replace(/([A-Za-z0-9]{6,})/g, `${RLM}$1${RLM}`)
  },
  {
    name: 'lrm-around-latin',
    models: 'left-to-right marks inserted by messaging clients',
    scope: 'anywhere',
    apply: (t) => t.replace(/([A-Za-z0-9]{6,})/g, `${LRM}$1${LRM}`)
  },
  {
    name: 'bom-prefix',
    models: 'byte-order mark from a copy-paste out of a document',
    scope: 'anywhere',
    apply: (t) => BOM + t
  },
  {
    name: 'zwj-in-prose',
    models: 'zero-width joiners surviving an emoji-capable client',
    scope: 'outside-ids',
    apply: (t) => t.replace(/ /g, ` ${ZWJ}`)
  },
  {
    name: 'nbsp-spaces',
    models: 'non-breaking spaces from an HTML email body',
    scope: 'outside-ids',
    apply: (t) => t.replace(/ /g, NBSP)
  },

  // ── Whitespace ─────────────────────────────────────────────────────────
  {
    name: 'double-spaces',
    models: 'inconsistent spacing in a hand-edited template',
    scope: 'outside-ids',
    apply: (t) => t.replace(/ /g, '  ')
  },
  {
    name: 'tabs-for-spaces',
    models: 'tab characters from a pasted table cell',
    scope: 'outside-ids',
    apply: (t) => t.replace(/ {2,}/g, '\t')
  },
  {
    name: 'crlf-newlines',
    models: 'Windows line endings',
    scope: 'anywhere',
    apply: (t) => t.replace(/\n/g, '\r\n')
  },
  {
    name: 'newline-for-space',
    models: 'a message wrapped differently by a narrow screen',
    scope: 'outside-ids',
    apply: (t) => t.replace(/\. /g, '.\n')
  },
  {
    name: 'surrounding-whitespace',
    models: 'leading and trailing whitespace from a clipboard paste',
    scope: 'anywhere',
    apply: (t) => `\n  ${t}  \n`
  },

  // ── Envelope ───────────────────────────────────────────────────────────
  {
    name: 'forward-prefix',
    models: 'a message forwarded from another app',
    scope: 'anywhere',
    apply: (t) => `Fwd: ${t}`
  },
  {
    name: 'hebrew-forward-header',
    models: 'WhatsApp forward header above the original text',
    scope: 'anywhere',
    apply: (t) => `הודעה שהועברה\n\n${t}`
  },
  {
    name: 'quoted-reply',
    models: 'quoted with "> " by an email client',
    scope: 'anywhere',
    apply: (t) => t.split('\n').map((line) => `> ${line}`).join('\n')
  },
  {
    name: 'signature-appended',
    models: 'an app signature appended below the message',
    scope: 'anywhere',
    apply: (t) => `${t}\n\n--\nנשלח מהאייפון שלי`
  },
  {
    name: 'unsubscribe-footer',
    models: 'a bulk-sender opt-out footer',
    scope: 'anywhere',
    apply: (t) => `${t}\nלהסרה השב הסר`
  },

  // ── URL spelling ───────────────────────────────────────────────────────
  {
    name: 'drop-www',
    models: 'the same link written without www.',
    scope: 'anywhere',
    apply: (t) => t.replace(/https:\/\/www\./g, 'https://')
  },
  {
    name: 'add-www',
    models: 'the same link written with www.',
    scope: 'anywhere',
    apply: (t) => t.replace(/https:\/\/(?!www\.)/g, 'https://www.')
  },
  {
    name: 'http-scheme',
    models: 'a plain-http link from an older template',
    scope: 'anywhere',
    apply: (t) => t.replace(/https:\/\//g, 'http://')
  },
  {
    name: 'utm-params',
    models: 'campaign parameters appended to the tracking link',
    scope: 'anywhere',
    apply: (t) => t.replace(/(https?:\/\/[^\s]+?)(?=[\s]|$)/g, (url) => (
      url.includes('?') ? `${url}&utm_source=sms` : `${url}?utm_source=sms`
    ))
  },
  {
    name: 'trailing-slash',
    models: 'a trailing slash on the link path',
    scope: 'anywhere',
    apply: (t) => t.replace(/(https?:\/\/[^\s?#]+?)(?=[\s]|$)/g, '$1/')
  }
];

/**
 * Applies one transform, respecting its scope.
 *
 * @param {Transform} transform
 * @param {string} text
 * @returns {string}
 */
export function applyTransform(transform, text) {
  if (!text) return text;
  return transform.scope === 'outside-ids'
    ? maskIdentifiers(text, transform.apply)
    : transform.apply(text);
}

/**
 * Applies several transforms in order — the composed case, where a curly
 * apostrophe arrives inside a forwarded message that also has bidi marks.
 *
 * @param {Transform[]} transforms
 * @param {string} text
 * @returns {string}
 */
export function applyAll(transforms, text) {
  return transforms.reduce((acc, transform) => applyTransform(transform, acc), text);
}
