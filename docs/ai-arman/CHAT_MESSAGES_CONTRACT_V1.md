# AI Arman Chat Messages Contract v1

Status: foundation contract
Date: 2026-08-06
Endpoint owner: Harmoniq Customer Core

## Purpose

This contract defines the first backend-owned interface for a real Swedish free-text AI Arman conversation.

The endpoint accepts the customer's text and safe client context. The backend interprets the message, owns conversation state, selects allowed tool plans and returns structured UI blocks.

This foundation does not execute live tools, read customer data, call a language model or perform writes.

## Endpoint

```http
POST /ai-arman/chat/messages
Content-Type: application/json
```

## Contract version

Every request and response uses:

```text
ai-arman-chat-v1
```

A request with another contract version must fail closed with:

```text
unsupported_chat_contract_version
```

## Request schema

```ts
type AiArmanChatRequest = {
  contractVersion: 'ai-arman-chat-v1';
  conversationId?: string;
  clientMessageId: string;
  message: {
    text: string;
  };
  context?: {
    locale?: 'sv-SE';
    channel?: 'web_widget' | 'internal_preview';
    page?: {
      url?: string;
      productId?: string;
    };
  };
};
```

### Required fields

- `contractVersion`
- `clientMessageId`
- `message.text`

`message.text` must contain non-whitespace text and may contain at most 2,000 characters.

### Conversation ID

The client may send an existing opaque `conversationId` previously returned by the backend.

The client must never invent semantic meaning inside the ID. An omitted ID causes the foundation service to create a stable test-safe ID from `clientMessageId`. A later persistence implementation will replace this with a server-generated opaque identifier.

### Idempotency direction

`clientMessageId` identifies one client submission. The current foundation uses it to create stable response identifiers for deterministic tests.

Before public use, persistence must enforce uniqueness within a conversation and return the original safe result when the same message is submitted again.

## Fields the browser must not own

The endpoint rejects browser-supplied backend facts or decisions, including top-level:

```text
candidates
scores
conversationState
plannedTools
toolChoice
customerId
```

The browser must not:

- provide recommendation candidates;
- provide product scores or eligibility;
- restore or mutate conversation state directly;
- select backend tools;
- claim a customer identity;
- send current price, stock, order or tracking facts as authoritative data.

Rejected fields return an error beginning with:

```text
browser_owned_field_rejected:
```

## Interpretation schema

The backend returns a normalized interpretation:

```ts
type AiArmanInterpretation = {
  schemaVersion: 'ai-arman-interpretation-v1';
  source: 'deterministic_fallback';
  locale: 'sv-SE';
  primaryIntent:
    | 'product_recommendation'
    | 'purchased_product_usage'
    | 'order_status'
    | 'tracking_status'
    | 'return_help'
    | 'claim_help'
    | 'human_handoff'
    | 'greeting'
    | 'unknown';
  secondaryIntents: AiArmanIntent[];
  confidence: number;
  entities: {
    requestedProductTypes: Array<
      'shampoo' | 'conditioner' | 'hair_mask' | 'leave_in'
    >;
    needs: string[];
    exclusions: string[];
    orderReference: string | null;
    productReferences: string[];
  };
  missingFields: string[];
  requiresIdentity: boolean;
  requiresHumanReview: boolean;
};
```

The deterministic interpreter is a fallback and test foundation. It is not sufficient as the final natural-language understanding layer.

A future language-model interpreter must return the same strict schema and must pass backend validation before its interpretation can affect state or tools.

## Conversation state

The backend owns the complete state returned to the widget:

```ts
type AiArmanConversationState = {
  stateVersion: 'ai-arman-conversation-state-v1';
  conversationId: string;
  status: 'collecting' | 'ready_for_tools' | 'handoff_required';
  activeJourney:
    | 'before_purchase'
    | 'after_purchase'
    | 'customer_service'
    | 'general';
  locale: 'sv-SE';
  identityLevel: 'anonymous';
  remembered: {
    requestedProductTypes: AiArmanProductType[];
    needs: string[];
    exclusions: string[];
    orderReference: string | null;
    productReferences: string[];
  };
  pendingQuestion: {
    id: string;
    expectedField: string;
  } | null;
};
```

The widget may display this state but must not post it back as authoritative state.

A later persistence layer will load the state by `conversationId`, combine it with the new message and save a new server-owned state version.

## Backend decision

