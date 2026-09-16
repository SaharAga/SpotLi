import { describe, it, expect } from 'vitest';
import { parseSmartText, alternateTrackingNumbers } from '../../utils/smartParser';
import { findPackageByAnyTrackingNumber, mergePackageData } from '../../services/deliveryService';

/**
 * A courier handover SMS names two numbers: the courier's own tracking number
 * and the merchant's shipment number. Which of the two the parser ranks first
 * is a scoring decision — it says nothing about which one the user's dashboard
 * already holds.
 *
 * This is the real YDM/iHerb message that exposed the gap. The dashboard held
 * the package under `19611199`; the parser ranked `GAIH50911204` first; the
 * duplicate check only ever looked at the primary, so a package already being
 * tracked was filed a second time. The parser had extracted the matching number
 * the whole time — nothing ever asked it for the number.
 *
 * Guards the seam end to end (parse -> alternates -> match -> merge) rather
 * than any one function, because each half looked correct on its own.
 */
const YDM_HANDOVER_SMS = `איזו התרגשות!
שליח מטעם I-HERB
בדרך אליך לכתובת שדרות בן גוריון 23 ראש העין
השליח צפוי להגיע אליך במהלך היום.
מספר שליחות: 19611199
 מספר מעקב: GAIH50911204
 לינק למעקב: https://ilto.run/1vzKDwn0JY
בברכה,
קבוצת YDM`;

describe('Integration: courier handover SMS matches a package held under its other number', () => {
  const existingPackage = {
    id: 'pkg-iherb',
    title: 'iHerb order',
    trackingNumber: '19611199',
    carrier: 'other',
    status: 'in_transit',
    aliases: []
  };

  it('ranks the courier number first but still finds the package', () => {
    const parsed = parseSmartText(YDM_HANDOVER_SMS);

    // The precondition that made this bug invisible: the primary genuinely is
    // the number the dashboard does NOT have.
    expect(parsed.trackingNumber).toBe('GAIH50911204');
    expect(alternateTrackingNumbers(parsed)).toContain('19611199');

    const match = findPackageByAnyTrackingNumber(
      [existingPackage],
      [parsed.trackingNumber, ...alternateTrackingNumbers(parsed)]
    );
    expect(match?.id).toBe('pkg-iherb');
  });

  it('keeps the dashboard number as primary and files the courier number as an alias', () => {
    const parsed = parseSmartText(YDM_HANDOVER_SMS);
    const merged = mergePackageData(existingPackage, {
      trackingNumber: parsed.trackingNumber,
      aliases: alternateTrackingNumbers(parsed),
      status: parsed.status
    });

    // The user keeps looking the package up by the number they already know.
    expect(merged.trackingNumber).toBe('19611199');
    expect(merged.aliases).toContain('GAIH50911204');
    expect(merged.aliases).not.toContain('19611199');
  });

  it('matches on either number once the alias has been recorded', () => {
    // The durable half: a second message quoting only the courier number now
    // resolves too, whichever way a later parse happens to rank them.
    const parsed = parseSmartText(YDM_HANDOVER_SMS);
    const merged = { ...existingPackage, ...mergePackageData(existingPackage, {
      trackingNumber: parsed.trackingNumber,
      aliases: alternateTrackingNumbers(parsed)
    }) };

    expect(findPackageByAnyTrackingNumber([merged], ['GAIH50911204'])?.id).toBe('pkg-iherb');
    expect(findPackageByAnyTrackingNumber([merged], ['19611199'])?.id).toBe('pkg-iherb');
  });

  it('does not match an unrelated package that shares no number', () => {
    const parsed = parseSmartText(YDM_HANDOVER_SMS);
    const unrelated = { id: 'pkg-other', trackingNumber: 'RS948219481IL', aliases: [] };

    expect(findPackageByAnyTrackingNumber(
      [unrelated],
      [parsed.trackingNumber, ...alternateTrackingNumbers(parsed)]
    )).toBeNull();
  });
});

/**
 * The two real YDM messages, as received. They arrived minutes apart and fail
 * in opposite directions, which is why both are pinned here rather than one
 * standing in for the other.
 */
describe('Integration: the YDM messages, carrier and merchant', () => {
  it('names the courier and the merchant on the handover message', () => {
    const parsed = parseSmartText(YDM_HANDOVER_SMS);

    // Was `other` / `Other / Universal`: nothing knew the sign-off.
    expect(parsed.carrier).toBe('ydm');
    // Was empty. `\biherb\b` could not see across the hyphen in "I-HERB", so an
    // iHerb parcel came back with no merchant and no brand colour.
    expect(parsed.store).toBe('iHerb');
  });

  it('reads a delivery confirmation that carries no tracking number at all', () => {
    // The second message. It proves delivery and names nothing to match on —
    // no number, and an empty merchant slot in the courier's own template
    // ("החבילה שלך מ נמסרה"). Smart Import cannot connect it to a package; only
    // live tracking can. What it must not do is invent something.
    const deliveredSms = `Gal aga איזה כיף לך!
החבילה שלך מ נמסרה
בהצלחה לGal aga בכתובת: שדרות בן גוריון 23 ראש העין
לכניסה: http://ydm-feedback.co.il/?phone=0526808680
תודה רבה,
קבוצת YDM`;

    const parsed = parseSmartText(deliveredSms);

    expect(parsed.carrier).toBe('ydm');
    expect(parsed.status).toBe('delivered');
    expect(parsed.trackingNumber).toBe('');
    // The empty merchant slot must stay empty rather than absorbing the verb
    // that follows it.
    expect(parsed.store).toBe('');
  });

  it('does not file the courier as the merchant', () => {
    // "שליח מטעם <name>" introduces the shop, but the same shape also
    // introduces the courier. A bare courier name is the dangerous case: it is
    // absent from the carrier phrase list on purpose, because words like פוקוס
    // are ordinary Hebrew and only anchored forms are safe to match there.
    expect(parseSmartText('שליח מטעם קבוצת YDM בדרך אליך').store).toBe('');
    expect(parseSmartText('שליח של פוקוס בדרך אליך').store).toBe('');
    // A shop nobody has catalogued still comes through.
    expect(parseSmartText('שליח מטעם BeautyBar בדרך אליך').store).toBe('BeautyBar');
  });
});
