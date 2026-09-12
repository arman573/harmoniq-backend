# AI Arman - Return and Claim Automation Target

Status: locked product target
Date: 2026-08-12
Branch: `feature/ai-arman-foundation-v1`

## Goal

Returns and claims are a core AI Arman end-state.

AI Arman should not only identify a return/claim intent or link the customer to another flow. The target is that AI Arman can answer, continue and automate return and claim conversations through Harmoniq's existing guarded returns/claims backend.

## Target customer experience

A customer should be able to write naturally in Swedish, for example:

- `Jag vill returnera den här produkten.`
- `Produkten kom trasig.`
- `Jag fick fel vara.`
- `Vad händer med min reklamation?`
- `Ni bad om en bild, hur skickar jag den?`
- `Jag har redan svarat i ärendet.`

AI Arman should then be able to:

1. understand whether the request is a return, claim, wrong item, missing item or an existing-case question;
2. verify the relevant customer/order identity through approved backend flows;
3. read verified order and case facts;
4. answer status, policy and next-step questions from verified facts;
5. ask only for missing information;
6. collect product, quantity, reason, customer description and supporting evidence;
7. prepare and create a return or claim case after required confirmation;
8. continue an existing case without forcing the customer to start over;
9. send customer case messages through the guarded case backend;
10. receive new customer messages into the same case context;
11. automatically progress deterministic workflow steps when backend policy explicitly permits them;
12. notify or hand over to human customer service when human review is required.

## Automation principle

```text
AI Arman interprets and communicates.
Backend policy decides what is allowed.
The existing returns/claims module owns case state and execution.
```

AI Arman must orchestrate the existing case system rather than create a second independent return/claim database or parallel case history.

## What AI Arman may eventually automate

Subject to verified identity, tool policy, confirmation, idempotency and audit requirements, AI Arman may eventually automate:

- return/claim intake;
- required follow-up questions;
- case creation;
- case status explanation;
- customer-facing case replies;
- requests for missing evidence;
- receipt of customer evidence/messages;
- deterministic status transitions explicitly allowed by backend policy;
- deterministic next-step instructions;
- reminders or follow-up workflow hooks where separately approved;
- human handoff with complete context.

## Decisions that remain guarded

The language model must never independently:

- approve or deny a claim as a free-form model decision;
- issue a refund;
- grant compensation;
- waive fees;
- change payment state;
- cancel an order;
- alter customer/order data;
- write unrestricted data to Vendre, Gmail or another production system.

Such actions require either:

1. a separately approved deterministic backend policy that authorizes the exact action, or
2. human review.

## Communication continuity

Return/claim messages should remain in the same case context across AI Arman, customer-facing case chat and human support wherever technically possible.

The target is:

```text
Customer message
  -> AI Arman
  -> guarded return/claim backend
  -> case history / public message
  -> customer-visible reply
  -> admin queue when human action is needed
```

When AI Arman can safely answer from verified facts, it should answer directly. When it cannot, it should preserve the context and route the case to a human rather than make the customer repeat the history.

## Safety requirements

All customer-specific write actions remain subject to `PERMISSION_MATRIX.md`.

At minimum:

- verified identity;
- explicit confirmation when required;
- backend-owned policy decisions;
- idempotency for writes;
- audit logging;
- data minimization;
- fail-closed dependency behavior;
- no invented case/order facts;
- controlled human escalation.

## Roadmap position

This is a locked end-state, but it does not mean unrestricted automation is enabled in the current foundation or Beta 1.

Recommended progression:

1. read-only order/case facts;
2. AI answers about existing return/claim status;
3. guided intake and case preparation;
4. confirmed case creation and customer case messaging;
5. deterministic workflow automation behind backend policy;
6. broader automation only after measured safety and quality verification.
