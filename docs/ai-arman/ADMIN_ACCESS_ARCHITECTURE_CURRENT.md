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
Admin companion
  -> AI Arman command planner
  -> typed AI Arman admin action
  -> ReturnsAdminGatewayClient
  -> private Cloud Run identity + dedicated AI admin token
  -> returns POST /api/internal/ai-arman/admin/execute
  -> existing /api/cases/... or /api/admin/... route
  -> existing authenticated returns integrations (GCS / Vendre / Gmail / tracking / other admin capabilities)
```

The returns gateway is the technical full-access boundary. AI Arman's typed action layer is the policy boundary.

AI Arman must not expose a generic model-controlled `method + path + body` tool. The model may interpret the administrator's intent, but backend code selects a named action and its fixed route/payload contract.

## Read fallback boundary

The existing `AiArmanAdminToolRegistryService` is intentionally retained for read-only support capabilities. It is not a second admin write path.

Current orchestrator behavior is:

- authoritative admin case/order-context reads prefer typed gateway actions when the command plan requests them;
- if authoritative `case.order_context.read` is unavailable and a verified `orderId` exists, the existing read-only Vendre/order and tracking clients may be used as a fallback;
- product-intelligence reads continue through the existing Product Intelligence client;
- all admin writes still go exclusively through typed `AiArmanAdminActionService` actions and `ReturnsAdminGatewayClient`.

Do not remove these read fallbacks while they are still used by the orchestrator. Do not extend them into a parallel admin write system.

## Canonical AI-side configuration

The admin integration uses these AI-side environment variables:

- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_AUDIENCE`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN`
- `AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED`
- `AI_ARMAN_RETURNS_ADMIN_GATEWAY_TIMEOUT_MS`

Do not introduce a second admin env convention such as `AI_ARMAN_RETURNS_FULL_ADMIN_*`. Older diagnostics that used alternate names are legacy only.

## Current typed admin actions

The permanent action layer currently defines:

- `case.read` — reads the authoritative case from the returns admin data.
- `case.order_context.read` — reads authoritative live order/tracking context through `/api/admin/cases/:caseId/order-context`.
- `case.pause` — writes work-queue state `waiting` through the existing admin route.
- `case.complete` — writes work-queue state `completed` through the existing admin route.

More admin capabilities should be added as named typed actions, not by exposing the raw gateway to the model.

## Write policy

Technical write access being enabled does not mean unrestricted model autonomy.

AI-side writes require all of the following:

1. The gateway is configured and reachable.
2. `AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED=true`.
3. The request is a named backend action.
4. The action is marked with `explicitAdminApproval=true` by deterministic backend policy.
5. The returns service independently permits the write through its own full-admin write switch and normal route validation.

Examples:

- `Pausa HQR-12345` may be treated as an explicit write instruction.
- `Borde vi pausa HQR-12345?` is a discussion/read request and must not pause the case.
- `Kontrollera order och tracking för HQR-12345` is read-only and should use `case.order_context.read`.

If a write is disabled, ambiguous, unauthorized or rejected upstream, AI Arman must surface that system result rather than claim the action succeeded.

## Customer widget boundary remains separate

The customer widget has a different trust boundary and should continue to use verified customer identity/session plus its dedicated read-oriented order, tracking, returns and product projections. Do not replace customer identity-sensitive reads with the admin full-access gateway.

The two paths share AI reasoning capabilities but not authority:

```text
Customer widget -> verified customer scope -> customer-safe reads -> customer answer
Admin companion -> admin action policy -> full-admin gateway -> admin capabilities
```

## Development rules

- Keep `ReturnsAdminGatewayClient` plus typed actions as the canonical admin write path.
- Keep the existing admin read fallbacks only where the orchestrator uses them for verified order/tracking/product reads.
- Keep customer-facing verified read clients where they enforce customer scope.
- Add new admin abilities as small named actions with tests for route, payload, read/write classification and approval semantics.
- Never allow model output to construct arbitrary internal URLs, HTTP methods or mutation payloads.
- Never infer order/tracking facts when the authoritative admin route can read them.
- Preserve existing returns-module write/read-back protections by invoking its real admin routes instead of duplicating Vendre/GCS/Gmail logic in AI Arman.
- Run exact-head foundation CI after meaningful changes.

## Next hardening

1. Move the two dedicated full-admin tokens from masked Cloud Run environment values to Secret Manager when permissions allow.
2. Expand the typed action catalog deliberately (customer communication, return labels, order fields, status/actions, etc.) with per-action tests and policy.
3. Add durable audit/memory for approved support procedures without storing unnecessary customer PII.
4. Keep the customer widget rollout separately gated and tested end-to-end before public activation.
