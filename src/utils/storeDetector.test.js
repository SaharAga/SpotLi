import { describe, it, expect } from 'vitest';
import { detectStore, STORES } from './storeDetector';

describe('Store / Merchant Detection Engine', () => {
  it('detects stores from explicit English names', () => {
    expect(detectStore('Order from Amazon.com')?.id).toBe('amazon');
    expect(detectStore('AliExpress Package arriving')?.id).toBe('aliexpress');
    expect(detectStore('New clothes from ASOS')?.id).toBe('asos');
    expect(detectStore('SHEIN summer dress')?.id).toBe('shein');
    expect(detectStore('Vitamins from iHerb')?.id).toBe('iherb');
    expect(detectStore('Zara jacket')?.id).toBe('zara');
    expect(detectStore('Nike Air Jordan')?.id).toBe('nike');
    expect(detectStore('Apple iPhone 15 Pro')?.id).toBe('apple');
    expect(detectStore('KSP gaming laptop')?.id).toBe('ksp');
    expect(detectStore('Ivory computer screen')?.id).toBe('ivory');
    expect(detectStore('eBay vintage watch')?.id).toBe('ebay');
    expect(detectStore('Next kids shirts')?.id).toBe('next');
    expect(detectStore('Terminal X order #1948')?.id).toBe('terminalx');
    expect(detectStore('Super-Pharm cosmetics')?.id).toBe('superpharm');
  });

  it('detects stores from Hebrew strings', () => {
    expect(detectStore('הזמנה מאמזון ארה״ב')?.id).toBe('amazon');
    expect(detectStore('חבילה מעלי אקספרס')?.id).toBe('aliexpress');
    expect(detectStore('שמלה מאסוס')?.id).toBe('asos');
    expect(detectStore('בגדים משיין')?.id).toBe('shein');
    expect(detectStore('תוספי תזונה מאייהרב')?.id).toBe('iherb');
    expect(detectStore('זארה עודפים')?.id).toBe('zara');
    expect(detectStore('נעלי נייקי')?.id).toBe('nike');
    expect(detectStore('מוצר אפל מקורי')?.id).toBe('apple');
    expect(detectStore('קיי אס פי סניף נתניה')?.id).toBe('ksp');
    expect(detectStore('מחשב מאייבורי')?.id).toBe('ivory');
    expect(detectStore('מוצר מאיביי')?.id).toBe('ebay');
    expect(detectStore('בגדי ילדים מנקסט')?.id).toBe('next');
    expect(detectStore('טרמינל איקס בגדי ספורט')?.id).toBe('terminalx');
    expect(detectStore('סופר-פארם מוצרי טיפוח')?.id).toBe('superpharm');
  });

  it('detects store from package object with multiple fields', () => {
    const pkg = {
      title: 'Running Shoes',
      origin: 'Nike Warehouse',
      notes: 'Please leave at doorstep'
    };
    const res = detectStore(pkg);
    expect(res).not.toBeNull();
    expect(res?.id).toBe('nike');
    expect(res?.brandColor).toBe('#FA5400');
  });

  it('returns valid metadata including brandColor, hebrewName, and icon', () => {
    const store = STORES['amazon'];
    expect(store.id).toBe('amazon');
    expect(store.hebrewName).toBe('אמזון');
    expect(store.brandColor).toBe('#FF9900');
    expect(store.badgeBg).toBeDefined();
    expect(store.textColor).toBeDefined();
    expect(store.borderColor).toBeDefined();
    expect(store.website).toBe('https://www.amazon.com');
  });

  it('handles unknown or empty inputs gracefully', () => {
    expect(detectStore('')).toBeNull();
    expect(detectStore(null)).toBeNull();
    expect(detectStore(undefined)).toBeNull();
    expect(detectStore('Random unbranded gadget')).toBeNull();
    expect(detectStore({})).toBeNull();
  });

  it('memoizes results in cache for identical object references and strings', () => {
    const pkg = { title: 'Zara Summer Dress', notes: 'Express' };
    const firstResult = detectStore(pkg);
    const secondResult = detectStore(pkg);
    expect(firstResult).toBe(secondResult);
    expect(firstResult?.id).toBe('zara');

    const strFirst = detectStore('Order from Amazon.com');
    const strSecond = detectStore('Order from Amazon.com');
    expect(strFirst).toBe(strSecond);
    expect(strFirst?.id).toBe('amazon');
  });
});
