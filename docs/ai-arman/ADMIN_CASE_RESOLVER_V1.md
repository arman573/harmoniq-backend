# AI Arman admin case resolver v1

Updated: 2026-08-20

## Goal

AI Arman should be able to help an administrator resolve real return/support cases without turning the language model into the business-rule or API authority.

The resolver is deliberately split into two phases:

```text
PREPARE (read-only)
  -> read authoritative case
  -> read authoritative order/tracking context when available
  -> analyze verified context
  -> prepare a customer reply draft
  -> expose only named supported actions

EXECUTE (write)
  -> require explicit admin approval
  -> accept exactly one allowlisted typed action
  -> execute through ReturnsAdminGatewayClient
  -> reuse the existing Returns Module admin route/domain logic
  -> read the case back after the write
  -> report whether post-write verification succeeded
```

The model never receives a generic method/path/body capability.

## Activation

The resolver endpoints are guarded by:

`AI_ARMAN_ADMIN_RESOLVER_ENABLED`

Default is OFF and is covered by a dedicated unit test. Merely including the resolver code in a container does not activate its routes.

Candidate/internal endpoints:

- `POST /ai-arman/internal/admin-resolver/prepare`
- `POST /ai-arman/internal/admin-resolver/execute`

## Prepare contract

Minimum request:

```json
{
  "caseId": "HQR-12345"
}
```

Browser-supplied case facts are not authoritative. The resolver ignores supplied status/customer/messages and loads the case through `case.read`.

Prepare is always read-only. It:

1. loads the authoritative case;
2. attempts `case.order_context.read`;
3. feeds bounded authoritative case/order facts to the admin analysis model;
4. creates an optional reply draft through the existing guarded reply-draft service;
5. returns the currently available typed actions.

If model analysis or reply drafting is unavailable, prepare may still succeed with verified case facts and null analysis/draft. Model availability is not allowed to turn a read path into a write path.

## Execute contract

One action per request. `approved` must be exactly `true`. Missing/false approval executes no write.

Unsupported action names are rejected before any gateway call.

Example customer message:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.customer_message.send",
  "subject": "Angående ditt ärende",
  "message": "Hej! Vi har nu kontrollerat ditt ärende."
}
```

Example return status:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.return_status.set",
  "status": "return_received",
  "note": "Returen verifierad som mottagen."
}
```

Example product decision:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.product_decision.set",
  "productIndex": 0,
  "decision": "approved",
  "adminNote": "Godkänt efter manuell granskning."
}
```

A rejected product decision additionally requires a non-empty `rejectReason`.

Example return label:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.return_label.create"
}
```

No customer address, carrier payload or shipment fields are accepted from the resolver request. The Returns Module constructs those from its authoritative case/Vendre data.

## Typed resolver actions in v1

### `case.customer_message.send`

Uses `POST /api/admin/cases/:caseId/messages/send` with fixed `{ subject, message }` payload.

The Returns Module remains responsible for email, case message persistence, communication state, status history and Vendre communication logging.

### `case.pause`

Uses the existing work-queue route with fixed state `waiting`.

### `case.complete`

Uses the existing work-queue route with fixed state `completed`.

### `case.return_status.set`

Uses `POST /api/admin/cases/:caseId/status`.

AI Arman mirrors the Returns Module's exact return-status allowlist. The Returns Module remains responsible for GCS state, communication flags, Vendre status updates and its pre-dispatch withdrawal guards.

The resolver marks this as requiring a human decision as well as explicit execute approval.

### `case.product_decision.set`

Uses `PATCH /api/admin/cases/:caseId/products/:productIndex/decision`.

Allowed decisions are exactly `pending`, `approved` and `rejected`. Rejecting requires a reason. The Returns Module remains responsible for product state, aggregate decision summary, history and persistence.

This action is a human decision executor. The model is not authorized to independently approve or reject a claim/product.

### `case.return_label.create`

Uses `POST /api/admin/cases/:caseId/return-label` with an empty JSON body.

The Returns Module loads the case, checks case-type eligibility/cost policy, enriches authoritative order/address facts from Vendre when needed, creates the nShift shipment, builds the protected customer download and persists label state/history.

AI Arman never constructs the nShift/address payload and the action requires explicit human approval.

## Read-back verification

After every successful resolver write, `case.read` is executed for the same HQR case.

The response explicitly separates:

- `writeExecuted` — the typed write succeeded;
- `verifiedAfterWrite` — authoritative case read-back also succeeded.

A write that succeeded but could not be read back must never be represented as fully verified.

## Safety boundaries

Resolver v1 still does NOT support:

- refunds;
- compensation/goodwill;
- automatic claim approval or denial by the model;
- replacement-product decisions;
- payment-state changes;
- order cancellation;
- unrestricted arbitrary status values;
- browser/model-supplied return-label address or nShift payloads;
- arbitrary Vendre/Gmail/nShift/GCS calls;
- arbitrary Returns Module routes.

Human-approved product decisions/status changes are execution of an explicit admin choice, not model autonomy.

## Current implementation

- `src/ai-arman/admin/admin-case-resolver.config.ts`
- `src/ai-arman/admin/admin-case-resolver.config.spec.ts`
- `src/ai-arman/admin/admin-case-resolver.controller.ts`
- `src/ai-arman/admin/admin-case-resolver.service.ts`
- `src/ai-arman/admin/admin-case-resolver.service.spec.ts`
- `src/ai-arman/admin/admin-action.service.ts`
- `src/ai-arman/admin/admin-action.service.spec.ts`
- `src/ai-arman/admin/admin-return-resolution-actions.service.ts`
- `src/ai-arman/admin/admin-return-resolution-actions.service.spec.ts`

The resolver is wired only into `AiArmanCandidateModule` at this stage.

## Verified Returns Module contracts used for the expansion

Read-only code inspection was performed against Returns PR #122 branch `feature/ai-arman-full-admin-access`.

Verified domain routes:

- customer message: `/api/admin/cases/:caseId/messages/send`;
- return status: `/api/admin/cases/:caseId/status`;
- product decision: `/api/admin/cases/:caseId/products/:productIndex/decision`;
- return label: `/api/admin/cases/:caseId/return-label`.

No Returns Module source file was changed by this resolver implementation.

## Verification checkpoint

Initial three-action resolver core at source `91e985a43e009d6d6e193938a443f8607eace2fd` passed workflow run `32396789876` completely: unit, TypeScript, AI candidate container/smoke and customer gateway boundary smoke.

The expanded resolver requires a new exact-head CI run after final docs/registry updates.

## Next expansion rule

To raise the percentage of cases AI Arman can resolve, inspect each current Returns Module capability before adding it. Refunds, compensation, payment/order changes and other high-impact actions need separate typed contracts and explicit business policy; they must never be inferred from generic full-admin gateway access.
