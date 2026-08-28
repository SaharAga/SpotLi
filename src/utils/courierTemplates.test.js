/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TEMPLATE_TYPES,
  generateCourierMessage,
  interpolateCourierMessage,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  STORAGE_KEY_CUSTOM_TEMPLATES,
  buildWhatsAppUrl,
  buildSmsUrl
} from './courierTemplates';

describe('courierTemplates', () => {
  const sampleData = {
    trackingNumber: 'RR123456789IL',
    carrierName: 'Israel Post',
    pickupCode: '98765',
    pickupLocation: 'Super-Pharm Dizengoff',
    gateCode: '1423#',
    notes: 'In the electricity cupboard',
    title: 'Running Shoes'
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('generateCourierMessage (Hebrew)', () => {
    it('generates porch drop message in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PORCH_DROP, sampleData, 'he');
      expect(msg).toContain('דלת הכניסה');
      expect(msg).toContain('RR123456789IL');
    });

    it('generates gate code message with provided code in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.GATE_CODE, sampleData, 'he');
      expect(msg).toContain('1423#');
      expect(msg).toContain('קוד הכניסה');
    });

    it('generates safe place message in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.SAFE_PLACE, sampleData, 'he');
      expect(msg).toContain('אינני בבית');
      expect(msg).toContain('In the electricity cupboard');
    });

    it('generates proxy pickup message with code and location in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PROXY_PICKUP, sampleData, 'he');
      expect(msg).toContain('ייפוי כוח');
      expect(msg).toContain('98765');
      expect(msg).toContain('Super-Pharm Dizengoff');
      expect(msg).toContain('Running Shoes');
    });

    it('generates call before arrival message', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.CALL_BEFORE, sampleData, 'he');
      expect(msg).toContain('קשר טלפוני');
    });
  });

  describe('custom templates and variable interpolation', () => {
    it('saves and retrieves custom templates in localStorage', () => {
      const saved = saveCustomTemplate({
        id: 'cust_balcony',
        label: 'השאר במרפסת',
        templateText: 'שלום, נא להשאיר במרפסת. קוד: {gateCode}'
      });
      expect(saved.length).toBe(1);
      expect(getCustomTemplates().length).toBe(1);

      const msg = generateCourierMessage('cust_balcony', sampleData, 'he', saved);
      expect(msg).toBe('שלום, נא להשאיר במרפסת. קוד: 1423#');
    });

    it('deletes custom templates', () => {
      saveCustomTemplate({ id: 'c1', label: 'T1', templateText: 'Msg 1' });
      saveCustomTemplate({ id: 'c2', label: 'T2', templateText: 'Msg 2' });
      expect(getCustomTemplates().length).toBe(2);

      const remaining = deleteCustomTemplate('c1');
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('c2');
    });

    it('interpolates all dynamic placeholders correctly', () => {
      const template = 'Pkg: {trackingNumber}, PIN: {pickupCode}, Loc: {pickupLocation}';
      const res = interpolateCourierMessage(template, sampleData, 'he');
      expect(res).toBe('Pkg: RR123456789IL, PIN: 98765, Loc: Super-Pharm Dizengoff');
    });
  });

  describe('generateCourierMessage (English)', () => {
    it('generates porch drop message in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PORCH_DROP, sampleData, 'en');
      expect(msg).toContain('front door');
      expect(msg).toContain('RR123456789IL');
    });

    it('generates gate code message with provided code in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.GATE_CODE, sampleData, 'en');
      expect(msg).toContain('1423#');
      expect(msg).toContain('gate/entrance code');
    });

    it('generates proxy pickup message in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PROXY_PICKUP, sampleData, 'en');
      expect(msg).toContain('authorization to pick up package');
      expect(msg).toContain('98765');
      expect(msg).toContain('Super-Pharm Dizengoff');
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('builds a general WhatsApp sharing URL without phone', () => {
      const url = buildWhatsAppUrl({ text: 'Hello Courier' });
      expect(url).toBe('https://wa.me/?text=Hello%20Courier');
    });

    it('builds a direct WhatsApp chat URL with sanitized phone', () => {
      const url = buildWhatsAppUrl({ phone: '+972-50-1234567', text: 'Hello' });
      expect(url).toBe('https://wa.me/972501234567?text=Hello');
    });
  });

  describe('buildSmsUrl', () => {
    it('builds a general SMS URI without phone', () => {
      const url = buildSmsUrl({ text: 'Hello Courier' });
      expect(url).toBe('sms:?body=Hello%20Courier');
    });

    it('builds a targeted SMS URI with recipient phone', () => {
      const url = buildSmsUrl({ phone: '0501234567', text: 'Hello' });
      expect(url).toBe('sms:0501234567?body=Hello');
    });
  });
});

