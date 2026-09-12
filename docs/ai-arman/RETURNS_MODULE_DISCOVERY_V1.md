# AI Arman - Returns Module Integration Discovery v1

Status: verified discovery and contract basis
Date: 2026-08-12
AI Arman repo: `arman573/harmoniq-backend`
AI Arman branch: `feature/ai-arman-foundation-v1`
Returns repo: `arman573/harmoniq-returns-module`
Returns branch inspected: `refactor-admin-return-flow-cleanup`
Returns branch head inspected: `d54b993fa769b368493d30322ce3e35433430dba`

## Purpose

This discovery maps the current returns/claims implementation before AI Arman is allowed to call it.

No production route, deployment, traffic, secret, GCP resource or live case was changed during this discovery.

## Verified ownership

The existing returns module remains the source of truth and execution layer for return/claim cases.

Current documented/implemented ownership is:

```text
GCS case envelope
  -> authoritative case state

case.messages[]
  -> customer/admin communication history

case.statusHistory[]
  -> case timeline and workflow history

returns-module backend
  -> Gmail/Vendre/nShift side effects
  -> case creation and mutation
  -> return workflow decisions
  -> admin queue behavior
```

AI Arman must orchestrate this domain rather than duplicate it.

## Current route map

### Order lookup

Current route:

```http
POST /api/orders/lookup
```

Current implementation in `customerOrderLookupGcsLocksOverride.js`:

- accepts a numeric order number;
- fetches the order from Vendre;
- normalizes customer/order/product facts;
- classifies dispatch state;
- applies existing return-case quantity locks from GCS.

Important security finding:

The current winning override does not verify customer identity. It does not bind the lookup to a verified email, account assertion or OTP. Therefore it must not be exposed as AI Arman's verified `get_order` tool unchanged.

### Customer-visible case context

Current route:

```http
GET /api/customer/order-case-messages?orderIds=...
```

Current implementation returns a customer-oriented projection of matching order cases, including:

- case ID;
- case type;
- status and status label;
- timestamps;
- public inbound/outbound messages.

It currently relies on possession of the order ID rather than strong customer verification. AI Arman must not call it as a verified case-read tool unchanged.

### Customer case message

Current routes include:

```http
POST /api/customer/cases/:caseId/messages
POST /api/customer/account-message
```

They can append customer messages to `case.messages[]`, update unread/activity state and preserve/restore the admin work queue. The account-message GCS override can also create a support case when no order case exists and can add Vendre order context.

These routes are useful evidence that the case communication model already works, but their current customer-facing authorization model is not sufficient for AI Arman server-side customer-specific writes.

### Case creation

Current route:

```http
POST /api/cases
```

Current GCS override can:

- create a new order case;
- attach a new module to an existing order case;
- support return, claim, wrong-item and missing-item flows plus additional backend case types;
- persist products and answers;
- append status history;
- put the case in the admin queue;
- save to GCS;
- record a Vendre case-created comment;
- send a customer confirmation email;
- notify admin.

This is valuable domain behavior and should be reused rather than rebuilt.

Important security finding:

The route accepts customer/order/case payload from the caller and is not itself an AI-ready verified-customer boundary. AI Arman must not invoke this raw endpoint as `create_return_case` or `create_claim_case`.

### Admin/customer reply path

Current admin route:

```http
POST /api/admin/cases/:caseId/messages/send
```

It already performs the desired outbound domain effects:

- sends customer email when required;
- appends the outbound reply to `case.messages[]`;
- updates communication state;
- appends `statusHistory[]`;
- persists to GCS;
- writes the communication log to Vendre.

It is protected by admin authentication and must remain so.

AI Arman must not receive or reuse the admin token. A dedicated server-to-server AI adapter should reuse the underlying domain behavior behind its own narrow policy boundary.

### Admin workflow mutations

Current admin mutations include:

- work-queue state changes;
- return status changes;
- per-product approve/reject decisions;
- nShift return-label creation.

These are deliberately not part of the first AI integration slice.

Claim approval/denial, refund/compensation decisions and return-label execution remain human/admin or separately deterministic-policy actions.

## Withdrawal / pre-dispatch behavior

The returns module now distinguishes:

```text
post_dispatch_return
pre_dispatch_stop
manual_dispatch_review
```

The backend/customer flow also carries authoritative dispatch state and evidence.

`customerWithdrawalPreDispatchNormalizer.js` protects `POST /api/cases` by forcing pre-dispatch/uncertain withdrawal flows into manual review, clearing return-shipping/payment values and preventing the caller from turning an uncertain pre-dispatch situation into an automatic return-label path.

