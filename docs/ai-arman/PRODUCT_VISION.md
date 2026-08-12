# AI Arman - Product Vision

Status: Locked foundation draft
Date: 2026-08-04
Branch: `feature/ai-arman-foundation-v1`

## Product statement

AI Arman is Harmoniq's digital Skonhetshjalte: a customer-facing beauty advisor and customer-service assistant that can support customers before and after purchase through controlled backend tools.

AI Arman is not a generic FAQ chatbot. It is an orchestration layer above Harmoniq's existing customer, product, search, order, tracking, returns, claims and communication modules.

## Core principle

```text
AI interprets.
Backend decides.
Backend explains.
Backend estimates confidence.
Backend performs approved actions.
```

The language model must never receive unrestricted credentials or direct access to Vendre, Hello Retail, Gmail, nShift or production databases.

## Customer journeys

### Before purchase

AI Arman should help a customer:

- describe a beauty need in natural language;
- find the correct product type;
- compare suitable products;
- understand relevant INCI signals;
- understand limitations and trade-offs;
- receive current price, stock and product links;
- build a routine without inventing product facts.

### After purchase

AI Arman should help a customer:

- find an order;
- understand order and delivery status;
- create a return request;
- create a claim;
- report a missing item;
- report a wrong item;
- provide supporting details and attachments;
- continue an existing HQR case;
- receive answers about an active return or claim directly from AI Arman when the answer can be grounded in verified backend facts and policy;
- have return and claim conversations progressed automatically through the existing guarded returns/claims backend;
- transfer to human customer service without making the customer repeat everything.

## Return and claim automation target

Return and claim handling is a core AI Arman end-state, not only a link-out or handoff flow.

AI Arman should progressively be able to:

1. understand a customer's return or claim request in free Swedish text;
2. verify the relevant customer/order context through approved backend identity flows;
3. read the existing return/claim case and its public history;
4. answer policy, status and next-step questions from verified backend facts;
5. ask only the follow-up questions needed to complete the case;
6. collect reason, affected product, quantity, customer description and supporting evidence;
7. prepare, create and update return/claim cases through the existing guarded backend after required confirmation;
8. send and receive case messages so the customer can continue the case inside the AI Arman conversation;
9. automatically progress deterministic workflow steps when backend policy explicitly permits them;
10. preserve the full case context when human review is required.

Automation must not mean unrestricted model authority. The language model interprets and communicates, while backend policy remains the authority for actions and case decisions.

AI Arman must not independently approve a claim, issue a refund, grant compensation, waive fees or create other financial/legal outcomes unless a separately approved deterministic backend policy explicitly authorizes that exact action. Otherwise the case must be escalated for human review with all collected context preserved.

The existing return/claim module remains the system of record and execution layer. AI Arman should orchestrate that module rather than build a second independent case system.

## Persona

AI Arman must clearly identify itself as an AI version of Harmoniq's and Arman's expertise.

Expected tone:

- warm;
- knowledgeable;
- direct;
- calm;
- practical;
- lightly humorous when the situation allows it;
- never dismissive, overconfident or aggressively sales-oriented.

AI Arman must not impersonate the human Arman or claim that a human has personally reviewed a conversation unless that has actually happened.

## Phase 0 scope

Phase 0 creates the contracts and code foundation only.

Included:

1. architecture and ownership boundaries;
2. recommendation contract;
3. permission and confirmation model;
4. tool registry contract;
5. deterministic recommendation scoring foundation;
6. initial evaluation scenarios.

Not included:

- production traffic;
- public widget activation;
- direct Vendre write access;
- refunds;
- order cancellation;
- address changes;
- autonomous compensation decisions;
- automatic publication of product changes;
- automatic return-label creation without existing backend safety rules.

## First vertical slice

The first testable version must prove three complete journeys:

1. recommend products using product designation and INCI as joint priority one;
2. read a real order and explain its tracking status;
3. create a return case through the existing returns module after explicit customer confirmation.

## Definition of success

The foundation is successful when:

- every model action maps to a named backend tool;
- every tool declares authentication, confirmation and risk requirements;
- product recommendations can be explained from stored evidence;
- live facts are never guessed;
- unsuitable products are filtered before personalization;
- after-purchase writes are auditable and idempotent;
- return and claim conversations can eventually be answered and progressed by AI Arman through the existing guarded case backend instead of requiring a separate manual conversation for every step;
- uncertain or blocked conversations can be handed to a human with full context.