describe('courierTemplates', () => {
  const sampleData = {
    trackingNumber: 'RR123456789IL',
    carrierName: 'Israel Post',
    pickupCode: '98765',
    pickupLocation: 'Super-Pharm Dizengoff',
    gateCode: '1423#',
    notes: 'In the electricity cupboard',
    title: 'Running Shoes'
  };

  describe('generateCourierMessage (Hebrew)', () => {
    it('generates porch drop message in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PORCH_DROP, sampleData, 'he');
      expect(msg).toContain('דלת הכניסה');
      expect(msg).toContain('RR123456789IL');
    });

    it('generates gate code message with provided code in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.GATE_CODE, sampleData, 'he');
      expect(msg).toContain('1423#');
      expect(msg).toContain('קוד הכניסה');
    });

    it('generates safe place message in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.SAFE_PLACE, sampleData, 'he');
      expect(msg).toContain('אינני בבית');
      expect(msg).toContain('In the electricity cupboard');
    });

    it('generates proxy pickup message with code and location in Hebrew', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PROXY_PICKUP, sampleData, 'he');
      expect(msg).toContain('ייפוי כוח');
      expect(msg).toContain('98765');
      expect(msg).toContain('Super-Pharm Dizengoff');
      expect(msg).toContain('Running Shoes');
    });
  });

  describe('generateCourierMessage (English)', () => {
    it('generates porch drop message in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PORCH_DROP, sampleData, 'en');
      expect(msg).toContain('front door');
      expect(msg).toContain('RR123456789IL');
    });

    it('generates gate code message with provided code in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.GATE_CODE, sampleData, 'en');
      expect(msg).toContain('1423#');
      expect(msg).toContain('gate/entrance code');
    });

    it('generates proxy pickup message in English', () => {
      const msg = generateCourierMessage(TEMPLATE_TYPES.PROXY_PICKUP, sampleData, 'en');
      expect(msg).toContain('authorization to pick up package');
      expect(msg).toContain('98765');
      expect(msg).toContain('Super-Pharm Dizengoff');
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('builds a general WhatsApp sharing URL without phone', () => {
      const url = buildWhatsAppUrl({ text: 'Hello Courier' });
      expect(url).toBe('https://wa.me/?text=Hello%20Courier');
    });

    it('builds a direct WhatsApp chat URL with sanitized phone', () => {
      const url = buildWhatsAppUrl({ phone: '+972-50-1234567', text: 'Hello' });
      expect(url).toBe('https://wa.me/972501234567?text=Hello');
    });
  });

  describe('buildSmsUrl', () => {
    it('builds a general SMS URI without phone', () => {
      const url = buildSmsUrl({ text: 'Hello Courier' });
      expect(url).toBe('sms:?body=Hello%20Courier');
    });

    it('builds a targeted SMS URI with recipient phone', () => {
      const url = buildSmsUrl({ phone: '0501234567', text: 'Hello' });
      expect(url).toBe('sms:0501234567?body=Hello');
    });
  });
});
