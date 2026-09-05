---
name: real-sms-triage-and-eval
description: Interactive triage, anonymization, and held-out evaluation of real-world carrier SMS and delivery notifications. Use when ingesting new real-world courier messages, running scripts/review-carrier-messages.mjs, updating tests/fixtures/parserEvalCorpus.js, or executing the 77-case precision/recall evaluation testbench.
inputs:
  - scripts/review-carrier-messages.mjs
  - scripts/eval-parser-corpus.mjs
  - tests/fixtures/parserEvalCorpus.js
outputs:
  - Anonymized and normalized held-out test fixtures in tests/fixtures/parserEvalCorpus.js
  - Empirical precision, recall, and specificity evaluation metrics
  - Detection rule gap identification for unsupported courier formats
---

# Real SMS Triage & Evaluation Skill

This skill governs the ingestion, review, sanitization, and evaluation of real-world Israeli and global courier SMS text messages into the held-out evaluation corpus.

---

## 1. Purpose & Mental Model

Real SMS messages collected from users and alpha testers present real-world quirks that synthetic generators cannot always predict:
- Colloquial Hebrew phrasing, typos, and missing spaces (e.g. `חבילתכםמגיעה`).
- Phonetic transliterations of foreign carrier names (e.g. `די אייץ' אל` or `די אץ אל` for DHL, `צ'יטה` or `ציטה` for Cheetah).
- Inline driver feedback links (e.g. `octu.io` on Bar Group messages) that must not be confused with tracking links.
- Nested order identifiers, shelf codes, locker locker names, and PINs.

```
[Raw Real SMS Dumps]
          │
          ▼
[scripts/review-carrier-messages.mjs] (Interactive Triage & Redaction)
          │
          ▼
[tests/fixtures/parserEvalCorpus.js] (Held-out 77-case Corpus)
          │
          ▼
[scripts/eval-parser-corpus.mjs] (npm run eval:parser)
          │
          ▼
[100% Precision / 100% Recall / 100% Specificity]
```

---

## 2. Privacy & Redaction Invariants (MANDATORY)

When reviewing and incorporating real courier messages into the codebase or test fixtures:

1. **Zero PII Leakage**:
   - Strip all customer names (`שלום ישראל ישראלי` $\rightarrow$ `שלום לקוח`).
   - Strip personal recipient phone numbers (`050-1234567` $\rightarrow$ `050-0000000` or remove).
   - Strip specific home addresses, street names, and apartment numbers (`רחוב הרצל 42 דירה 5` $\rightarrow$ `מרכז מסחרי כלשהו`).
2. **Preserve Authentic Courier Patterns**:
   - Do NOT alter courier tracking numbers, barcode numbers, carrier branding, or tracking URLs/domains.
   - Do NOT sanitize out the authentic courier phrasing, greetings, or whitespace quirks.
3. **Handle Feedback / Non-Tracking Domains Carefully**:
   - Third-party short links that are NOT tracking links (e.g. `octu.io` driver rating link) must be tested to ensure the parser does not falsely classify them as couriers.

---

## 3. Tooling & CLI Reference

### Interactive Message Review Tool

```bash
# Launch interactive CLI review tool
npm run review:messages

# Or invoke directly with specific input file
node scripts/review-carrier-messages.mjs --source path/to/raw-messages.json
```

The review tool allows the reviewer to:
1. View the raw SMS content.
2. Inspect the parser's candidate extraction and confidence scores.
3. Compare against ground-truth expectations.
4. Anonymize personal details.
5. Save directly as a verified fixture in `tests/fixtures/parserEvalCorpus.js`.

### Running the Corpus Evaluation

```bash
# Run the evaluation testbench
npm run eval:parser

# Or run node script directly
node scripts/eval-parser-corpus.mjs
```

Expected output:
```text
Evaluation Summary:
  Total Cases: 77
  True Positives (TP): 65
  False Positives (FP): 0
  False Negatives (FN): 0
  True Negatives (TN): 12
  Precision: 100.0%
  Recall: 100.0%
  Specificity: 100.0%
```

---

## 4. Quality Gates & Non-Negotiables

1. **100% Corpus Pass Rate**: `npm run eval:parser` must always achieve 100.0% precision, 100.0% recall, and 100.0% specificity. Any drop below 100% is a regression blocking merge.
2. **Negative Specificity**: Bank SMS, authentication OTPs, promotional coupons, and food delivery notifications in the corpus must always resolve to `carrier: null` / `trackingNumber: null`.
3. **No Phantom Carriers**: If a message has no identifiable tracking code or official tracking link (e.g. general SMS with driver rating link), it must resolve to `carrier: 'other'` or `null`, never guess an arbitrary courier.
