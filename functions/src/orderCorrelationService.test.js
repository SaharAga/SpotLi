import { describe, it, expect, vi } from 'vitest';
import {
  isValidOrderNumber,
  isGenericPackageTitle,
  findExistingOrderMatch,
  extractProductTitleFromOrderEmail,
  fetchOrderConfirmationTitleFromGmail
} from './orderCorrelationService.js';

describe('orderCorrelationService', () => {
  describe('isValidOrderNumber', () => {
    it('accepts real-world e-commerce order numbers', () => {
      expect(isValidOrderNumber('818274917401')).toBe(true);
      expect(isValidOrderNumber('114-8291029-1928301')).toBe(true);
      expect(isValidOrderNumber('GSH1239841')).toBe(true);
      expect(isValidOrderNumber('ORD-998822')).toBe(true);
    });

    it('rejects short, ambiguous, or date-like strings', () => {
      expect(isValidOrderNumber('')).toBe(false);
      expect(isValidOrderNumber(null)).toBe(false);
      expect(isValidOrderNumber('12345')).toBe(false); // < 6 chars
      expect(isValidOrderNumber('20260911')).toBe(false); // YYYYMMDD date
      expect(isValidOrderNumber('202410291200')).toBe(false); // timestamp
      expect(isValidOrderNumber('11111111')).toBe(false); // repeated digits
    });
  });

  describe('isGenericPackageTitle', () => {
    it('detects generic store and courier placeholder titles', () => {
      expect(isGenericPackageTitle('AliExpress Order')).toBe(true);
      expect(isGenericPackageTitle('aliexpress order')).toBe(true);
      expect(isGenericPackageTitle('Amazon Package')).toBe(true);
      expect(isGenericPackageTitle('Online Order')).toBe(true);
      expect(isGenericPackageTitle('New Tracked Package')).toBe(true);
      expect(isGenericPackageTitle('SpotLi Package')).toBe(true);
      expect(isGenericPackageTitle('Package LP00582910482CN')).toBe(true);
      expect(isGenericPackageTitle('חבילה חדשה למעקב')).toBe(true);
    });

    it('does not classify real product titles as generic', () => {
      expect(isGenericPackageTitle('Keychron K2 Mechanical Keyboard')).toBe(false);
      expect(isGenericPackageTitle('Wireless Mouse RGB')).toBe(false);
      expect(isGenericPackageTitle('Nike Running Shoes')).toBe(false);
      expect(isGenericPackageTitle('אוזניות אלחוטיות')).toBe(false);
    });
  });

  describe('findExistingOrderMatch (Tier 1)', () => {
    it('returns match when existing package is untracked and shares orderNumber', () => {
      const orderMap = new Map([
        ['818274917401', {
          id: 'pkg-untracked-1',
          data: {
            id: 'pkg-untracked-1',
            title: 'Mechanical Keyboard',
            orderNumber: '818274917401',
            trackingNumber: ''
          }
        }]
      ]);

      const res = findExistingOrderMatch(orderMap, '818274917401', 'LP00582910482CN');
      expect(res.matchedDocId).toBe('pkg-untracked-1');
      expect(res.isMultiParcel).toBe(false);
      expect(res.existingData.title).toBe('Mechanical Keyboard');
    });

    it('enforces multi-parcel protection when existing package has a DIFFERENT tracking number', () => {
      const orderMap = new Map([
        ['818274917401', {
          id: 'pkg-parcel-1',
          data: {
            id: 'pkg-parcel-1',
            title: 'Mechanical Keyboard',
            orderNumber: '818274917401',
            trackingNumber: 'LP00111111111CN' // already tracked!
          }
        }]
      ]);

      // Parcel 2 arrives with same orderNumber but new tracking number
      const res = findExistingOrderMatch(orderMap, '818274917401', 'LP00222222222CN');
      expect(res.isMultiParcel).toBe(true);
      expect(res.matchedDocId).toBe('pkg-parcel-1');
      // Caller uses this signal to NOT overwrite parcel 1!
    });
  });

  describe('extractProductTitleFromOrderEmail', () => {
    it('extracts item title from Schema.org ParcelDelivery/Order JSON-LD', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "ParcelDelivery",
          "trackingNumber": "LP00582910482CN",
          "itemShipped": {
            "name": "Keychron K2 Wireless Mechanical Keyboard"
          }
        }
        </script>
      `;
      const title = extractProductTitleFromOrderEmail({ html });
      expect(title).toBe('Keychron K2 Wireless Mechanical Keyboard');
    });

    it('extracts quoted product title from subject', () => {
      const subject = 'Your AliExpress order for "Wireless Ergonomic Mouse" has shipped';
      const title = extractProductTitleFromOrderEmail({ subject });
      expect(title).toBe('Wireless Ergonomic Mouse');
    });

    it('extracts product name from body line item pattern and strips PII', () => {
      const snippet = 'Order #818274917401\nItem: Gaming Headset with Mic\nPaid with Visa **** 1234\nTel: 054-1234567';
      const title = extractProductTitleFromOrderEmail({ snippet });
      expect(title).toBe('Gaming Headset with Mic');
    });
  });

  describe('fetchOrderConfirmationTitleFromGmail (Tier 2)', () => {
    it('searches Gmail and returns product title within budget', async () => {
      const mockGmail = {
        users: {
          messages: {
            list: vi.fn().mockResolvedValue({
              data: { messages: [{ id: 'msg-123' }] }
            }),
            get: vi.fn().mockResolvedValue({
              data: {
                snippet: 'Item: Studio Monitor Headphones\nTotal: $49.99',
                payload: {
                  headers: [{ name: 'Subject', value: 'Order Confirmation #818274917401' }]
                }
              }
            })
          }
        }
      };

      const budget = { used: 0, max: 2 };
      const title = await fetchOrderConfirmationTitleFromGmail({
        gmail: mockGmail,
        orderNumber: '818274917401',
        store: 'AliExpress',
        budget
      });

      expect(title).toBe('Studio Monitor Headphones');
      expect(budget.used).toBe(1);
      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: '"818274917401" from:aliexpress.com',
        maxResults: 2
      });
    });

    it('returns null when budget is exhausted', async () => {
      const mockGmail = { users: { messages: { list: vi.fn() } } };
      const budget = { used: 2, max: 2 };

      const title = await fetchOrderConfirmationTitleFromGmail({
        gmail: mockGmail,
        orderNumber: '818274917401',
        budget
      });

      expect(title).toBeNull();
      expect(mockGmail.users.messages.list).not.toHaveBeenCalled();
    });
  });
});
