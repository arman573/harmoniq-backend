# Customer Chat Recovery Roadmap

This roadmap tracks what was intentionally excluded from the large backup branch while restoring the clean Customer Chat / AI ARMAN backend core.

The clean branch is the source of truth for future work:

- `customer-chat-core-clean`

The backup/archive branch and PR are reference material only:

- `backup/customer-chat-local-before-sync`
- PR #11 should not be merged directly.

## Current Clean Scope

The clean branch keeps the controlled customer chat backend foundation:

- Customer chat request/response flow
- Deterministic intent understanding
- Backend policy routing
- Response composition
- Conversation/message persistence
- Admin chat inbox/detail/reply/status/assign/notes APIs
- Metrics and quality endpoints
- Chat event hooks
- Support/order placeholder integration contracts
- API contract documentation
- Focused tests

## Intentionally Skipped From Backup

The following areas were intentionally not ported because the backup diff was too broad and touched unrelated or high-risk code paths:

- `src/products/*`
- `src/ingredients/*`
- `src/explainability/*`
- `src/tickets/recommendation-scoring*`
- `src/tickets/recommendation-evidence*`
- `src/beauty-domain.ts`
- `src/lib/*`
- `src/scripts/*`
- OpenAI dependency changes
- dotenv dependency changes
- zod dependency changes
- broad `tickets.service.ts` recommendation logic changes
- frontend/admin UI work

## Recovery Principles

1. Do not merge the backup PR directly.
2. Restore one capability at a time in small PRs.
3. Avoid touching `tickets.service.ts` unless a patch explicitly justifies it.
4. Keep OpenAI usage out unless explicitly approved.
5. Prefer backend-owned deterministic logic and explicit placeholders.
6. Run build and tests after every recovery patch.
7. Keep each PR small enough to review safely.

## Recommended Recovery Order

### R1 - Clean Customer Chat PR Review

Goal: Validate and merge the clean customer chat backend core.

Scope:
- Review `customer-chat-core-clean`
- Confirm no unrelated products/ingredients/explainability/scoring code was included
- Confirm package dependencies did not change
- Confirm build/test remain green

Do not add new behavior in R1.

### R2 - Customer Chat Smoke Tests / E2E Coverage

Goal: Add thin endpoint-level smoke tests if current coverage is not enough.

Scope:
- `POST /customers/:id/chat`
- `GET /customers/:id/chat/history`
- one admin inbox/detail path

Avoid broad test fixtures.

### R3 - Admin UI Integration Plan

Goal: Recreate the admin UI work in the correct frontend/admin project only after backend is merged.

Scope:
- Identify the correct frontend repo first
- Do not use `harmoniq-returns` unless the task is specifically about returns
- Build a minimal page against `docs/customer-chat-api-contracts.md`

### R4 - Recommendation Evidence Contracts

Goal: Reintroduce recommendation evidence as contracts, not scoring rewrites.

Scope:
- Add small types for evidence/reason codes if needed
- Do not port the large `recommendation-scoring` file directly
- Do not rewrite `tickets.service.ts` in the same patch

### R5 - Explainability Contracts

Goal: Add explainability response contracts only if needed by customer/admin chat responses.

Scope:
- Keep as DTO/types or a small pure service
- No OpenAI calls
- No product analysis coupling

### R6 - Product/Ingredient Intelligence Review

Goal: Evaluate whether product/ingredient modules from the backup belong in Customer Core now or should remain separate future work.

Scope:
- Inspect backup code first
- Create a design note before porting code
- Do not add dependencies until build impact is understood

### R7 - Real Support/Order Integration v1

Goal: Replace explicit support placeholders with a real read-only integration when ready.

Scope:
- Read-only order lookup first
- No returns/claims mutation in first integration patch
- No fake order status or tracking data

## Branch Discipline

Use separate branches for each recovery patch:

- `review/customer-chat-core`
- `test/customer-chat-smoke`
- `plan/admin-chat-ui`
- `contract/recommendation-evidence`
- `contract/explainability`
- `review/product-ingredient-intelligence`
- `integration/order-lookup-v1`

## Current Decision

The immediate next step is to review and stabilize the clean backend branch before restoring any skipped feature code.
