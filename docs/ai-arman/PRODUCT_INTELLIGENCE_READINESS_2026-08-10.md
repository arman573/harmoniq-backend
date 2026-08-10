# AI Arman – Product Intelligence readiness checkpoint

Status: implementation readiness, no runtime activation
Date: 2026-08-10
Repo: `arman573/harmoniq-backend`
Branch: `feature/ai-arman-foundation-v1`
Draft PR: `#18`

## Current verified Customer Core state

Product Intelligence integration support in Customer Core now includes:

- strict v1 response validation at the integration boundary;
- fail-closed handling for malformed JSON and structurally invalid nested responses;
- strict HTTPS-only request-base URL policy;
- separate request origin and canonical identity-token audience;
- centralized connection configuration for URL + auth mode + audience;
- default auth mode disabled (`none`);
- optional Google metadata identity-token support for a future private Cloud Run service;
- fixed Google metadata endpoint and `Metadata-Flavor: Google` header;
- no service-account private key storage;
- fail-closed behavior before Product Intelligence network calls when connection/auth configuration is invalid;
- regression tests proving that a tagged/candidate request URL can differ from the canonical service audience.

The connection contract is documented in:

```text
docs/ai-arman/PRODUCT_INTELLIGENCE_CONTRACT_V1.md
```

## Required future private-service configuration

Conceptual configuration only; nothing is activated by this document:

```text
PRODUCT_INTELLIGENCE_BASE_URL=<safe HTTPS request origin>
PRODUCT_INTELLIGENCE_AUTH_MODE=google_metadata_identity_token
PRODUCT_INTELLIGENCE_AUDIENCE=<canonical Cloud Run service origin>
PRODUCT_INTELLIGENCE_TIMEOUT_MS=<bounded request timeout>
PRODUCT_INTELLIGENCE_AUTH_TIMEOUT_MS=<bounded metadata timeout>
```

For a zero-traffic tagged candidate, the intended model is:

```text
request URL -> tagged candidate URL
ID-token audience -> canonical Cloud Run service URL
```

Customer Core must not derive the canonical audience from the tagged request URL.

## Verified safety boundaries

The following are still intentionally not performed from this repo work:

- no Product Intelligence Cloud Run service creation;
- no candidate deployment;
- no Cloud Run traffic change;
- no public access change;
- no IAM grant such as `roles/run.invoker`;
- no runtime environment-variable activation;
- no secret creation or service-account private key;
- no merge of PR `#18`;
- no merge or deployment of Product Intelligence PR `#25`;
- no production provider activation.

All such actions require separate explicit approval.

## External Product Intelligence project truth

The separate Product Intelligence implementation remains in:

```text
repo: arman573/harmoniq-product-data-pipeline
branch: sync/ai-arman-product-intelligence-v1
PR: #25 (draft)
```

Its planned private bootstrap model uses a tagged candidate URL for authenticated smoke requests while minting the identity token for the canonical Cloud Run service URL. This matches the Customer Core connection model documented above.

Do not assume that the external PR is mergeable, deployed, or unchanged without fresh GitHub verification.

## Latest verified Customer Core checkpoint before this documentation update

Before the documentation-only checkpoint commit, the verified implementation HEAD was:

```text
1bed919abc41b4980cf5ef6a89f5e38e343c869a
```

GitHub Actions:

```text
AI Arman foundation CI #351
completed / success
unit tests: success
TypeScript build: success
```

The documentation commit after that implementation checkpoint must also be verified by GitHub Actions before this readiness slice is considered fully green.

## Next safe engineering step

After documentation CI is green, the next safe code phase is to inspect runtime observability and error redaction around Product Intelligence authentication and connection failures.

Goals for that slice:

1. no identity token may appear in logs, errors, audit payloads or returned API objects;
2. auth/config failures should be distinguishable enough for operations without exposing credentials or tokens;
3. Product Intelligence request failures should preserve fail-closed recommendation behavior;
4. tests should prove redaction and safe error classification;
5. no deployment, IAM or provider activation is required for this work.
