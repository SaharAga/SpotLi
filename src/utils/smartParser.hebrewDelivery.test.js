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

/**
 * Second real SMS, reported the same day as the first. Its merchant sits on the
 * other side of the tracking number, and the courier is quoted — which the item
 * extractor was reading as the package's description.
 */
const LA_BEAUTE_SMS =
  'לקוח/ה יקר/ה, מספר משלוח 4046309 מ- LA BEAUTE הגיע לחברת ההפצה "פוקוס" ' +
  'למעקב אחר המשלוח בקישור הבא: https://focuslogistics.co.il ' +
  'דברו איתנו בוואצפ : https://bit.ly/focuslogistic';

describe('smartParser — merchant after the tracking number', () => {
  it('names the shop, not the courier, for the reported SMS', () => {
    const parsed = parseSmartText(LA_BEAUTE_SMS);
    expect(parsed.trackingNumber).toBe('4046309');
    expect(parsed.store).toBe('LA BEAUTE');
    // Was "פוקוס" — the distribution company, quoted two clauses later.
    expect(parsed.title).toBe('LA BEAUTE Order');
  });

  it('stops the name where the sentence resumes', () => {
    // "מ- LA BEAUTE הגיע לחברת ההפצה" — without a stop list the whole clause
    // becomes the shop's name.
    expect(parseSmartText(LA_BEAUTE_SMS).store).not.toMatch(/הגיע|לחברת/);
  });

  it.each([
    ['a verb that merely starts with מ', 'החבילה מספר 12345678 ממתינה בלוקר', ''],
    ['another one', 'החבילה מספר 12345678 מוכנה לאיסוף', ''],
    ['a hyphenated prefix', 'מספר משלוח 4046309 מ-קפה עלית הגיע', 'קפה עלית'],
    ['a Latin name attached', 'מספר משלוח 4046309 מBeautyBar הגיע', 'BeautyBar'],
    // The /i flag makes [A-Z0-9_-] match letters, so the identifier guard used
    // to swallow any single-word shop of eight letters or more.
    ['a long single-word shop', 'מספר משלוח 4046309 מ-Perfumery הגיע', 'Perfumery'],
    ['something actually shaped like an ID', 'מספר משלוח 4046309 מ-RS736102941IL הגיע', '']
  ])('reads %s correctly', (_label, text, want) => {
    expect(parseSmartText(text).store).toBe(want);
  });

  it('still lets a quoted item name through when no carrier is being named', () => {
    // The fix must not blind the item extractor generally — only where the
    // quote follows a phrase introducing a delivery company.
    expect(parseSmartText('המשלוח שלך RS736102941IL עם "Mechanical Keyboard" בדרך').title)
      .toContain('Mechanical Keyboard');
  });
});

/**
 * The seven stage misses #241 measured and left failing, across five carriers.
 * Every one produced `in_transit`, because any message carrying a tracking
 * number falls through to that branch — so a stage the parser had no phrase for
 * was indistinguishable from one it read correctly.
 *
 * They are six phrase families, not seven one-offs.
 */
describe('smartParser — delivery stages with no נמסר in them', () => {
  it.each([
    // Collected at the counter — Israel Post, domestic and foreign S10.
    ['collected at the counter', 'לקוח יקר, תודה שאספת את דבר הדואר YY00370128099 בדואר ישראל.', 'delivered'],
    // The courier closed the job — Bar Group, carrier not in our table.
    ['the courier closed the job', 'לקוח/ה יקר/ה, שליח דיווח ביצוע שליחות 7920079311 מדלתא. לפרטים ומשוב על השליח: https://octu.io/p8x0TX', 'delivered'],
    // You are being asked to rate the delivery — Cheetah.
    ['a delivery rating request', 'היי, המשלוח 101300711 הגיע לד21, איך היה עם השליח? נשמח לשמוע!', 'delivered'],
    // Handed to a pickup point, not to the recipient — Bar Distribution.
    ['handed to a pickup point', 'בר הפצה - דבר דואר BAR9018372 נמסר לנקודת האיסוף ברחוב הרצל 44.', 'ready_for_pickup'],
    // The courier is asking to hand it over today — Tapuz.
    ['a courier asking to deliver', 'היי, שליח של H&M Israel מבקש למסור חבילה היום. למעקב https://tapuzdelivery.com/tn?tracking_number=jCWLR0', 'out_for_delivery'],
    // A delivery was attempted and failed — Buzzr.
    ['a failed delivery attempt', 'באזר: ניסינו למסור את BZR2039485 ולא היית בבית. ננסה שוב מחר בין 09:00-13:00.', 'exception']
  ])('reads %s', (_label, text, want) => {
    expect(parseSmartText(text).status).toBe(want);
  });

  it('does not call a pickup-point handover a delivery', () => {
    // נמסר is present, and `לנקודת` is why it is not delivered — the same
    // exclusion `לשליח` already had.
    expect(parseSmartText('החבילה 48094292 נמסרה לנקודת האיסוף ברחוב הרצל 44').status)
      .toBe('ready_for_pickup');
  });

  it('does not treat a courier merely being mentioned as a rating request', () => {
    // The rating family is the broadest of the three, so it is kept to explicit
    // rating language: a message that only says a courier is coming is not one.
    expect(parseSmartText('שליח יגיע אליך מחר עם המשלוח 48094292').status).not.toBe('delivered');
  });

  it('separates a failed attempt from a courier about to deliver', () => {
    // Both contain למסור, and they are opposite stages.
    expect(parseSmartText('ניסינו למסור את BZR2039485 ולא היית בבית').status).toBe('exception');
    expect(parseSmartText('שליח מבקש למסור את BZR2039485 היום').status).toBe('out_for_delivery');
  });
});

describe('smartParser — Focus Logistics', () => {
  it('names the courier the message names', () => {
    const parsed = parseSmartText(LA_BEAUTE_SMS);
    expect(parsed.carrier).toBe('focus');
    // The merchant and the courier are different things and both survive.
    expect(parsed.store).toBe('LA BEAUTE');
  });

  it.each([
    ['the distribution-company phrase', 'הגיע לחברת ההפצה "פוקוס"'],
    ['the host', 'למעקב https://focuslogistics.co.il/tracking/4046309'],
    ['the English name', 'Handed to Focus Logistics for final delivery']
  ])('recognises it from %s', (_label, text) => {
    expect(parseSmartText(`משלוח 4046309 ${text}`).carrier).toBe('focus');
  });

  it.each([
    'הפוקוס שלנו על שירות מהיר, משלוח 12345678',
    'משלוח 12345678 בפוקוס מלא'
  ])('does not claim the bare word: %s', (text) => {
    // "פוקוס" is an ordinary Hebrew word — the same reason `cargo` is anchored.
    expect(parseSmartText(text).carrier).not.toBe('focus');
  });

  it('has no bare-digit detection rule', async () => {
    // 4046309 is seven digits. A rule that loose would also claim order
    // numbers and PINs across every other carrier's messages.
    const { CARRIERS } = await import('../types/carriers.js');
    for (const r of CARRIERS.focus.patterns) {
      expect('4046309').not.toMatch(r.re);
    }
  });
});
