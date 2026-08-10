# AI Arman Product Intelligence Contract v1

Status: foundation contract
Updated: 2026-08-10

## Purpose

This contract connects AI Arman in Harmoniq Customer Core to the future runtime delivered by `harmoniq-product-data-pipeline`.

The Product Intelligence runtime is not deployed or activated. Customer Core must therefore fail closed until a real service implements this exact contract and its private invocation has been separately authorized and configured.

## Endpoint expected from Product Intelligence

```http
POST /v1/ai-arman/product-intelligence/evaluate-batch
Content-Type: application/json
```

## Customer Core connection configuration

Environment variables:

```text
PRODUCT_INTELLIGENCE_BASE_URL=<safe HTTPS request origin>
PRODUCT_INTELLIGENCE_TIMEOUT_MS=1200
PRODUCT_INTELLIGENCE_AUTH_MODE=none|google_metadata_identity_token
PRODUCT_INTELLIGENCE_AUDIENCE=<canonical private Cloud Run service origin>
PRODUCT_INTELLIGENCE_AUTH_TIMEOUT_MS=800
```

Connection rules:

1. `PRODUCT_INTELLIGENCE_BASE_URL` must be a pure HTTPS origin.
2. Credentials in the URL, HTTP, path components, query strings and fragments are rejected.
3. Empty `PRODUCT_INTELLIGENCE_AUTH_MODE` and `none` mean that no Authorization header is generated. This is the default/off state and does not activate a private runtime.
4. `google_metadata_identity_token` requires a separate valid `PRODUCT_INTELLIGENCE_AUDIENCE`.
5. `PRODUCT_INTELLIGENCE_AUDIENCE` must also be a pure HTTPS origin.
6. Unknown auth modes and incomplete private-auth configuration fail closed before Product Intelligence is called.
7. Customer Core must not derive the canonical token audience from the request URL.

The request origin and the token audience are intentionally separate values. A future zero-traffic Cloud Run candidate can therefore be invoked through its tagged candidate URL while the Google identity token is minted for the canonical service URL.

Conceptual example only:

```text
PRODUCT_INTELLIGENCE_BASE_URL=https://candidate---service.example.test
PRODUCT_INTELLIGENCE_AUTH_MODE=google_metadata_identity_token
PRODUCT_INTELLIGENCE_AUDIENCE=https://service.example.test
```

In that case:

```text
POST -> https://candidate---service.example.test/v1/ai-arman/product-intelligence/evaluate-batch
ID-token audience -> https://service.example.test
```

The two origins may be different. They must never be silently collapsed into one configuration value.

## Private Cloud Run authentication

When `PRODUCT_INTELLIGENCE_AUTH_MODE=google_metadata_identity_token` is selected, Customer Core uses its runtime identity to request a Google-signed identity token from the Google metadata server and sends it as:

```http
Authorization: Bearer <identity token>
```

The metadata request uses the canonical `PRODUCT_INTELLIGENCE_AUDIENCE` and the required metadata header:

```http
Metadata-Flavor: Google
```

No service-account private key is stored in Customer Core for this flow.

The current code support for this auth mode is readiness work only. It does not grant `roles/run.invoker`, create or deploy Product Intelligence, change Cloud Run traffic, configure runtime environment variables or activate the provider. Those actions require separate explicit authorization.

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

The runtime response is validated structurally at the Customer Core integration boundary. Malformed or incomplete nested response structures must not leak into recommendation enrichment as trusted Product Intelligence data.

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

- connection and authentication policy;
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
- expose Product Intelligence directly to the browser;
- store service-account private keys for the Cloud Run identity-token flow;
- infer the canonical identity-token audience from a tagged candidate request URL;
- invent missing INCI;
- infer that a product is safe from tags alone;
- replace missing evidence with search popularity;
- silently accept a changed contract version;
- continue after invalid connection, auth or response-contract configuration.
