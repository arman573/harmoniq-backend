# AI Arman - Returns Module Integration Plan

Status: locked integration planning rule
Date: 2026-08-12
AI Arman repo: `arman573/harmoniq-backend`
AI Arman branch: `feature/ai-arman-foundation-v1`
Returns/claims repo: `arman573/harmoniq-returns-module`
Verified returns-module planning branch at time of this document: `refactor-admin-return-flow-cleanup`

## Owner direction

AI Arman's return and claim automation must be built from and integrated with the existing Harmoniq returns/claims module.

There must not be a second independent return/claim case system inside AI Arman.

Implementation may be placed in whichever repository/layer gives the safest and cleanest architecture. ChatGPT has discretion to choose the exact integration boundary during implementation, provided the ownership rules below are preserved.

## Verified returns-module architecture

The existing returns module currently owns the return/claim execution domain.

Its documented architecture includes:

```text
Customer return portal
Admin case view
Cloud Run API
GCS case storage
Vendre integration
Gmail integration
nShift return label integration
```

The module documentation states that the current case source of truth is GCS and that:

```text
case.messages[]
```

is the source of truth for customer/admin case communication, while:

```text
case.statusHistory[]
```

is the source of truth for case status/timeline events.

The returns-module backend also owns integration side effects such as Gmail, Vendre updates, status changes and return-label behavior.

## Architecture rule

The default responsibility split should be:

```text
AI Arman / harmoniq-backend
  = natural-language interpretation
  = conversation orchestration
  = identity/policy gate selection
  = deciding which registered returns tool is being requested
  = asking the customer for missing information
  = composing customer-facing answers from verified facts
  = deciding when a human handoff is required

harmoniq-returns-module
  = return/claim case state
  = case products and answers
  = case.messages[]
  = case.statusHistory[]
  = return/claim workflow state
  = Gmail/Vendre/nShift side effects
  = guarded case writes
  = status transitions and business execution
```

This split is a default architecture, not a prohibition against moving a thin adapter or shared contract when a better implementation is found.

## Freedom to choose the integration boundary

During implementation, ChatGPT may choose the safest location for each piece, for example:

1. AI Arman tool adapter in `harmoniq-backend` calling guarded returns-module endpoints;
2. dedicated AI-safe endpoints or services added inside `harmoniq-returns-module`;
3. shared versioned request/response contracts where useful;
4. small changes in both repositories when that avoids duplicate logic.

The choice must be based on the actual current code and tests at implementation time, not assumptions from old handoff documents.

The preferred rule is: keep domain logic where it already belongs rather than copying it into AI Arman.

## Non-negotiable source-of-truth rules

AI Arman must not:

- create its own competing case database;
- create a parallel message history for return/claim cases;
- independently derive a case status when the returns module has an authoritative state;
- write directly to GCS case storage from the browser;
- write directly to Vendre, Gmail or nShift;
- bypass existing returns-module business rules to make automation easier.

AI Arman may cache or remember conversational context, but the authoritative return/claim case state remains in the returns module.

## Target AI Arman capabilities through the returns module

The integration should ultimately expose guarded capabilities equivalent to:

```text
get_verified_return_case
get_verified_claim_case
get_return_claim_case_status
get_return_claim_case_messages
create_return_case
create_claim_case
add_return_claim_customer_message
add_return_claim_evidence
request_missing_return_claim_information
progress_allowed_return_claim_step
handoff_return_claim_case_to_human
```

Names are provisional. The actual tool contract should be designed from the live/current returns-module API rather than forced to match this list.

## Communication continuity

The same case conversation should be visible across:

- AI Arman;
- customer account/case chat;
- admin return/claim view;
- imported customer email replies where supported.

AI-generated customer-facing case replies should be persisted through the returns-module communication path so that they become part of `case.messages[]` rather than existing only inside the AI Arman chat transcript.

Human replies should flow back into the same customer context where technically possible.

## Automation policy

AI Arman may automate communication and deterministic workflow steps only through guarded backend tools.

Examples that can be candidates for automation after separate verification:

- explain case status;
- request a missing image or answer;
- acknowledge received information;
- prepare or create a case after required confirmation;
- append a customer-visible message;
- move a case through an explicitly deterministic workflow transition;
- return the case to the admin queue when human action is required.

The model itself must not become the business-rule authority.

## Guarded decisions

The following remain separately protected unless an explicitly approved deterministic backend policy authorizes the exact outcome:

- approve/deny claim;
- refund;
- compensation;
- fee waiver;
- payment-state changes;
- order cancellation;
- unrestricted customer/order changes.

## Implementation sequence

When return/claim automation work starts, do this before writing code:

1. read the current AI Arman handoff and contracts;
2. read the current returns-module handoff and architecture docs;
3. inspect current returns-module routes/services for case read, case creation, messages, status updates and evidence;
4. inspect current customer/admin communication behavior;
5. identify which existing endpoints can safely be reused unchanged;
6. identify missing AI-safe endpoints or adapters;
7. define strict versioned tool contracts;
8. add tests before enabling writes;
9. implement read-only case/status/message access first;
10. add guided intake;
11. add confirmed case creation and messaging;
12. only then add deterministic workflow automation;
13. keep human escalation available throughout.

## Repository-change rule

Changes may be made in either `arman573/harmoniq-backend`, `arman573/harmoniq-returns-module`, or both, depending on where the responsibility belongs.

Do not force all AI-related code into `harmoniq-backend` if doing so would duplicate returns-module logic.

Do not force language-model/orchestration concerns into `harmoniq-returns-module` if they do not belong to the return/claim domain.

Use small, verified patches and repository CI in each affected project.

## Production safety

Planning and code work do not authorize production deployment.

Before any live integration is enabled:

- verify current returns-module production architecture and revision;
- test read-only paths;
- test identity boundaries;
- test idempotency and duplicate-message protection;
- test audit/redaction;
- test failure handling;
- test human handoff;
- obtain separate explicit approval for deployment/traffic/write activation where required.
