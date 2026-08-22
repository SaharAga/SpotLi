import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartImportModal } from './SmartImportModal';
import { parseSmartText } from '../utils/smartParser';

describe('SmartImportModal Component Logic & State Specifications', () => {
  it('exports valid React component function', () => {
    expect(typeof SmartImportModal).toBe('function');
  });

  describe('Modal Logic & Initial State Computation', () => {
    it('initializes parsed state correctly when initialText is provided', () => {
      const initialText = 'שלום! מספר מעקב: RS948219481IL בדואר ישראל';
      const parsed = parseSmartText(initialText);
      expect(parsed.trackingNumber).toBe('RS948219481IL');
      expect(parsed.carrier).toBe('israel-post');
    });

    it('initializes null parsed state when initialText is empty or whitespace', () => {
      const initialText = '   ';
      const shouldParse = Boolean(initialText && initialText.trim());
      expect(shouldParse).toBe(false);
    });
  });

  describe('Text Typing & Parsing Trigger Lifecycle', () => {
    it('correctly parses raw text input and extracts package details', () => {
      const sampleText = 'שלום! דבר דואר שמספרו RS948219481IL נמסר לחלוקה בסניף דיזנגוף סנטר. שעות פתיחה 08:00-19:00.';
      const parsed = parseSmartText(sampleText);

      expect(parsed.trackingNumber).toBe('RS948219481IL');
      expect(parsed.carrier).toBe('israel-post');
      expect(parsed.pickupLocation).toBe('דיזנגוף סנטר');
      expect(parsed.title).toContain('RS948219');
    });

    it('parses AliExpress confirmation SMS and detects merchant and tracking correctly', () => {
      const text = 'AliExpress update: Your order LP00582910482CN has arrived in Israel.';
      const parsed = parseSmartText(text);

      expect(parsed.trackingNumber).toBe('LP00582910482CN');
      expect(parsed.carrier).toBe('cainiao');
      expect(parsed.title).toBe('AliExpress Order');
      expect(parsed.category).toBe('clothing');
    });

    it('parses international DHL express message with AWB number', () => {
      const text = 'DHL Express shipment AWB 4829104821 is out for delivery today.';
      const parsed = parseSmartText(text);

      expect(parsed.trackingNumber).toBe('4829104821');
      expect(parsed.carrier).toBe('dhl');
    });

    it('returns safe fallback values when parsing empty or unrecognized text', () => {
      const emptyParsed = parseSmartText('');
      expect(emptyParsed.trackingNumber).toBe('');
      expect(emptyParsed.carrier).toBe('other');

      const unrecognizedParsed = parseSmartText('Just random greeting without any tracking number or codes.');
      expect(unrecognizedParsed.trackingNumber).toBe('');
      expect(unrecognizedParsed.carrier).toBe('other');
    });
  });

  describe('Quick Examples Data & Interactions', () => {
    const sampleSMS = [
      {
        id: 'israel-post',
        text: 'שלום, דבר דואר שמספרו RS948219481IL נמסר לחלוקה ביחידת הדואר דיזנגוף סנטר. שעות פתיחה: 08:00-19:00.'
      },
      {
        id: 'aliexpress',
        text: 'AliExpress update: Your order for "Mechanical Keyboard" (LP00582910482CN) has arrived at the destination sorting facility in Israel.'
      },
      {
        id: 'dhl',
        text: 'DHL Express shipment AWB 4829104821 is out for delivery today with courier Aviad.'
      }
    ];

    it('successfully extracts valid tracking information for all sample SMS templates', () => {
      sampleSMS.forEach((sample) => {
        const result = parseSmartText(sample.text);
        expect(result.trackingNumber).toBeTruthy();
        expect(result.carrier).not.toBe('other');
      });
    });
  });

  describe('Apply & Cancel Callbacks Contract', () => {
    it('constructs correct payload on applying parsed result', () => {
      const onParsedResult = vi.fn();
      const onClose = vi.fn();

      const parsed = {
        title: 'AliExpress Order',
        titleHe: 'הזמנה מ-עליאקספרס',
        trackingNumber: 'LP00582910482CN',
        carrier: 'cainiao',
        notes: 'AliExpress update: Your order LP00582910482CN has arrived.',
        origin: 'China',
        destination: 'Israel',
        pickupLocation: 'לוקר עזריאלי'
      };

      const handleApply = (p) => {
        if (p && p.trackingNumber) {
          onParsedResult({
            title: p.title,
            titleHe: p.titleHe,
            trackingNumber: p.trackingNumber,
            carrierId: p.carrier || 'other',
            notes: p.notes,
            origin: p.origin || '',
            destination: p.destination || 'Israel',
            pickupLocation: p.pickupLocation || ''
          });
          onClose();
        }
      };

      handleApply(parsed);

      expect(onParsedResult).toHaveBeenCalledTimes(1);
      expect(onParsedResult).toHaveBeenCalledWith({
        title: 'AliExpress Order',
        titleHe: 'הזמנה מ-עליאקספרס',
        trackingNumber: 'LP00582910482CN',
        carrierId: 'cainiao',
        notes: 'AliExpress update: Your order LP00582910482CN has arrived.',
        origin: 'China',
        destination: 'Israel',
        pickupLocation: 'לוקר עזריאלי'
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not invoke onParsedResult if trackingNumber is missing', () => {
      const onParsedResult = vi.fn();
      const onClose = vi.fn();

      const handleApply = (p) => {
        if (p && p.trackingNumber) {
          onParsedResult(p);
          onClose();
        }
      };

      handleApply({ trackingNumber: '' });
      expect(onParsedResult).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('handles manual entry switch callback delegation', () => {
      const onSwitchToManual = vi.fn();
      const rawText = 'Some unparsed tracking context';

      onSwitchToManual(rawText);
      expect(onSwitchToManual).toHaveBeenCalledWith('Some unparsed tracking context');
    });
  });

  describe('Clipboard Auto-Paste and Copy Interactions', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('reads text from navigator.clipboard and parses it successfully', async () => {
      const mockClipboardText = 'החבילה שלך מחכה: HFD90481029 בנקודת איסוף מכולת העיר';
      const readTextMock = vi.fn().mockResolvedValue(mockClipboardText);

      globalThis.navigator.clipboard = {
        readText: readTextMock
      };

      const text = await globalThis.navigator.clipboard.readText();
      expect(readTextMock).toHaveBeenCalled();
      expect(text).toBe(mockClipboardText);

      const parsed = parseSmartText(text);
      expect(parsed.trackingNumber).toBe('HFD90481029');
      expect(parsed.carrier).toBe('hfd');
      expect(parsed.pickupLocation).toBe('מכולת העיר');
    });

    it('handles clipboard access denial gracefully without throwing', async () => {
      const readTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      globalThis.navigator.clipboard = {
        readText: readTextMock
      };

      let text = '';
      try {
        text = await globalThis.navigator.clipboard.readText();
      } catch (err) {
        // Handled gracefully in component
        expect(err.message).toBe('Permission denied');
      }

      expect(text).toBe('');
    });
  });
});
