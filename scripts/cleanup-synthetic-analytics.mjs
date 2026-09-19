#!/usr/bin/env node
/**
 * Utility to identify and safely purge synthetic test documents that leaked into
 * Firestore analytics collections (featureUsage, smartImportAttempts, featureAdoptionStats)
 * during automated test runs prior to test-mode environment isolation.
 *
 * Usage:
 *   node scripts/cleanup-synthetic-analytics.mjs --dry-run
 *   node scripts/cleanup-synthetic-analytics.mjs --execute
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const isDryRun = !process.argv.includes('--execute');

function initAdmin() {
  if (getApps().length) return;
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCreds) {
    // If running in an environment with Google Application Default Credentials
    try {
      initializeApp({ projectId: 'deliveree-app-2a938' });
      return;
    } catch (err) {
      console.error('Error: Set FIREBASE_SERVICE_ACCOUNT_JSON or configure Google ADC.');
      process.exit(1);
    }
  }

  try {
    const creds = JSON.parse(rawCreds);
    initializeApp({ credential: cert(creds), projectId: creds.project_id || 'deliveree-app-2a938' });
  } catch (err) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    process.exit(1);
  }
}

async function run() {
  initAdmin();
  const db = getFirestore();

  console.log(`[cleanup-synthetic-analytics] Mode: ${isDryRun ? 'DRY-RUN (no deletions)' : 'EXECUTE (deleting synthetic documents)'}`);

  // 1. Identify synthetic smartImportAttempts
  // Test attempts used known synthetic patterns: userId containing 'test', 'anon',
  // or trackingNumber matching test fixtures (e.g. RR000000005IL, 1Z999AA10123456784, etc.)
  const smartImportSnap = await db.collection('smartImportAttempts').get();
  let syntheticAttempts = [];

  for (const doc of smartImportSnap.docs) {
    const data = doc.data();
    const uid = data.userId || '';
    const tracking = data.trackingNumber || '';
    const isSynthetic = (
      uid.includes('test') ||
      uid.includes('mock') ||
      uid.startsWith('section-') ||
      uid.startsWith('archive-') ||
      uid.startsWith('user-') ||
      tracking === 'RR000000005IL' ||
      tracking === '1Z999AA10123456784' ||
      tracking === 'ZZ999888777IL' ||
      tracking.startsWith('TEST')
    );

    if (isSynthetic) {
      syntheticAttempts.push(doc.ref);
    }
  }

  console.log(`smartImportAttempts: Found ${syntheticAttempts.length} synthetic docs out of ${smartImportSnap.size} total.`);

  // 2. Identify synthetic featureUsage documents
  const featureUsageSnap = await db.collection('featureUsage').get();
  let syntheticFeatureUsage = [];

  for (const doc of featureUsageSnap.docs) {
    const data = doc.data();
    const uid = data.userId || '';
    const isSynthetic = (
      uid.includes('test') ||
      uid.includes('mock') ||
      uid.startsWith('section-') ||
      uid.startsWith('archive-') ||
      uid.startsWith('user-')
    );

    if (isSynthetic) {
      syntheticFeatureUsage.push(doc.ref);
    }
  }

  console.log(`featureUsage: Found ${syntheticFeatureUsage.length} synthetic docs out of ${featureUsageSnap.size} total.`);

  if (isDryRun) {
    console.log('\n[Dry run complete] Pass --execute to delete the identified documents.');
    return;
  }

  // Execute batch deletions (max 500 per batch)
  const toDelete = [...syntheticAttempts, ...syntheticFeatureUsage];
  console.log(`\nDeleting ${toDelete.length} synthetic documents...`);

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const ref of toDelete) {
    batch.delete(ref);
    count++;
    batchCount++;
    if (batchCount >= 450) {
      await batch.commit();
      console.log(`  Committed batch: ${count} / ${toDelete.length}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch: ${count} / ${toDelete.length}`);
  }

  console.log('[Cleanup Complete] Successfully purged synthetic test documents.');
}

run().catch((err) => {
  console.error('[cleanup-synthetic-analytics] Failed:', err);
  process.exit(1);
});
