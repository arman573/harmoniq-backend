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
  -> reuse the existing Returns Module admin route
  -> read the case back after the write
  -> report whether post-write verification succeeded
```

The model never receives a generic method/path/body capability.

## Activation

The resolver endpoints are guarded by:

`AI_ARMAN_ADMIN_RESOLVER_ENABLED`

Default is OFF. Merely including the resolver code in a container does not activate its routes.

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

One action per request.

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

Queue actions:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.pause"
}
```

or:

```json
{
  "caseId": "HQR-12345",
  "approved": true,
  "action": "case.complete"
}
```

`approved` must be exactly `true`. A missing/false approval executes no write.

Unsupported action names are rejected before any gateway call.

## Typed resolver actions in v1

### `case.customer_message.send`

Uses the existing Returns Module route:

`POST /api/admin/cases/:caseId/messages/send`

with the fixed payload:

```json
{
  "subject": "...",
  "message": "..."
}
```

The Returns Module remains responsible for the real email, case message persistence, communication state, status history and Vendre communication logging.

AI Arman does not duplicate those side effects.

### `case.pause`

Uses the existing work-queue route with the fixed waiting state.

### `case.complete`

Uses the existing work-queue route with the fixed completed state.

## Read-back verification

After a successful write, the resolver executes `case.read` for the same HQR case.

The result explicitly separates:

- `writeExecuted` — whether the typed write succeeded;
- `verifiedAfterWrite` — whether authoritative case read-back also succeeded.

A write that succeeded but could not be read back must never be represented as fully verified.

## Safety boundaries

Resolver v1 does NOT support:

- refunds;
- compensation/goodwill;
- claim approval or denial;
- replacement-product decisions;
- payment-state changes;
- cancellation;
- unrestricted status mutation;
- return-label creation;
- arbitrary Vendre/Gmail/nShift/GCS calls;
- arbitrary Returns Module routes.

Those capabilities may only be added after their exact existing Returns Module contracts are inspected and represented as narrow named typed actions with explicit policy/tests.

## Current implementation

- `src/ai-arman/admin/admin-case-resolver.config.ts`
- `src/ai-arman/admin/admin-case-resolver.controller.ts`
- `src/ai-arman/admin/admin-case-resolver.service.ts`
- `src/ai-arman/admin/admin-case-resolver.service.spec.ts`
- `src/ai-arman/admin/admin-action.service.ts`
- `src/ai-arman/admin/admin-action.service.spec.ts`

The resolver is wired only into `AiArmanCandidateModule` at this stage.

## Verification checkpoint

Core resolver implementation exact-head CI before this documentation update:

- source head: `91e985a43e009d6d6e193938a443f8607eace2fd`
- workflow run: `32396789876`
- unit tests: PASS
- TypeScript build: PASS
- isolated AI candidate container build/smoke: PASS
- isolated customer gateway container build/boundary smoke: PASS

A new exact-head CI run is required after final documentation/contract updates.

## Next expansion rule

To make AI Arman resolve a wider percentage of cases, inspect the current Returns Module implementation one capability at a time, then add only exact typed actions. Prefer deterministic domain operations already implemented in Returns over new duplicated AI-side business logic.
