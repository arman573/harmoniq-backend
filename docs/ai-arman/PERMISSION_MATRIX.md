# AI Arman - Permission Matrix

Status: Locked foundation draft
Date: 2026-08-04

## Identity levels

### Anonymous

Allowed:

- general beauty guidance;
- product discovery;
- product comparison;
- INCI explanation;
- public policy and routine guidance.

Not allowed:

- reading customer orders;
- reading customer cases;
- creating or changing a customer-specific case;
- revealing personal data.

### Order-verified customer

Verification requires order identity through an approved backend flow, such as order number plus matching email and, for sensitive actions, an email one-time code.

Allowed after successful verification:

- read the verified order;
- read delivery and tracking facts for the verified order;
- create a return, claim, missing-item or wrong-item draft;
- submit the draft after explicit confirmation;
- read the resulting case reference.

### Authenticated account customer

A short-lived server-signed identity assertion may permit:

- listing the authenticated customer's orders;
- reading their cases;
- continuing a case;
- performing the same confirmed actions as an order-verified customer.

The model must never accept a customer ID supplied only as free text.

### Human administrator

Administrative tools must remain separate from customer-facing tools and require existing staff authentication.

## Tool risk levels

### LOW

Read-only public or catalog operation.

Examples:

- search products;
- get public product details;
- analyze stored INCI;
- get public policies.

### MEDIUM

Read-only customer operation requiring verified identity.

Examples:

- get order;
- get tracking;
- get case status.

### HIGH

Customer-specific write operation requiring verified identity, explicit confirmation, idempotency and audit logging.

Examples:

- create return case;
- create claim case;
- report missing item;
- report wrong item;
- send a case message;
- request a return-label workflow through the existing guarded backend.

### PROHIBITED IN INITIAL RELEASE

- direct refund;
- direct payment capture;
- order cancellation;
- address change;
- price override;
- stock override;
- product publication;
- unrestricted Vendre API call;
- unrestricted database query;
- unrestricted Gmail send;
- deletion of customer or case records.

## Explicit confirmation

Before a HIGH-risk tool executes, AI Arman must show a deterministic confirmation summary containing:

- action type;
- verified order number;
- affected product and quantity;
- customer-provided reason;
- fees or known consequences;
- what data will be submitted;
- whether human review is required.

The confirmation response must be bound to a short-lived action token. A generic earlier message such as "yes" must not authorize a later, materially different action.

## Idempotency

Every write request must include an idempotency key derived by the backend from the verified conversation action. Repeated requests must return the first safe result instead of creating duplicate cases or messages.

## Audit requirements

Every tool call must record:

- conversation ID;
- tool name and version;
- authenticated subject or anonymous status;
- input hash with sensitive-value redaction;
- result status;
- policy decision;
- confirmation token ID when applicable;
- dependency request IDs;
- timestamp;
- latency;
- error category;
- model and prompt version used for interpretation.

## Data minimization

The model receives only the fields needed to answer the current question. Tokens, passwords, full API payloads, internal notes and unrelated customer data must not enter model context.

## Failure behavior

When verification, evidence or a dependency fails:

- do not guess;
- do not silently downgrade security;
- explain the safe limitation;
- preserve collected context;
- offer or perform a controlled human handoff when available.
