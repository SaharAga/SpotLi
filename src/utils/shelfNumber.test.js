import { describe, it, expect } from 'vitest';
import { extractShelfNumber, parseSmartText } from './smartParser.js';

describe('extractShelfNumber', () => {
  it('extracts Hebrew shelf numbers in various real-world formats', () => {
    // King Stock / retail counter SMS format
    expect(extractShelfNumber('שלום, חבילתך מקינג סטוק ממתינה לאיסוף. מדף ג693 קוד איסוף 1234')).toBe('ג693');
    expect(extractShelfNumber('חבילה מחכה לך בסניף. מדף: 412')).toBe('412');
    expect(extractShelfNumber('מספר מדף: ג-693 בסוכנות הדואר')).toBe('ג-693');
    expect(extractShelfNumber('דבר הדואר ממתין במדף 58 תודה')).toBe('58');
    expect(extractShelfNumber('איסוף מסניף ראשי, מדף מס\' 12ב')).toBe('12ב');
  });

  it('extracts English shelf and bin numbers', () => {
    expect(extractShelfNumber('Your parcel is ready for pickup at shelf B-12')).toBe('B-12');
    expect(extractShelfNumber('Collection point bin #104')).toBe('104');
    expect(extractShelfNumber('Shelf 42 please show to clerk')).toBe('42');
  });

  it('returns empty string when no shelf number is present or input is invalid', () => {
    expect(extractShelfNumber('')).toBe('');
    expect(extractShelfNumber(null)).toBe('');
    expect(extractShelfNumber('Your order has been shipped with DHL')).toBe('');
  });

  it('propagates shelfNumber in parseSmartText result', () => {
    const text = 'החבילה שלך מקינג סטוק מחכה לך בסניף הרצל. מדף ג693 קוד איסוף 7788 מספר מעקב BZR902810';
    const result = parseSmartText(text);
    expect(result.shelfNumber).toBe('ג693');
    expect(result.lockerPin).toBe('7788');
  });
});
