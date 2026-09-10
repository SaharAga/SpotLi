/**
 * SpotLi URL Unshortener & Short Link Intelligence Service
 * 
 * Safely identifies shortened courier URLs (chtr.co.il, slnk.to, is.gd, bit.ly, etc.)
 * and extracts carrier metadata, tracking identifiers, or resolves target URLs defensively.
 */

import {
  SHORT_DOMAINS,
  CARRIER_SHORT_DOMAINS,
  isShortenedUrl,
  extractCarrierFromShortUrl,
  extractIdentifierFromShortUrl
} from '../utils/smartParser.js';

export {
  SHORT_DOMAINS,
  CARRIER_SHORT_DOMAINS,
  isShortenedUrl,
  extractCarrierFromShortUrl,
  extractIdentifierFromShortUrl
};

/**
 * Resolves a shortened URL safely with timeout, returning carrier hints and extracted IDs.
 * Handles client-side CORS and network failures gracefully without throwing.
 * 
 * @param {string} urlString 
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ resolvedUrl: string, carrierId: string|null, trackingNumber: string|null }>}
 */
export async function resolveShortUrl(urlString, options = {}) {
  const result = {
    resolvedUrl: urlString,
    carrierId: extractCarrierFromShortUrl(urlString),
    trackingNumber: extractIdentifierFromShortUrl(urlString)
  };

  if (!urlString || typeof urlString !== 'string' || !isShortenedUrl(urlString)) {
    return result;
  }

  const { timeoutMs = 3000 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const raw = urlString.trim();
    const targetUrl = raw.startsWith('http') ? raw : `https://${raw}`;

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response && response.url) {
      result.resolvedUrl = response.url;
      const resolvedCarrier = extractCarrierFromShortUrl(response.url);
      const resolvedId = extractIdentifierFromShortUrl(response.url);
      if (resolvedCarrier) result.carrierId = resolvedCarrier;
      if (resolvedId) result.trackingNumber = resolvedId;
    }
  } catch {
    // Graceful fallback on network error or CORS block
    clearTimeout(timeoutId);
  }

  return result;
}
