import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser.js';

/**
 * Driven by a real delivery SMS, kept OUT of `parserEvalCorpus.js` on purpose:
 * that corpus is held out, and its header forbids adding a case to it because
 * a regex changed. This is the tuning-side regression test; the held-out
 * corpus's job is to say whether the fix generalized, and it now scores
 * delivery stage and merchant so it can.
 */
const SEESTARZ_SMS =
  'היי Sahar Aga, חבילה מSeestarz online מספר 48094292 נמסרה ל- סהר Enjoy, ' +
  'נשמח אם תדרג את חוויית המשלוח בקישור bit.ly/4mvH1eA\nתודה על שיתוף הפעולה!';

describe('smartParser — Hebrew delivery phrasing', () => {
  it('reads the reported SMS as delivered, from the named merchant', () => {
    const parsed = parseSmartText(SEESTARZ_SMS);
    expect(parsed.trackingNumber).toBe('48094292');
    expect(parsed.status).toBe('delivered');
    expect(parsed.store).toBe('Seestarz online');
    // The title stops being the tracking number repeated back at the user.
    expect(parsed.title).toBe('Seestarz online Order');
  });

  // The noun and the verb are separated by a merchant and a number here. The
  // gap is what the fix allows; these are the things it must not swallow.
  it.each([
    ['noun and verb adjacent', 'החבילה נמסרה בהצלחה ליעד 48094292'],
    ['verb before the noun', 'נמסרה חבילה שמספרה 48094292'],
    ['merchant and number in between', 'חבילה מקפה עלית מספר 48094292 נמסרה ל- סהר']
  ])('reads %s as delivered', (_label, text) => {
    expect(parseSmartText(text).status).toBe('delivered');
  });

  it.each([
    ['handover to the courier', 'החבילה 48094292 נמסרה לשליח והיא בדרך אליך'],
    ['handover, adjacent', 'החבילה נמסרה לשליח'],
    ['plain negation', 'החבילה מספר 48094292 לא נמסרה, ננסה שוב מחר'],
    ['טרם', 'החבילה מספר 48094292 טרם נמסרה'],
    ['עדיין לא', 'החבילה מספר 48094292 עדיין לא נמסרה'],
    ['a different sentence', 'החבילה 48094292 בדרך אליך. הודעה קודמת נמסרה אליך בהצלחה'],
    ['a different line', 'החבילה 48094292 בדרך\nהודעה נמסרה']
  ])('does not read %s as delivered', (_label, text) => {
    expect(parseSmartText(text).status).not.toBe('delivered');
  });

  it('still calls a handover to the courier out_for_delivery', () => {
    // The first cut of the gap broke exactly this: `[ההת]?` backtracked to
    // empty when the לשליח lookahead failed, so נמסרה לשליח matched the bare
    // נמסר and reported a handover as a delivery.
    expect(parseSmartText('החבילה 48094292 נמסרה לשליח והיא בדרך אליך').status).toBe('out_for_delivery');
  });
});

describe('smartParser — merchant named by sentence shape', () => {
  it('reads a shop no catalogue lists', () => {
    expect(parseSmartText('חבילה מקפה עלית שמספרה 48094292 נמסרה').store).toBe('קפה עלית');
  });

  it('never displaces a catalogue match, which carries branding a phrase cannot', () => {
    const parsed = parseSmartText('חבילה מAliExpress מספר LP00582910482CN נשלחה');
    expect(parsed.store).toBe('AliExpress');
    expect(parsed.storeInfo?.id).toBe('aliexpress');
  });

  it.each([
    ['a locker', 'החבילה מהלוקר מספר 12345678 ממתינה'],
    ['a courier', 'החבילה מהשליח מספר 12345678'],
    ['a branch', 'החבילה מהסניף מספר 12345678'],
    ['a generic shop', 'החבילה מהחנות מספר 12345678']
  ])('does not mistake %s for a merchant', (_label, text) => {
    expect(parseSmartText(text).store).toBe('');
  });

  it('extracts nothing when the sentence names no merchant', () => {
    expect(parseSmartText('חבילה 48094292 נמסרה').store).toBe('');
  });
});