AI Arman must never recreate or override this dispatch decision. The AI adapter must pass the customer intent to the returns module and let the returns domain derive/validate dispatch behavior from authoritative order facts.

## Customer case types for AI v1

First create-capable AI contract should be limited to the case types already exposed in the customer flow:

```text
return        -> Angerratt / Angra kop
claim         -> Reklamation
wrong_item    -> Fel vara
missing_item  -> Saknad vara
```

`support` may be read/continued where appropriate, but it is not a substitute for a return or claim.

Additional backend module types such as transport damage or missing shipment must not silently become AI-create tools without separate contract/test work.

## Evidence / attachments finding

There is currently no complete evidence-upload path suitable for AI Arman.

The customer claim UI explicitly shows image/video upload as a future technical version. Wrong-item image upload is also a placeholder.

Therefore:

- no `add_case_evidence` AI tool is registered in v1;
- AI Arman may ask the customer for evidence only when there is a real guarded upload mechanism to receive it;
- AI Arman must not claim that a picture/video was uploaded or attached when the module cannot persist it.

## Required new AI-safe boundary

Do not expose the existing public customer endpoints or admin endpoints directly to the language model.

The preferred integration is a narrow internal application adapter in `harmoniq-returns-module`, called only by AI Arman's backend.

Provisional internal route family:

```http
POST /api/internal/ai-arman/cases/context
POST /api/internal/ai-arman/cases/prepare
POST /api/internal/ai-arman/cases/create
POST /api/internal/ai-arman/cases/:caseId/messages
```

These paths are contract targets only. They do not exist yet and must not be treated as live.

## Server-to-server authentication

The adapter must use dedicated server-to-server authentication.

It must not use:

- the browser as the trust boundary;
- a customer ID supplied as free text;
- order ID possession alone;
- the returns admin token inside AI Arman/model context;
- unrestricted Vendre/Gmail/nShift credentials.

Preferred target is a short-lived service identity accepted only by the internal AI adapter, such as an audience-bound Google/OIDC identity token with an exact allowlisted AI Arman service identity. If runtime architecture requires another mechanism, it must provide an equivalent dedicated server-to-server boundary.

The language model never receives that credential.

## Customer verification binding

The AI Arman backend must create a short-lived verified-customer context before any customer-specific Returns Module tool is allowed.

Contract basis:

```text
verificationId
verificationMethod
subjectHash
verifiedOrderIds[]
verifiedAt
expiresAt
```

Rules:

- raw free-text customer IDs are never trusted;
- the requested order must be present in `verifiedOrderIds`;
- an explicitly requested case must belong to that verified order;
- expired verification fails closed;
- the downstream response is minimized before entering model context.

Initial supported verification methods are contract placeholders for:

```text
order_email_otp
account_assertion
```

Actual verification issuance is a separate implementation slice.

## Customer-safe read projection

The first read-only adapter should return only:

```text
orderId
caseId
caseType
status
statusLabel
createdAt
updatedAt
public inbound/outbound messages
```

Do not return to the AI/model by default:

- customer email;
- delivery address;
- internal/admin notes;
- raw status history;
- Vendre request/response data;
- Gmail message internals;
- admin queue internals;
- service credentials/tokens;
- protected return-label download codes;
- unrelated order/customer data.

## Write authorization envelope

Future case creation/message writes require all existing AI Arman HIGH-risk controls:

```text
verified customer context
+ requested order bound to verification
+ explicit action-specific confirmation token
+ backend-generated idempotency key
+ bounded case/message payload
+ audit record
```

A generic earlier `ja` must not authorize a later materially different write.

The first contract code added after this discovery only models the common verification/read/write-authorization envelope. It does not execute any write.

## Tool mapping after discovery

```text
get_case_status
  -> internal read-only case context adapter

get_case_messages
  -> same guarded read context, minimized message projection

prepare_return_case / prepare_claim_case
  -> future deterministic adapter using authoritative order + returns rules

create_return_case / create_claim_case
create_missing_item_case / create_wrong_item_case
  -> future confirmed/idempotent internal write adapter

send_case_message
  -> future confirmed/idempotent adapter reusing returns-module communication behavior
```

No evidence tool yet.

## Next implementation slice

Build **Returns Module Read Adapter v1** without enabling production use:

1. add dedicated internal read route/service in `harmoniq-returns-module`;
2. use application-level server-to-server authentication rather than admin/customer public auth;
3. require the verified-order context;
4. return only the customer-safe projection;
5. add unit/contract tests for identity mismatch, expiry, case/order mismatch, redaction and response bounds;
6. add an AI Arman client behind an interface in `harmoniq-backend`;
7. keep the client disabled/not configured by default;
8. run CI in both repositories;
9. do not deploy or alter live traffic without separate explicit approval.
