import { describe, it, expect } from 'vitest';
import {
  normalizeMessage,
  looksLikeShippingMessage,
  extractStagePhrases,
  extractNgrams,
  extractMessagesFromExport,
  splitCsvLine,
  analyzeCorpus
} from './smsCorpusAnalysis.js';
import { parseSmartText } from './smartParser.js';

describe('smsCorpusAnalysis — normalization', () => {
  it('removes everything that identifies a person or a parcel', () => {
    const out = normalizeMessage(
      'היי סהר, חבילה 48094292 נמסרה. מעקב https://t.co/abc או 050-1234567 או a@b.com'
    );
    expect(out).not.toMatch(/48094292/);
    expect(out).not.toMatch(/https?:/);
    expect(out).not.toMatch(/050/);
    expect(out).not.toMatch(/a@b\.com/);
    expect(out).toContain('נמסרה');
  });

  it('collapses two messages that differ only by their tracking number', () => {
    // This is what makes the counts mean anything: the same phrasing sent a
    // thousand times must be one row, not a thousand.
    expect(normalizeMessage('חבילה 48094292 נמסרה'))
      .toBe(normalizeMessage('חבילה 4046309 נמסרה'));
  });
});

describe('smsCorpusAnalysis — what counts as a shipping message', () => {
  it.each([
    'חבילה 48094292 נמסרה ל- סהר',
    'מספר משלוח 4046309 מ- LA BEAUTE הגיע לחברת ההפצה',
    'Your parcel RS736102941IL is out for delivery'
  ])('includes %s', (text) => {
    expect(looksLikeShippingMessage(text)).toBe(true);
  });

  it.each([
    'קוד האימות שלך הוא 483920',
    'חויבת ב-249.90 ש"ח בכרטיס האשראי',
    ''
  ])('excludes %s', (text) => {
    expect(looksLikeShippingMessage(text)).toBe(false);
  });
});

describe('smsCorpusAnalysis — phrase extraction', () => {
  it('returns a window around the word that carries the stage', () => {
    const phrases = extractStagePhrases(normalizeMessage('לקוח יקר, החבילה שלך נמסרה לשליח היום'));
    expect(phrases.some((p) => p.includes('נמסרה'))).toBe(true);
    expect(phrases.every((p) => p.split(' ').length <= 5)).toBe(true);
  });

  it('returns nothing for a message with no stage word in it', () => {
    expect(extractStagePhrases(normalizeMessage('חבילה מספר 48094292'))).toEqual([]);
  });

  it('never emits a phrase carrying an identifier', () => {
    for (const phrase of extractStagePhrases(normalizeMessage('חבילה RS736102941IL נמסרה היום'))) {
      expect(phrase).not.toMatch(/RS736102941IL/);
    }
  });
});

describe('smsCorpusAnalysis — n-grams', () => {
  it('emits widths 2 to 4', () => {
    const grams = extractNgrams('אחת שתיים שלוש ארבע חמש');
    expect(grams).toContain('אחת שתיים');
    expect(grams).toContain('אחת שתיים שלוש ארבע');
    expect(grams.every((g) => g.split(' ').length <= 4)).toBe(true);
  });

  it('drops an n-gram made only of placeholders', () => {
    expect(extractNgrams('<NUM> <ID> <URL>')).toEqual([]);
  });
});

