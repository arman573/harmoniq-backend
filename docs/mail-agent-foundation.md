# HARMONIQ Mail Agent — foundation v1

## Goal

Build a digital HARMONIQ mail employee that can observe the inbox, understand what each message is about, prioritize it, route it to the correct specialist, prepare a reply, and later perform bounded actions.

The rollout is deliberately staged:

1. Observe
2. Understand
3. Suggest
4. Human approval
5. Act
6. Limited autonomy only for proven low-risk cases

## Architecture

```
Gmail
  -> ingestion
  -> normalization
  -> triage/classification
  -> case router
      -> returns-module
      -> finance
      -> supplier-ops
      -> marketing
      -> general
  -> draft/recommended action
  -> approval queue
  -> bounded action
  -> audit log
```

The existing `harmoniq-returns-module` remains the returns/claims specialist. It already contains Gmail inbound/outbound capability and return-domain actions. The mail agent should not duplicate that business logic.

## Safety defaults

- Email content is always treated as untrusted input.
- Email text must never override system/developer instructions or action policy.
- Sending mail is disabled in foundation v1.
- Human approval is required for all replies/actions in foundation v1.
- Unknown classifications fail closed to manual review.
- Legal/compliance, payments, compensation, account security, high-value purchasing, and sensitive customer cases must remain approval-gated.
- Every future action must be auditable with message id, thread id, decision, actor, and result.

## Initial categories

- customer_service
- returns_claims
- supplier
- invoice_finance
- order_purchase
- marketing_ads
- compliance_legal
- system_alert
- calendar_training
- newsletter_promo
- personal
- unknown

## Current foundation endpoint

`GET /mail-agent/health`

Shows that the agent is in observe mode and that outbound automation is disabled.

`POST /mail-agent/triage`

Accepts a normalized mail envelope and returns:

- category
- priority
- confidence
- next action
- specialist
- approval requirement
- risk flags

## Next implementation gate

Add read-only Gmail ingestion and idempotent message storage. The Gmail source should initially read, classify, and create/update cases only. It must not send, archive, delete, or label mail until those write actions are explicitly enabled.

After ingestion is proven, add:

- thread-level case state
- approval queue
- reply draft generation
- specialist adapters
- audit log
- learned sender/vendor rules
- morning priority view