```ts
type AiArmanDecision = {
  owner: 'backend_policy';
  route:
    | 'recommendation'
    | 'purchased_product_guidance'
    | 'order_support'
    | 'returns_support'
    | 'human_support'
    | 'general';
  plannedTools: AiArmanToolName[];
  executionStatus: 'not_executed_foundation';
  requiresIdentity: boolean;
  requiresConfirmation: false;
  reasons: string[];
};
```

The model may later propose an interpretation or tool intent. The backend policy layer remains the final owner of the route and allowed tool sequence.

## Structured response blocks

The widget renders structured blocks and must not render free HTML from a model.

Supported block types are:

```text
message
question
quick_replies
product_cards
order_status_card
tracking_card
purchased_product_card
safety_notice
support_handoff
error_notice
```

### Message

```json
{
  "type": "message",
  "text": "Jag har förstått behovet."
}
```

### Question

```json
{
  "type": "question",
  "id": "requested-product-type",
  "text": "Vilken typ av hårprodukt söker du?",
  "expectedField": "requestedProductType",
  "required": true
}
```

### Quick replies

Quick replies are optional aids. They must never replace the free-text field.

```json
{
  "type": "quick_replies",
  "options": [
    {
      "id": "choose-product",
      "label": "Hjälp mig välja produkt",
      "value": "Jag vill ha hjälp att välja produkt"
    }
  ]
}
```

### Product cards

Product cards may only be returned after backend candidate retrieval, Product Intelligence quality gates and authoritative live-fact retrieval.

The foundation response does not create product cards.

Required product-card facts include timestamped product identity, URL, price, stock, evidence, limitations, usage and confidence.

### Order and tracking cards

Order and tracking cards require verified identity and authoritative read-only backend data.

A placeholder, request text or model interpretation must never be converted into an order or tracking card.

### Support handoff

A handoff block states whether the integration is available. The foundation returns `not_configured` and does not claim that a case or message has been created.

## Full response schema

```ts
type AiArmanChatResponse = {
  contractVersion: 'ai-arman-chat-v1';
  conversationId: string;
  serverMessageId: string;
  interpretation: AiArmanInterpretation;
  state: AiArmanConversationState;
  decision: AiArmanDecision;
  blocks: AiArmanResponseBlock[];
  safety: {
    aiModelUsed: false;
    liveFactsUsed: false;
    writesExecuted: false;
    productionActionsEnabled: false;
    htmlAcceptedFromModel: false;
  };
};
```

## Example: before purchase

Request:

```json
{
  "contractVersion": "ai-arman-chat-v1",
  "clientMessageId": "browser-message-001",
  "message": {
    "text": "Jag har tunt och färgat hår som blir fett snabbt men torra längder. Vilket schampo passar?"
  },
  "context": {
    "locale": "sv-SE",
    "channel": "web_widget"
  }
}
```

Foundation behavior:

- intent: `product_recommendation`;
- product type: `shampoo`;
- remembered needs include thin hair, color-treated hair, oily scalp and dry lengths;
- backend plans `search_products`, `analyze_product_suitability` and `get_product_live_facts`;
- no tool is executed;
- no product card is fabricated.

## Example: tracking

Request:

```json
{
  "contractVersion": "ai-arman-chat-v1",
  "clientMessageId": "browser-message-002",
  "message": {
    "text": "Varför har mitt paket inte kommit?"
  }
}
```

Foundation behavior:

- intent: `tracking_status`;
- `requiresIdentity` is true;
- no tracking tool is planned for execution before verification;
- the response asks for the approved verification flow;
- no order or shipment fact is returned.

## Error behavior

Current validation errors include:

```text
unsupported_chat_contract_version
client_message_id_required
message_text_required
message_text_too_long
browser_owned_field_rejected:<field>
```

The public API must later wrap these in a stable structured error envelope without exposing internal stack traces.

## Safety invariants

The following invariants are mandatory:

1. AI interprets; backend policy decides.
2. Conversation state is backend-owned.
3. Tool selection is backend-validated.
4. Browser input is never a source of authoritative product, order or customer facts.
5. Product cards require Product Intelligence approval and live facts.
6. Order and tracking cards require verified identity and authoritative data.
7. High-risk writes require a separate confirmation token, idempotency and audit trail.
8. The widget renders structured blocks, never free model HTML.
9. Missing facts fail closed.
10. Foundation placeholders must never be presented as completed actions.

## Not enabled by this contract

- public widget activation;
- language-model calls;
- database persistence;
- customer authentication;
- live Search Brain execution through this endpoint;
- Product Intelligence execution through this endpoint;
- Vendre order reads;
- nShift tracking reads;
- return or claim writes;
- customer-service messages;
- deployment or production traffic.
