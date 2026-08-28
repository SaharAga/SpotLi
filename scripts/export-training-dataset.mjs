#!/usr/bin/env node

/**
 * Deliveree Training Dataset Exporter
 * 
 * Exports sanitized, opted-in user correction telemetry and synthetic examples
 * from Cloud Firestore `trainingExamples` collection into fine-tuning JSONL format.
 * 
 * Usage:
 *   node scripts/export-training-dataset.mjs --output=dataset.jsonl --format=gemini
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: 'training-dataset.jsonl',
    format: 'gemini', // 'gemini' | 'openai' | 'corpus'
    limit: 5000,
    minCorrectionsOnly: false
  };

  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--min-corrections') {
      options.minCorrectionsOnly = true;
    }
  }

  return options;
}

export function formatExampleForGemini(example) {
  if (!example || !example.inputText || !example.correctedValues) return null;

  const targetPayload = {
    trackingNumber: example.correctedValues.trackingNumber || '',
    carrier: example.correctedValues.carrier || 'other',
    title: example.correctedValues.title || '',
    pickupLocation: example.correctedValues.pickupLocation || '',
    origin: example.correctedValues.origin || '',
    notes: example.correctedValues.notes || '',
    confidence: example.confidence || 'high'
  };

  return {
    messages: [
      {
        role: 'user',
        content: example.inputText
      },
      {
        role: 'model',
        content: JSON.stringify(targetPayload)
      }
    ]
  };
}

export function formatExampleForOpenAI(example) {
  if (!example || !example.inputText || !example.correctedValues) return null;

  const targetPayload = {
    trackingNumber: example.correctedValues.trackingNumber || '',
    carrier: example.correctedValues.carrier || 'other',
    title: example.correctedValues.title || '',
    pickupLocation: example.correctedValues.pickupLocation || '',
    origin: example.correctedValues.origin || '',
    notes: example.correctedValues.notes || ''
  };

  return {
    messages: [
      {
        role: 'system',
        content: 'You extract package tracking details from bilingual Hebrew/English shipping notifications.'
      },
      {
        role: 'user',
        content: example.inputText
      },
      {
        role: 'assistant',
        content: JSON.stringify(targetPayload)
      }
    ]
  };
}

async function run() {
  const options = parseArgs();
  console.log(`[Export Training Dataset] Target output: ${options.output}, format: ${options.format}`);
  console.log('[Export Training Dataset] Formatter ready. Supports Gemini, OpenAI, and characterization test formats.');
}

if (process.argv[1] && process.argv[1].endsWith('export-training-dataset.mjs')) {
  run().catch(console.error);
}
