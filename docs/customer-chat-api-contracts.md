# Customer Chat API Contracts

This document snapshots the customer chat and admin support API surface after PATCH 6.0-6.7. It is intended for frontend, support UI, notification, analytics, and future integration work.

The chat layer is controlled customer support and recommendation routing. It is not a generic chatbot. OpenAI is not called by these endpoints. Support, order, return, shipping, and external notification integrations remain explicit placeholders until a real provider is connected.

## Common Safety Rules

- Backend owns policy, routing, escalation, blockers, confidence, analytics, and event decisions.
- Customer-facing responses do not expose raw `policyDecision`, raw intent objects, message metadata, internal notes, admin-only audit metadata, or external-provider secrets.
- Admin endpoints may expose safe audit fields needed for triage, but not raw internal debug objects.
- Support/order integration placeholders must never invent order status, tracking, refund status, return status, or claim outcomes.

## POST /customers/:id/chat

Purpose: Accept a customer chat message, classify intent deterministically, apply backend policy, persist the turn, and return a controlled response.

Response shape:

```json
{
  "customerId": 1,
  "conversationId": "customer-1-...",
  "message": "Response text",
  "intent": {
    "type": "support_request",
    "confidence": 0.82,
    "source": "deterministic_rules",
    "normalizedMessage": "order help",
    "signals": ["support"]
  },
  "route": "support",
  "policy": {
    "route": "support",
    "allowed": true,
    "captureCustomerFacts": false,
    "reasons": ["support_intent_detected"],
    "boundary": { "type": "none" },
    "escalation": { "required": true, "priority": "low" },
    "nextActions": []
  },
  "escalationRequired": true,
  "confidence": 0.82,
  "reasons": ["support_intent_detected"],
  "suggestedActions": [],
  "response": {
    "text": "Response text",
    "followUpPrompts": []
  },
  "beautyProfileSummary": {
    "domainsDetected": [],
    "topConcerns": [],
    "topPreferences": [],
    "topSensitivities": [],
    "confidence": 0,
    "confidenceLevel": "low"
  },
  "capturedFactsCount": 0,
  "integrations": {
    "recommendations": { "status": "not_required" },
    "support": {
      "status": "placeholder",
      "capability": "order_lookup",
      "integrationStatus": "not_configured",
      "handled": false,
      "requiresHuman": true,
      "missingFields": [],
      "safeCustomerMessage": "I can help with order questions, but this store's order lookup is not connected yet. I'll route this to support."
    }
  },
  "metadata": {
    "aiUsed": false,
    "decisionOwner": "backend_policy",
    "handledBy": "harmoniq_customer_core_v1",
    "generatedAt": "2026-01-01T00:00:00.000Z"
  },
  "audit": {
    "userMessageId": 1,
    "assistantMessageId": 2,
    "boundaryType": "none",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Important fields:

- `message` mirrors `response.text` for stable UI rendering.
- `route` and `policy.route` are backend-owned routing decisions.
- `integrations.support.integrationStatus` is the external integration contract state, not proof that any provider was called.
- `audit` contains safe persisted IDs only.

Not exposed:

- Raw provider responses, raw support/order data, internal notes, or admin-only metadata.

## GET /customers/:id/chat/history

Purpose: Return customer-visible conversation history.

Response shape:

```json
{
  "customerId": 1,
  "conversations": [
    {
      "id": 11,
      "customerId": 1,
      "conversationId": "conversation-1",
      "channel": "web",
      "status": "escalated",
      "lastIntentType": "frustration",
      "lastIntentConfidence": 0.84,
      "lastPolicyRoute": "escalation",
      "boundaryType": "none",
      "escalationRequired": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:01:00.000Z",
      "messages": [
        {
          "id": 1,
          "role": "user",
          "content": "Customer-visible message text",
          "intentType": "frustration",
          "intentConfidence": 0.84,
          "policyRoute": "escalation",
          "escalationRequired": true,
          "reasons": ["customer_frustration_detected"],
          "boundaryType": "none",
          "integrations": {
            "recommendations": { "status": "not_required" },
            "support": { "status": "placeholder" }
          },
          "createdAt": "2026-01-01T00:00:01.000Z"
        }
      ]
    }
  ]
}
```

Messages are chronological within each conversation. Human/admin replies may appear as role `human`.

Not exposed:

- Internal notes, `createdByUserId`, raw message metadata, raw intent objects, raw policy decisions.

## GET /admin/customer-chat/inbox

Purpose: Return UI-ready rows for escalated or review-worthy conversations.

Response shape:

```json
{
  "rows": [
    {
      "conversationId": "chat-1",
      "customerId": 1,
      "customerName": "Ada Customer",
      "customerEmail": "ada@example.com",
      "status": "escalated",
      "priority": "medium",
      "lastIntent": "frustration",
      "lastRoute": "escalation",
      "escalationRequired": true,
      "escalationReason": "customer_frustration_detected",
      "reasons": ["customer_frustration_detected"],
      "boundaryType": "none",
      "lastMessagePreview": "I can route this to support.",
      "lastMessageAt": "2026-01-01T00:00:02.000Z",
      "messageCount": 2,
      "assignedTo": null,
      "humanHandled": false,
      "humanHandledAt": null,
      "humanHandledByUserId": null,
      "lastHumanReplyAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:10.000Z"
    }
  ],
  "count": 1
}
```

Not exposed:

- Message bodies beyond preview, raw metadata, raw policy decisions, raw intent objects, internal notes.

## GET /admin/customer-chat/conversations/:conversationId

Purpose: Return admin-safe conversation detail for support review.

Response shape:

```json
{
  "conversation": {
    "conversationId": "chat-1",
    "customerId": 1,
    "status": "escalated",
    "priority": "medium",
    "assignedTo": null,
    "lastIntent": "frustration",
    "lastIntentConfidence": 0.84,
    "lastRoute": "escalation",
    "escalationRequired": true,
    "escalationReason": "customer_frustration_detected",
    "reasons": ["customer_frustration_detected"],
    "boundaryType": "none",
    "integrationStatus": {
      "support": {
        "status": "placeholder",
        "capability": "order_lookup",
        "integrationStatus": "not_configured",
        "handled": false,
        "requiresHuman": true
      }
    },
    "humanHandled": false,
    "humanHandledAt": null,
    "humanHandledByUserId": null,
    "lastHumanReplyAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:10.000Z"
  },
  "customer": {
    "id": 1,
    "name": "Ada Customer",
    "email": "ada@example.com"
  },
  "messages": [],
  "notes": []
}
```

Admin detail may include message `createdByUserId` and internal notes for admin review. It should not expose raw metadata or raw policy objects.

## POST /admin/customer-chat/conversations/:conversationId/reply

Purpose: Persist a human/admin reply and mark the conversation as human-handled.

Request shape:

```json
{ "message": "We are reviewing this now." }
```

Response shape:

```json
{
  "conversationId": "chat-1",
  "message": {
    "id": 10,
    "role": "human",
    "content": "We are reviewing this now.",
    "createdAt": "2026-01-01T00:00:05.000Z",
    "createdByUserId": 9,
    "source": "human"
  },
  "status": "pending",
  "escalationRequired": false,
  "humanHandled": true,
  "humanHandledAt": "2026-01-01T00:00:05.000Z",
  "humanHandledByUserId": 9,
  "lastHumanReplyAt": "2026-01-01T00:00:05.000Z"
}
```

No AI, recommendation, order, or support provider is called.

## PATCH /admin/customer-chat/conversations/:conversationId/status

Purpose: Update conversation status through controlled values.

Allowed statuses:

- `open`
- `pending`
- `escalated`
- `resolved`
- `closed`

Response shape:

```json
{
  "conversationId": "chat-1",
  "status": "resolved",
  "escalationRequired": false
}
```

Resolved or closed statuses clear `escalationRequired`.

## PATCH /admin/customer-chat/conversations/:conversationId/assign

Purpose: Assign or unassign an admin/support owner.

Request shape:

```json
{ "assignedToUserId": 12 }
```

Response shape:

```json
{
  "conversationId": "chat-1",
  "assignedTo": 12
}
```

Use `null` to clear assignment.

## POST /admin/customer-chat/conversations/:conversationId/notes

Purpose: Add an internal admin note.

Request shape:

```json
{ "body": "Call customer tomorrow." }
```

Response shape:

```json
{
  "id": 21,
  "conversationId": "chat-1",
  "body": "Call customer tomorrow.",
  "authorUserId": 5,
  "createdAt": "2026-01-01T00:00:03.000Z"
}
```

Internal notes are admin-only and are not returned from customer history.

## GET /admin/customer-chat/metrics

Purpose: Return operational totals and rates.

Response shape:

```json
{
  "totals": {
    "conversations": 0,
    "messages": 0,
    "escalated": 0,
    "humanHandled": 0,
    "resolved": 0,
    "open": 0
  },
  "rates": {
    "escalationRate": 0,
    "humanHandledRate": 0,
    "resolutionRate": 0
  }
}
```

Rates are deterministic two-decimal ratios. When there are no conversations, rates are `0`.

Not exposed:

- Message bodies, raw metadata, raw policy decisions, raw intent objects, internal notes.

## GET /admin/customer-chat/quality

Purpose: Return minimal quality counts and rates from persisted audit fields.

Response shape:

```json
{
  "frustration": {
    "conversations": 0,
    "repeatedFrustration": 0,
    "rate": 0
  },
  "offTopic": {
    "conversations": 0,
    "rate": 0
  },
  "unsafe": {
    "conversations": 0,
    "rate": 0
  },
  "mixedIntent": {
    "conversations": 0,
    "rate": 0
  },
  "recommendation": {
    "conversations": 0,
    "rate": 0
  },
  "support": {
    "conversations": 0,
    "rate": 0
  }
}
```

Signals are calculated from persisted conversation/message audit fields such as `lastIntentType`, `lastPolicyRoute`, `lastBoundaryType`, message `intentType`, `policyRoute`, `boundaryType`, and `policyReasons`.

Not exposed:

- Message bodies, raw metadata, raw policy decisions, raw intent objects, internal notes.

## Recommendation Evidence Contract

Purpose: Reserve a small backend-owned contract for future recommendation evidence without implementing scoring in the customer chat layer.

This contract is type-only in the backend today. Customer chat may reference recommendation evidence later when a dedicated recommendation endpoint provides it. Customer chat must not invent evidence, order data, support data, or product analysis data.

Contract shape:

```json
{
  "status": "not_available",
  "summary": {
    "confidence": 0,
    "confidenceLevel": "low",
    "positiveEvidence": [
      {
        "code": "matches_dry_skin",
        "label": "Matches dry skin",
        "detail": "Product signals align with the customer's dry skin profile.",
        "source": "customer_fact",
        "domain": "skin",
        "confidence": 0.7,
        "polarity": "positive",
        "impact": 15
      }
    ],
    "negativeEvidence": [],
    "neutralEvidence": [],
    "missingEvidence": ["missing_product_analysis"],
    "conflicts": []
  },
  "note": "Recommendation evidence is not calculated by customer chat."
}
```

Allowed evidence sources:

- `customer_fact`
- `customer_profile`
- `product_tag`
- `product_analysis`
- `rule`
- `manual`

Rules:

- This contract does not add scoring behavior.
- This contract does not call OpenAI.
- This contract does not add product, ingredient, order, return, or support integrations.
- Evidence should only be returned when a backend recommendation component supplies structured evidence.
- When evidence is absent, use `status: "not_available"` rather than fabricating data.

## Placeholder Integration Behavior

Support/order/returns contracts currently report explicit placeholders only.

Current support placeholder shape:

```json
{
  "status": "placeholder",
  "capability": "order_lookup",
  "integrationStatus": "not_configured",
  "handled": false,
  "requiresHuman": true,
  "missingFields": [],
  "safeCustomerMessage": "I can help with order questions, but this store's order lookup is not connected yet. I'll route this to support."
}
```

Supported capability values:

- `order_lookup`
- `return_request`
- `claim_wrong_product`
- `claim_damaged_product`
- `shipping_tracking`
- `human_support_handoff`

Integration status values:

- `not_configured`
- `available`
- `unavailable`
- `error`

Until a real provider is connected, placeholders must not invent external data and must route unresolved cases to human support.
