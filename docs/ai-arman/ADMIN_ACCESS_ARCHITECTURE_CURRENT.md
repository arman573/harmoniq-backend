# AI Arman admin access architecture — current

Updated: 2026-08-20

## Purpose

This document is the current source of truth for AI Arman's return/reclamation admin integration. Historical candidate, observer, probe and preflight documents may describe superseded states and must not be treated as current activation guidance.

## Current production checkpoint

The full-admin integration has been promoted and verified in production:

- Returns service revision: `harmoniq-returns-api-aifullv2-1` at 100% traffic.
- AI Arman service revision: `harmoniq-ai-arman-beta0-retadminv2-1` at 100% traffic.
- Full-admin read and write capability is enabled.
- Read access has been verified against 176 real cases.
- The write forwarding chain has been verified through a real admin route without mutating verification data.
- AI Arman remains private behind Cloud Run IAM.
- AI Arman does not receive the ordinary returns `ADMIN_ACCESS_TOKEN`.

The dedicated full-admin tokens are currently supplied as masked Cloud Run environment values. They should be migrated to Secret Manager when the deployment identity has the required secret-management permission. Never print or copy token values into source, logs, documentation or chat.

## Canonical architecture

```text
Admin companion / resolver
  -> AI Arman interpretation
  -> deterministic policy / explicit admin approval
  -> named typed AI Arman admin action
  -> ReturnsAdminGatewayClient
  -> private Cloud Run identity + dedicated AI admin token
  -> returns POST /api/internal/ai-arman/admin/execute
  -> existing /api/cases/... or /api/admin/... route
  -> existing authenticated returns integrations (GCS / Vendre / Gmail / nShift / tracking)
  -> authoritative read-back
```

The Returns gateway is the technical full-access boundary. AI Arman's typed action/resolver layer is the policy boundary.

AI Arman must not expose a generic model-controlled `method + path + body` tool. The model may interpret the administrator's intent, but backend code selects a named action and its fixed route/payload contract.

## Controlled case resolver

A guarded resolver now exists in the candidate module. It is documented in `ADMIN_CASE_RESOLVER_V1.md` and is separately gated by:

`AI_ARMAN_ADMIN_RESOLVER_ENABLED`

The flag defaults OFF.

Resolver flow:

```text
prepare(caseId)
  -> authoritative case/order reads
  -> bounded analysis + optional reply draft
  -> show named actions
  -> ZERO writes

execute(one action, approved=true)
  -> validate action-specific contract
  -> one typed write
  -> Returns domain guards/side effects
  -> authoritative case.read verification
```

Browser-supplied case facts do not become authoritative resolver context. Execute accepts one action at a time and unsupported action names fail before gateway execution.

## Read fallback boundary

The existing `AiArmanAdminToolRegistryService` is intentionally retained for read-only support capabilities. It is not a second admin write path.

Current orchestrator behavior is:

- authoritative admin case/order-context reads prefer typed gateway actions when the command plan requests them;
- if authoritative `case.order_context.read` is unavailable and a verified `orderId` exists, the existing read-only Vendre/order and tracking clients may be used as a fallback;
- product-intelligence reads continue through the existing Product Intelligence client;
- all admin writes still go exclusively through named typed actions and `ReturnsAdminGatewayClient`.

Do not remove these read fallbacks while they are still used by the orchestrator. Do not extend them into a parallel admin write system.

## Canonical AI-side configuration

The admin integration uses these AI-side environment variables:

- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_AUDIENCE`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN`
- `AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_TIMEOUT_MS`
- `AI_ARMAN_ADMIN_RESOLVER_ENABLED` — separate resolver activation gate, default OFF.

Do not introduce a second admin gateway env convention such as `AI_ARMAN_RETURNS_FULL_ADMIN_*`. Older diagnostics that used alternate names are legacy only.

## Current typed admin actions

The permanent typed layer now defines:

- `case.read` — authoritative case read.
- `case.order_context.read` — authoritative live order/tracking context.
- `case.customer_message.send` — reviewed customer message through the real Returns communication path.
- `case.pause` — work queue `waiting`.
- `case.complete` — work queue `completed`.
- `case.return_status.set` — one exact Returns-supported return status; Returns owns GCS/Vendre/pre-dispatch guards.
- `case.product_decision.set` — one product decision (`pending/approved/rejected`); rejection requires reason.
- `case.return_label.create` — real label creation using authoritative Returns/Vendre data, eligibility policy and nShift integration.

Sensitive return/product/label actions are marked as requiring a human decision plus explicit execute approval. AI Arman may execute the approved choice; it is not the independent decision maker.

More admin capabilities should be added as named typed actions, not by exposing the raw gateway to the model.

## Write policy

Technical write access being enabled does not mean unrestricted model autonomy.

AI-side writes require all of the following:

1. The gateway is configured and reachable.
2. `AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED=true`.
3. The request is a named backend action.
4. The action is marked with `explicitAdminApproval=true` by deterministic backend policy/resolver approval.
5. For resolver endpoints, `AI_ARMAN_ADMIN_RESOLVER_ENABLED=true` must also be set.
6. The Returns service independently permits the write through its own full-admin write switch and normal route/domain validation.

Examples:

- `Pausa HQR-12345` may be treated as an explicit supported write instruction.
- `Borde vi pausa HQR-12345?` is a discussion/read request and must not pause the case.
- A model suggestion to reject a product does not authorize `case.product_decision.set`; an administrator must explicitly approve the decision, and a rejection requires a reason.
- `case.return_label.create` sends no browser/model-provided address or nShift payload. Returns reconstructs the request from its authoritative case/Vendre facts and may reject it through eligibility/pre-dispatch/domain guards.

If a write is disabled, ambiguous, unauthorized or rejected upstream, AI Arman must surface that result rather than claim the action succeeded.

## Customer widget boundary remains separate

The customer widget has a different trust boundary and should continue to use verified customer identity/session plus its dedicated read-oriented order, tracking, returns and product projections. Do not replace customer identity-sensitive reads with the admin full-access gateway.

The paths share AI reasoning but not authority:

```text
Customer widget -> verified customer scope -> customer-safe reads/actions -> customer answer
Admin companion/resolver -> admin policy + explicit approval -> typed full-admin action -> admin result
```

## Development rules

- Keep `ReturnsAdminGatewayClient` plus typed actions as the canonical admin write path.
- Keep the resolver default-disabled until candidate/runtime verification and explicit activation approval.
- Keep the existing admin read fallbacks only where the orchestrator uses them for verified order/tracking/product reads.
- Keep customer-facing verified clients where they enforce customer scope.
- Add new admin abilities as small named actions with tests for exact route, payload, read/write classification, approval semantics and post-write verification.
- Never allow model output to construct arbitrary internal URLs, HTTP methods or mutation payloads.
- Never infer order/tracking facts when an authoritative backend read is available.
- Preserve Returns business rules by invoking its real admin routes instead of duplicating Vendre/GCS/Gmail/nShift logic in AI Arman.
- Run exact-head foundation CI after meaningful changes.

## Next hardening / expansion

1. Move the two dedicated full-admin tokens from masked Cloud Run environment values to Secret Manager when permissions allow.
2. Candidate-test the resolver with the feature flag enabled while production traffic remains unchanged; use read/prepare first and do not execute a real mutation merely for testing.
3. Add further high-impact capabilities only after exact Returns contracts and policy are inspected (refund, compensation, replacement, payment/order changes, cancellation).
4. Add durable audit/memory for approved support procedures without storing unnecessary customer PII.
5. Keep customer-widget rollout separately gated and tested end-to-end before public activation.
