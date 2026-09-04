import { describe, it, expect } from 'vitest';
import { parseSmartText, extractUrlsAndTrackings, extractTrackingCandidates } from './smartParser';
import { detectCarrier, isPhoneNumber } from './carrierDetector';
import { evaluateCandidateRules } from './candidateScorer';
import { toLocalISODate } from './dateUtils';

describe('Smart Import Detection & Date Fixes (#134, #135)', () => {
  it('extracts "today" delivery status and expectedDeliveryDate (#135)', () => {
    const todayISO = toLocalISODate();
    const parsed = parseSmartText('החבילה תסופק היום עם שליח של בר הפצה');

    expect(parsed.status).toBe('out_for_delivery');
    expect(parsed.expectedDeliveryDate).toBe(todayISO);
    expect(parsed.carrier).toBe('bar-distribution');
  });

  it('extracts explicit arrival date and status from message (#135)', () => {
    const parsed = parseSmartText('החבילה הגיעה ב19/08 למקום שהייתי צריך לאסוף, קוד איסוף 4829');

    expect(parsed.expectedDeliveryDate).toContain('-08-19');
    expect(parsed.status).toBe('ready_for_pickup');
    expect(parsed.lockerPin).toBe('4829');
  });

  it('rejects Israeli phone numbers from being detected as FedEx (#134)', () => {
    expect(isPhoneNumber('972504328304')).toBe(true);
    expect(isPhoneNumber('+972504328304')).toBe(true);
    expect(isPhoneNumber('0504328304')).toBe(true);

    const det1 = detectCarrier('972504328304');
    expect(det1.carrierId).toBe('other');

    const eval1 = evaluateCandidateRules('972504328304');
    expect(eval1.formatMatch).toBe(false);
    expect(eval1.carrierCandidates).not.toContain('fedex');

    const parsed = parseSmartText('שלום, חבילתך בדרך. ליצירת קשר עם השליח: 972504328304');
    expect(parsed.trackingNumber).not.toBe('972504328304');
    expect(parsed.carrier).not.toBe('fedex');
  });

  it('extracts tracking from AliExpress URL query params instead of DETAILHTM (#134)', () => {
    const url = 'https://track.aliexpress.com/logistics/detail.htm?tradeId=8182910283019283';
    const extracted = extractUrlsAndTrackings(url);

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0].trackingNumber).toBe('8182910283019283');
    expect(extracted[0].trackingNumber).not.toBe('DETAILHTM');
    expect(extracted[0].carrierHint).toBe('cainiao');

    const parsed = parseSmartText(`הזמנתך נשלחה מעלי אקספרס: ${url}`);
    expect(parsed.trackingNumber).toBe('8182910283019283');
    expect(parsed.carrier).toBe('cainiao');
  });

  it('extracts clean numeric tracking number for HFD without prefix noise (#134)', () => {
    const text = 'הודעה מחברת HFD: חבילתך שמספרה Hfd008555380 הגיעה לנקודת איסוף מכולת שלום';
    const parsed = parseSmartText(text);

    expect(parsed.carrier).toBe('hfd');
    expect(parsed.trackingNumber).toBe('HFD008555380');
    expect(parsed.trackingNumber).not.toContain('Hfd');
  });

  it('supports expanded AliExpress formats like AEWH... and Cainiao S... (#134)', () => {
    const text1 = 'AliExpress: order dispatched, tracking number S0000039281920';
    const parsed1 = parseSmartText(text1);
    expect(parsed1.carrier).toBe('cainiao');
    expect(parsed1.trackingNumber).toBe('S0000039281920');

    const text2 = 'AliExpress tracking AEWH00192841 is in transit';
    const parsed2 = parseSmartText(text2);
    expect(parsed2.carrier).toBe('cainiao');
    expect(parsed2.trackingNumber).toBe('AEWH00192841');
  });
});
