import { onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createParseWithAiHandler } from './handler.js';
import { createInboundEmailHandler } from './inboundEmailHandler.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Structured extraction of package tracking details, either as a fallback
 * when the client-side regex parser (parseSmartText) finds nothing in
 * pasted text, or for a screenshot the client can't read at all. See
 * README.md "AI-assisted import" for the full design and cost guards.
 *
 * enforceAppCheck rejects requests that don't come from the real app build;
 * requiring sign-in (checked inside the handler) rules out anonymous
 * scripted abuse. Both are cheap, high-leverage guards against runaway
 * cost — see also the per-user/global daily caps in guards.js.
 */
export const parseWithAi = onCall(
  {
    enforceAppCheck: true,
    secrets: [geminiApiKey],
    // Structured extraction on a single message or image is fast; this
    // leaves headroom without letting a stuck call run indefinitely.
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  (request) =>
    createParseWithAiHandler({
      db: getFirestore(),
      apiKey: geminiApiKey.value()
    })(request)
);

/**
 * Inbound Email Webhook.
 *
 * Ingests forwarded shipping emails from SendGrid Inbound Parse, Mailgun,
 * Postmark, or standard email webhooks sent to *@in.deliveree.app.
 */
export const inboundEmailWebhook = onRequest(
  {
    cors: false,
    timeoutSeconds: 30,
    memory: '256MiB'
  },
  createInboundEmailHandler({
    db: getFirestore()
  })
);

