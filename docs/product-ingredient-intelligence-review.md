# Product / Ingredient Intelligence Review

This note tracks whether product and ingredient intelligence belongs in HARMONIQ Customer Core now, later, or in a separate bounded module.

## Decision Status

Status: design review only.

No product, ingredient, recommendation scoring, OpenAI, or explainability runtime code is approved by this note.

## Background

The large backup branch contained product, ingredient, explainability, recommendation scoring, recommendation evidence, scripts, library helpers, and dependency changes. That backup branch is archive/reference only and must not be merged directly.

Customer Core has since been restored through small backend-first patches:

- Clean customer chat backend core
- Customer/admin chat smoke and contract tests
- Recommendation evidence contracts
- Explainability contracts

The current question is whether product and ingredient intelligence should be introduced into Customer Core, and if so, how to do it safely.

## Non-Goals

This review does not approve:

- Porting `src/products/*`
- Porting `src/ingredients/*`
- Porting `src/explainability/*`
- Porting `src/tickets/recommendation-scoring*`
- Rewriting `tickets.service.ts`
- Adding OpenAI calls
- Adding dotenv, zod, or other new dependencies
- Inventing product, ingredient, support, order, return, refund, claim, or tracking data
- Building a generic chatbot
- Touching frontend/admin UI
- Touching `harmoniq-returns`
- Touching scheduler, tracking, pickup, or cleanup repos

## Architecture Rules

Customer Core should keep the existing product principles:

- AI interprets.
- Backend decides.
- Backend explains.
- Backend estimates confidence.
- Humans override.
- Events notify.
- Analytics measure.
- Integrations are explicit contracts, not fake behavior.

Product and ingredient intelligence must not become hidden runtime behavior behind customer chat responses.

## Candidate Capabilities

Possible future capabilities, pending separate approval:

1. Product catalog read model
   - Read-only product metadata.
   - No recommendation scoring.
   - No mutation of product data from chat.

2. Ingredient attribute contracts
   - Structured ingredient attributes or warnings.
   - No medical claims.
   - No invented ingredient facts.

3. Recommendation evidence enrichment
   - Evidence summaries that reference explicit product or ingredient facts.
   - Must remain explainable and backend-owned.

4. Admin review support
   - Admin-safe summaries of why a product may or may not fit a declared customer preference.
   - No customer-visible claims unless verified and policy-approved.

## Required Design Questions

Before porting any code, answer:

1. What source of truth owns product data?
2. What source of truth owns ingredient data?
3. Are product and ingredient facts manually curated, imported, or provider-backed?
4. What fields are safe to expose to customers?
5. What fields are admin-only?
6. What claims are prohibited?
7. How is confidence calculated?
8. How do humans override incorrect or stale intelligence?
9. Which events should analytics receive?
10. What happens when data is missing or stale?

## Safety Requirements

Any future implementation must:

- Be read-only in the first version.
- Use explicit DTO/contracts before runtime behavior.
- Avoid broad refactors.
- Avoid `tickets.service.ts` unless separately justified.
- Avoid new dependencies unless separately justified.
- Avoid OpenAI unless explicitly approved.
- Avoid fake product, ingredient, recommendation, support, order, return, claim, refund, or tracking data.
- Keep customer-visible text conservative and policy-owned.
- Keep admin-only diagnostic fields out of customer responses.

## Recommended Next Step

Create a follow-up implementation plan before code is ported.

The first implementation PR, if approved later, should be one of:

1. Add product/ingredient DTO contracts only.
2. Add a read-only provider interface with no implementation.
3. Add admin-only documentation for safe product/ingredient review.
4. Add tests around empty/missing product intelligence behavior.

Do not port backup code directly.
