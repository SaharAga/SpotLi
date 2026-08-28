/**
 * Courier Quick Action Templates & Deep Link Utilities
 * Facilitates 1-click WhatsApp, SMS, and clipboard responses to delivery drivers.
 */

/**
 * Supported message template types
 */
export const TEMPLATE_TYPES = {
  PORCH_DROP: 'porch_drop',
  GATE_CODE: 'gate_code',
  SAFE_PLACE: 'safe_place',
  PROXY_PICKUP: 'proxy_pickup'
};

/**
 * Generate a pre-filled delivery message for couriers.
 *
 * @param {string} type - One of TEMPLATE_TYPES
 * @param {Object} data - Context data: { trackingNumber, carrierName, pickupCode, pickupLocation, gateCode, notes, title }
 * @param {'he' | 'en'} language - Target language
 * @returns {string} Formatted text message
 */
export function generateCourierMessage(type, data = {}, language = 'he') {
  const {
    trackingNumber = '',
    carrierName = '',
    pickupCode = '',
    pickupLocation = '',
    gateCode = '',
    notes = '',
    title = ''
  } = data;

  const pkgRef = trackingNumber ? ` (${trackingNumber})` : '';

  if (language === 'he') {
    switch (type) {
      case TEMPLATE_TYPES.PORCH_DROP:
        return `שלום, לגבי המשלוח${pkgRef}: אפשר בבקשה להשאיר ליד דלת הכניסה / ארון חשמל. תודה רבה!`;
      
      case TEMPLATE_TYPES.GATE_CODE: {
        const codeText = gateCode ? `הוא: ${gateCode}` : 'רשום בהערות למשלוח';
        return `שלום, לגבי המשלוח${pkgRef}: קוד הכניסה לבניין / שער ${codeText}. אפשר להשאיר ליד הדלת. תודה!`;
      }

      case TEMPLATE_TYPES.SAFE_PLACE: {
        const placeText = notes ? `במקום הבא: ${notes}` : 'אצל השכנים / בארון חשמל';
        return `שלום, לגבי המשלוח${pkgRef}: אינני בבית, אשמח אם תוכל להשאיר ${placeText}. תודה!`;
      }

      case TEMPLATE_TYPES.PROXY_PICKUP: {
        const codeInfo = pickupCode ? `\n🔑 קוד איסוף: ${pickupCode}` : '';
        const locInfo = pickupLocation ? `\n📍 מיקום איסוף: ${pickupLocation}` : '';
        const titleInfo = title ? ` עבור "${title}"` : '';
        return `שלום, ייפוי כוח לאיסוף חבילה${titleInfo}:\n📦 מספר מעקב: ${trackingNumber || 'לפי הודעה'}${codeInfo}${locInfo}\nמאשר/ת את איסוף החבילה עבורי.`;
      }

      default:
        return `שלום, לגבי המשלוח${pkgRef}: תודה רבה!`;
    }
  }

  // English fallback
  switch (type) {
    case TEMPLATE_TYPES.PORCH_DROP:
      return `Hello, regarding delivery${pkgRef}: Please leave the package by the front door / porch. Thank you!`;
    
    case TEMPLATE_TYPES.GATE_CODE: {
      const codeText = gateCode ? `is: ${gateCode}` : 'is provided in the delivery notes';
      return `Hello, regarding delivery${pkgRef}: The gate/entrance code ${codeText}. Please leave by the door. Thank you!`;
    }

    case TEMPLATE_TYPES.SAFE_PLACE: {
      const placeText = notes ? `at: ${notes}` : 'with a neighbor or in a safe place';
      return `Hello, regarding delivery${pkgRef}: I am not home, please leave the package ${placeText}. Thank you!`;
    }

    case TEMPLATE_TYPES.PROXY_PICKUP: {
      const codeInfo = pickupCode ? `\n🔑 Pickup PIN: ${pickupCode}` : '';
      const locInfo = pickupLocation ? `\n📍 Pickup Location: ${pickupLocation}` : '';
      const titleInfo = title ? ` for "${title}"` : '';
      return `Hello, authorization to pick up package${titleInfo}:\n📦 Tracking #: ${trackingNumber || 'As notified'}${codeInfo}${locInfo}\nI authorize the pickup of this package on my behalf.`;
    }

    default:
      return `Hello, regarding delivery${pkgRef}: Thank you!`;
  }
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
