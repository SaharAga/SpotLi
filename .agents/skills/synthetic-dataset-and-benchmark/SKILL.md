---
name: synthetic-dataset-and-benchmark
description: Procedural synthetic data generation and regression benchmark testbench for Israeli courier SMS, tracking URLs, and mixed OTP/tracking messages. Use when adding or updating synthetic training data, calibrating candidate extraction precision and recall, or validating parser thresholds against adversarial and edge-case templates.
inputs:
  - scripts/generate-synthetic-training-data.mjs
  - src/types/carriers.js and src/types/carrierSpecs.generated.json
  - src/utils/parserSyntheticBenchmark.test.js
outputs:
  - High-volume procedural synthetic delivery notifications and negative controls
  - Benchmark performance metrics (Precision >= 98%, Recall >= 98%, FP = 0%)
  - Detection threshold calibration recommendations
---

# Synthetic Dataset & Benchmark Skill

This skill governs procedural generation of synthetic Israeli and international shipping notifications and the execution of high-rigor regression benchmark suites for SpotLi's tracking detection engine.

---

## 1. Purpose & Mental Model

Real SMS messages contain personally identifiable information (PII) such as personal phone numbers, buyer names, home addresses, and private door codes. Synthetic data generation allows us to test thousands of variations, permutations, edge cases, and adversarial counter-examples without privacy risks.

```
[Carrier Specs / Templates]
          │
          ▼
[generate-synthetic-training-data.mjs] ──► [Synthetic Corpus / Scenarios]
                                                      │
                                                      ▼
                                       [parserSyntheticBenchmark.test.js]
                                                      │
                                                      ▼
                                        [Precision, Recall, Invariant Gates]
```

The synthetic generator and benchmark suite serve two primary needs:
1. **Regression Prevention**: Proving that enhancements to one courier's regex or label detection do not inadvertently corrupt detection of other couriers.
2. **Adversarial Hardening**: Exposing the candidate ranking engine to tricky mixed formats: messages with 4-to-6 digit locker PINs, driver phone numbers, order confirmation numbers, and unrelated OTP/2FA security codes.

---

## 2. Tooling & CLI Reference

### Generating Synthetic Data

```bash
# Generate 100 procedural examples to stdout or file
node scripts/generate-synthetic-training-data.mjs --count 100 --output data/synthetic-sample.json

# Seeded generation for deterministic reproducibility
node scripts/generate-synthetic-training-data.mjs --count 50 --seed 42

# Filter by scenario type: positive, pin, mixed, negative
node scripts/generate-synthetic-training-data.mjs --scenarios positive,pin
```

### Running the Synthetic Benchmark

```bash
# Run the 72-case synthetic regression testbench
npm run benchmark:parser

# Or run via Vitest directly
npx vitest run src/utils/parserSyntheticBenchmark.test.js
```

---

## 3. Scenarios & Invariant Rules

The generator creates 4 core categories of procedural messages:

1. **Scenario 1: Standard Delivery & Transit Alerts (`positive`)**
   - Official courier name in Hebrew / English / transliteration.
   - Clean tracking number conforming to the carrier's canonical schema.
   - Associated courier domains or short links where applicable.
   - *Invariant*: Must extract correct `carrier` and valid `trackingNumber`.

2. **Scenario 2: Pickup Locker & Collection Point with PIN (`pin`)**
   - Contains a pickup point name, opening hours, and a 4–6 digit locker PIN code (e.g. `קוד איסוף: 4892`).
   - Contains a distinct tracking number.
   - *Invariant*: The 4–6 digit locker PIN must NEVER be selected as the `trackingNumber`. Grounded candidate scoring must disambiguate the pickup PIN from the shipment barcode.

3. **Scenario 3: Mixed Messages & Tracking URLs (`mixed`)**
   - Includes full tracking URLs (`https://mypost.israelpost.co.il/itemtrace?itemcode=...`) or short redirection domains (`https://gpkg.to/...`, `https://baldr.co.il/...`).
   - May combine item descriptions and courier names.
   - *Invariant*: Tracking URL extraction takes precedence or corroborates the raw tracking number candidate.

4. **Scenario 4: Negative Controls & Non-Delivery Messages (`negative`)**
   - Banking transaction alerts, credit card 2FA codes, password reset verification links.
   - Marketing spam, discount codes, receipts without package tracking.
   - *Invariant*: Must return `trackingNumber: null` or `candidates: []`. Precision on negative controls must remain strictly 100% (0% false-positive rate).

---

## 4. Quality Gates & Acceptance Thresholds

Before any carrier detection update or parser change is approved:
- **Precision**: $\ge 98.0\%$ across all positive scenarios.
- **Recall**: $\ge 98.0\%$ across all positive scenarios.
- **False Positive Rate**: $0.0\%$ on negative controls (bank OTPs, general SMS).
- **Execution Speed**: The entire 72-case benchmark suite must run in under 2 seconds.
- **Spec Parity**: Synthetic generator carrier definitions must stay synchronized with `src/types/carrierSpecs.generated.json`.
