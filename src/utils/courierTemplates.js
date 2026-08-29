/**
 * Courier Quick Action Templates & Deep Link Utilities
 * Facilitates 1-click WhatsApp, SMS, and clipboard responses to delivery drivers.
 * Supports built-in preset library + user-defined custom responses with dynamic placeholders.
 */

/**
 * Built-in template types
 */
export const TEMPLATE_TYPES = {
  PORCH_DROP: 'porch_drop',
  GATE_CODE: 'gate_code',
  SAFE_PLACE: 'safe_place',
  PROXY_PICKUP: 'proxy_pickup',
  CALL_BEFORE: 'call_before',
  LOBBY_DESK: 'lobby_desk',
  AFTER_HOURS: 'after_hours'
};

/**
 * Built-in Presets with bilingual labels, templates, and icons
 */
export const BUILTIN_PRESETS = [
  {
    id: TEMPLATE_TYPES.PORCH_DROP,
    labelHe: 'השאר ליד הדלת',
    labelEn: 'Leave at Doorstep',
    icon: 'DoorOpen',
    templateHe: 'שלום, לגבי המשלוח{tracking}: אפשר בבקשה להשאיר ליד דלת הכניסה / ארון חשמל. תודה רבה!',
    templateEn: 'Hello, regarding delivery{tracking}: Please leave the package by the front door / porch. Thank you!'
  },
  {
    id: TEMPLATE_TYPES.GATE_CODE,
    labelHe: 'קוד כניסה / שער',
    labelEn: 'Gate / Door Code',
    icon: 'Key',
    templateHe: 'שלום, לגבי המשלוח{tracking}: קוד הכניסה לבניין / שער הוא: {gateCode}. אפשר להשאיר ליד הדלת. תודה!',
    templateEn: 'Hello, regarding delivery{tracking}: The gate/entrance code is: {gateCode}. Please leave by the door. Thank you!'
  },
  {
    id: TEMPLATE_TYPES.SAFE_PLACE,
    labelHe: 'מקום בטוח / שכן',
    labelEn: 'Safe Place / Neighbor',
    icon: 'ShieldCheck',
    templateHe: 'שלום, לגבי המשלוח{tracking}: אינני בבית, אשמח אם תוכל להשאיר {notesOrSafePlace}. תודה!',
    templateEn: 'Hello, regarding delivery{tracking}: I am not home, please leave the package {notesOrSafePlace}. Thank you!'
  },
  {
    id: TEMPLATE_TYPES.PROXY_PICKUP,
    labelHe: 'ייפוי כוח לאיסוף',
    labelEn: 'Proxy Authorization',
    icon: 'UserCheck',
    templateHe: 'שלום, ייפוי כוח לאיסוף חבילה{titleRef}:\n📦 מספר מעקב: {trackingNumber}{pickupPinLine}{pickupLocationLine}\nמאשר/ת את איסוף החבילה עבורי.',
    templateEn: 'Hello, authorization to pick up package{titleRef}:\n📦 Tracking #: {trackingNumber}{pickupPinLine}{pickupLocationLine}\nI authorize the pickup of this package on my behalf.'
  },
  {
    id: TEMPLATE_TYPES.CALL_BEFORE,
    labelHe: 'התקשר לפני הגעה',
    labelEn: 'Call Before Arrival',
    icon: 'PhoneCall',
    templateHe: 'שלום, לגבי המשלוח{tracking}: אשמח שתיצור איתי קשר טלפוני 5 דקות לפני הגעתך. תודה רבה!',
    templateEn: 'Hello, regarding delivery{tracking}: Please call me 5 minutes before arriving. Thank you!'
  },
  {
    id: TEMPLATE_TYPES.LOBBY_DESK,
    labelHe: 'השאר בלובי / קבלה',
    labelEn: 'Leave at Lobby',
    icon: 'Building',
    templateHe: 'שלום, לגבי המשלוח{tracking}: אפשר בבקשה להשאיר את החבילה בלובי הבניין / בעמדת הקבלה. תודה!',
    templateEn: 'Hello, regarding delivery{tracking}: Please leave the package at the building lobby / reception desk. Thank you!'
  },
  {
    id: TEMPLATE_TYPES.AFTER_HOURS,
    labelHe: 'מסירה אחה״צ / ערב',
    labelEn: 'Deliver After Hours',
    icon: 'Clock',
    templateHe: 'שלום, לגבי המשלוח{tracking}: אהיה בבית החל מהשעה 17:00, אשמח אם ניתן לתאם מסירה לאחר שעה זו. תודה!',
    templateEn: 'Hello, regarding delivery{tracking}: I will be home starting at 17:00, please deliver after that time if possible. Thank you!'
  }
];

export const STORAGE_KEY_CUSTOM_TEMPLATES = 'deliveree_custom_courier_templates';
export const STORAGE_KEY_HIDDEN_PRESETS = 'deliveree_hidden_courier_presets';

/**
 * Loads user custom templates from localStorage.
 * @returns {Array<object>}
 */
export function getCustomTemplates() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CUSTOM_TEMPLATES) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Loads list of hidden built-in preset IDs.
 * @returns {Array<string>}
 */
export function getHiddenPresetIds() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_HIDDEN_PRESETS) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Hides a built-in preset so the user does not see it.
 * @param {string} id
 * @returns {Array<string>}
 */
export function hidePreset(id) {
  try {
    const existing = getHiddenPresetIds();
    if (!existing.includes(id)) {
      const updated = [...existing, id];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_HIDDEN_PRESETS, JSON.stringify(updated));
      }
      return updated;
    }
    return existing;
  } catch (err) {
    console.error('Failed to hide preset:', err);
    return getHiddenPresetIds();
  }
}