describe('smsCorpusAnalysis — export formats', () => {
  it('reads an adb content-query dump', () => {
    const dump = [
      'Row: 0 body=חבילה 48094292 נמסרה ל- סהר, תודה',
      'Row: 1 body=מספר משלוח 4046309 מ- LA BEAUTE הגיע',
      'Row: 2 body=null'
    ].join('\n');
    const messages = extractMessagesFromExport(dump, 'sms.txt');
    // The comma inside row 0 must not truncate it — that is why body is
    // projected alone.
    expect(messages).toEqual([
      'חבילה 48094292 נמסרה ל- סהר, תודה',
      'מספר משלוח 4046309 מ- LA BEAUTE הגיע'
    ]);
  });

  it('reads an SMS Backup & Restore xml, decoding entities', () => {
    const xml = '<?xml version="1.0"?><smses><sms body="חבילה &#1502;&#1499;&amp;M נמסרה" /></smses>';
    expect(extractMessagesFromExport(xml, 'x.xml')).toEqual(['חבילה מכ&M נמסרה']);
  });

  it('reads a CSV whose text column contains commas', () => {
    const csv = 'Date,Text\n2026-01-01,"חבילה נמסרה, תודה"';
    expect(extractMessagesFromExport(csv, 'x.csv')).toEqual(['חבילה נמסרה, תודה']);
  });

  it('says which columns it saw when a CSV has no text column', () => {
    expect(() => extractMessagesFromExport('Date,Sender\n1,2', 'x.csv')).toThrow(/Date, Sender/);
  });

  it('reads JSON as strings or as objects', () => {
    expect(extractMessagesFromExport('["a","b"]', 'x.json')).toEqual(['a', 'b']);
    expect(extractMessagesFromExport('[{"body":"a"},{"text":"b"}]', 'x.json')).toEqual(['a', 'b']);
  });

  it('splits a quoted CSV cell containing an escaped quote', () => {
    expect(splitCsvLine('a,"b,""c""",d')).toEqual(['a', 'b,"c"', 'd']);
  });
});

describe('smsCorpusAnalysis — the report', () => {
  const corpus = [
    'קוד האימות שלך הוא 483920',                                   // not shipping
    'חבילה 48094292 נמסרה ל- סהר',                                 // staged: delivered
    'בר הפצה - דבר דואר BAR9018372 נמסר לנקודת האיסוף',            // staged: ready_for_pickup
    'המשלוח 111 בדרך אליך, פלופלופ מיוחד',                          // unstaged
    'המשלוח 222 בדרך אליך, פלופלופ מיוחד'                           // same phrasing again
  ];

  const report = analyzeCorpus(corpus, parseSmartText);

  it('counts only the shipping messages', () => {
    expect(report.total).toBe(5);
    expect(report.shipping).toBe(4);
  });

  it('ranks the phrasings it could not stage, most common first', () => {
    // The two "בדרך אליך" messages differ only by their number, so they are one
    // phrasing seen twice — the whole point of normalizing before counting.
    expect(report.unstagedPhrases[0].count).toBe(2);
    const twice = report.unstagedPhrases.filter((p) => p.count === 2).map((p) => p.phrase);
    expect(twice).toContain('בדרך אליך');
  });

  it('surfaces a phrasing nobody put on a keyword list', () => {
    // The reason discovery uses plain n-grams: a root list can only return
    // phrasings someone already imagined, which is the blind spot this whole
    // tool exists to escape. "פלופלופ" is in no list anywhere.
    const found = analyzeCorpus(
      ['המשלוח 111 פלופלופ מיוחד', 'המשלוח 222 פלופלופ מיוחד'],
      parseSmartText
    );
    expect(found.unstagedPhrases.map((p) => p.phrase)).toContain('פלופלופ מיוחד');
  });

  it('marks a phrase that is just as common in staged messages as not the blocker', () => {
    const mixed = analyzeCorpus([
      'לקוח יקר, החבילה 111 נמסרה',        // staged
      'לקוח יקר, המשלוח 222 פלופלופ'        // unstaged, shares the filler
    ], parseSmartText);
    const filler = mixed.unstagedPhrases.find((p) => p.phrase === 'לקוח יקר');
    expect(filler?.alsoWhenStaged).toBe(1);
    const real = mixed.unstagedPhrases.find((p) => p.phrase.includes('פלופלופ'));
    expect(real?.alsoWhenStaged).toBe(0);
  });

  it('keeps a phrase that did stage a message out of the fix list', () => {
    const unstaged = report.unstagedPhrases.map((p) => p.phrase).join(' | ');
    expect(unstaged).not.toMatch(/נמסרה ל/);
  });

  it('reports the stage distribution and the tracking rate', () => {
    expect(report.stages.map((s) => s.stage)).toContain('delivered');
    expect(report.trackingRate).toBeGreaterThan(0);
    expect(report.trackingRate).toBeLessThanOrEqual(1);
  });

  it('survives a parser that throws on one message', () => {
    const angry = analyzeCorpus(['חבילה נמסרה', 'משלוח בדרך'], (t) => {
      if (t.includes('בדרך')) throw new Error('boom');
      return parseSmartText(t);
    });
    expect(angry.shipping).toBe(2);
    expect(angry.stages.reduce((n, s) => n + s.count, 0)).toBe(1);
  });
});
