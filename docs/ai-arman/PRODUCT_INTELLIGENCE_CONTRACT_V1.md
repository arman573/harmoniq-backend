# AI Arman Product Intelligence Contract v1

Status: foundation contract
Date: 2026-08-04

## Purpose

This contract connects AI Arman in Harmoniq Customer Core to the future runtime delivered by `harmoniq-product-data-pipeline`.

The product pipeline is currently in documentation/foundation phase. Customer Core must therefore fail closed until a real service implements this exact contract.

## Endpoint expected from Product Intelligence

```http
POST /v1/ai-arman/product-intelligence/evaluate-batch
Content-Type: application/json
```

Environment variables in Customer Core:

```text
PRODUCT_INTELLIGENCE_BASE_URL=<service base URL>
PRODUCT_INTELLIGENCE_TIMEOUT_MS=1200
```

## Request

```json
{
  "contractVersion": "ai-arman-product-intelligence-v1",
  "customerNeed": {
    "message": "Jag behöver ett schampo för färgat, torrt hår."
  },
  "products": [
    {
      "productId": "12345",
      "title": "Produktnamn",
      "url": "/produkt-12345.html"
    }
  ]
}
```

Maximum 25 products per batch.

## Required response fields

Each analysis must include:

- exact product ID;
- normalized designation and designation score;
- original, unmodified INCI text;
- INCI suitability score;
- ingredient signals and conflicts;
- INCI confidence;
- Ingredient Intelligence engine version;
- INCI analysis timestamp;
- category score, reasons and values;
- tag score, reasons and values;
- hard blockers;
- limitations;
- usage;
- special-fit signals;
- normalized evidence items.

## Unlock conditions

A product cannot become recommendation-ready unless all of these exist:

1. normalized designation;
2. original INCI;
3. Ingredient Intelligence engine version;
4. analysis timestamp;
5. positive confidence value;
6. at least one evidence item;
7. no business or safety blocker;
8. designation, INCI and total quality gates pass.

Missing data creates explicit blockers such as:

```text
missing_normalized_designation
missing_original_inci
missing_ingredient_engine_version
missing_ingredient_analysis_timestamp
missing_product_intelligence_evidence
missing_ingredient_confidence
```

## Ownership

Product Intelligence owns:

- normalized designation;
- preservation and parsing of original INCI;
- ingredient families, functions, risks and conflicts;
- category and tag evidence;
- confidence and engine version;
- product-level blockers and limitations.

Customer Core owns:

- final scoring weights;
- mandatory gates;
- ranking tiers;
- bounded Hello Retail personalization;
- recommendation eligibility;
- customer-facing explanation and audit trail.

## Safety

This integration is read-only. It must not:

- write product data;
- write to Vendre;
- invent missing INCI;
- infer that a product is safe from tags alone;
- replace missing evidence with search popularity;
- silently accept a changed contract version.