/**
 * Resets hidden presets so all default presets return.
 */
export function resetAllPresets() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_HIDDEN_PRESETS);
    }
  } catch (err) {
    console.error('Failed to reset presets:', err);
  }
}

/**
 * Saves or updates a custom template in localStorage.
 * @param {object} template - { id?: string, label: string, templateText: string, icon?: string }
 * @returns {Array<object>}
 */
export function saveCustomTemplate(template) {
  try {
    const existing = getCustomTemplates();
    const cleanId = template.id || `custom_${Date.now()}`;
    const newEntry = {
      ...template,
      id: cleanId,
      isCustom: true,
      updatedAt: new Date().toISOString()
    };
    const index = existing.findIndex((t) => t.id === cleanId);
    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = newEntry;
    } else {
      updated = [...existing, newEntry];
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.error('Failed to save custom template:', err);
    return getCustomTemplates();
  }
}

/**
 * Deletes a custom template or hides a built-in preset.
 * @param {string} id
 * @returns {void}
 */
export function deleteTemplate(id) {
  const isBuiltIn = BUILTIN_PRESETS.some((p) => p.id === id);
  if (isBuiltIn) {
    hidePreset(id);
  } else {
    deleteCustomTemplate(id);
  }
}

/**
 * Deletes a custom template from localStorage.
 * @param {string} id
 * @returns {Array<object>}
 */
export function deleteCustomTemplate(id) {
  try {
    const existing = getCustomTemplates();
    const updated = existing.filter((t) => t.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.error('Failed to delete custom template:', err);
    return getCustomTemplates();
  }
}

/**
 * Interpolates variables into a template string.
 *
 * @param {string} templateString
 * @param {object} data
 * @param {'he' | 'en'} language
 * @returns {string}
 */
export function interpolateCourierMessage(templateString = '', data = {}, language = 'he') {
  const {
    trackingNumber = '',
    carrierName = '',
    pickupCode = '',
    pickupLocation = '',
    gateCode = '',
    notes = '',
    title = ''
  } = data;

  const tracking = trackingNumber ? ` (${trackingNumber})` : '';
  const titleRef = title ? (language === 'he' ? ` עבור "${title}"` : ` for "${title}"`) : '';
  const pickupPinLine = pickupCode ? (language === 'he' ? `\n🔑 קוד איסוף: ${pickupCode}` : `\n🔑 Pickup PIN: ${pickupCode}`) : '';
  const pickupLocationLine = pickupLocation ? (language === 'he' ? `\n📍 מיקום: ${pickupLocation}` : `\n📍 Location: ${pickupLocation}`) : '';
  const gateCodeStr = gateCode || (language === 'he' ? '[קוד שער]' : '[Gate Code]');
  const notesOrSafePlace = notes ? (language === 'he' ? `במקום: ${notes}` : `at: ${notes}`) : (language === 'he' ? 'אצל השכנים / בארון חשמל' : 'with a neighbor or in a safe place');

  return templateString
    .replace(/\{tracking\}/g, tracking)
    .replace(/\{trackingNumber\}/g, trackingNumber || (language === 'he' ? 'לפי הודעה' : 'As notified'))
    .replace(/\{gateCode\}/g, gateCodeStr)
    .replace(/\{pickupCode\}/g, pickupCode || '')
    .replace(/\{pickupLocation\}/g, pickupLocation || '')
    .replace(/\{title\}/g, title || '')
    .replace(/\{titleRef\}/g, titleRef)
    .replace(/\{pickupPinLine\}/g, pickupPinLine)
    .replace(/\{pickupLocationLine\}/g, pickupLocationLine)
    .replace(/\{notesOrSafePlace\}/g, notesOrSafePlace)
    .replace(/\{carrier\}/g, carrierName || '');
}

/**
 * Generate a pre-filled delivery message for couriers (built-in or custom).
 *
 * @param {string} type - Template ID
 * @param {Object} data - Context data: { trackingNumber, carrierName, pickupCode, pickupLocation, gateCode, notes, title }
 * @param {'he' | 'en'} language - Target language
 * @param {Array<object>} [customTemplates=[]]
 * @returns {string} Formatted text message
 */
export function generateCourierMessage(type, data = {}, language = 'he', customTemplates = []) {
  // 1. Check custom templates first
  const custom = customTemplates.find((t) => t.id === type);
  if (custom) {
    const rawTemplate = custom.templateText || (language === 'he' ? custom.templateHe : custom.templateEn) || '';
    return interpolateCourierMessage(rawTemplate, data, language);
  }

  // 2. Check built-in presets
  const preset = BUILTIN_PRESETS.find((p) => p.id === type);
  if (preset) {
    const rawTemplate = language === 'he' ? preset.templateHe : preset.templateEn;
    return interpolateCourierMessage(rawTemplate, data, language);
  }

  // 3. Fallback
  const pkgRef = data.trackingNumber ? ` (${data.trackingNumber})` : '';
  return language === 'he'
    ? `שלום, לגבי המשלוח${pkgRef}: תודה רבה!`
    : `Hello, regarding delivery${pkgRef}: Thank you!`;
}

/**
 * Build a WhatsApp deep link URL.
 *
 * @param {Object} params - { phone?: string, text: string }
 * @returns {string} WhatsApp URL
 */
export function buildWhatsAppUrl({ phone = '', text = '' } = {}) {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
    return `https://wa.me/${formattedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Build an SMS deep link URL.
 *
 * @param {Object} params - { phone?: string, text: string }
 * @returns {string} SMS URI
 */
export function buildSmsUrl({ phone = '', text = '' } = {}) {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `sms:${cleanPhone}?body=${encodedText}`;
  }
  return `sms:?body=${encodedText}`;
}
