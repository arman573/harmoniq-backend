# AI Arman - Initial Tool Registry

Status: Foundation contract
Date: 2026-08-04

Every tool is a backend-owned function with a strict request and response schema. The language model may select and populate an allowed tool, but it cannot construct arbitrary upstream API calls.

| Tool | Purpose | Identity | Risk | Confirmation |
| --- | --- | --- | --- | --- |
| `search_products` | Retrieve catalog candidates by structured need | Anonymous allowed | LOW | No |
| `analyze_product_suitability` | Evaluate designation and INCI evidence | Anonymous allowed | LOW | No |
| `get_product_live_facts` | Read current price, stock, status and URL | Anonymous allowed | LOW | No |
| `get_personalization_signals` | Read bounded Hello Retail ranking signals | Customer ID only when lawfully available | LOW | No |
| `get_order` | Read one verified order | Order verification or login | MEDIUM | No |
| `get_tracking_status` | Read shipment and tracking facts | Order verification or login | MEDIUM | No |
| `get_case_status` | Read an existing customer case | Verified customer | MEDIUM | No |
| `prepare_return_case` | Validate answers and prepare deterministic summary | Verified customer | MEDIUM | No |
| `create_return_case` | Submit return through Returns Module | Verified customer | HIGH | Yes |
| `prepare_claim_case` | Validate claim data and prepare summary | Verified customer | MEDIUM | No |
| `create_claim_case` | Submit claim through Returns Module | Verified customer | HIGH | Yes |
| `create_missing_item_case` | Submit missing-item case | Verified customer | HIGH | Yes |
| `create_wrong_item_case` | Submit wrong-item case | Verified customer | HIGH | Yes |
| `send_case_message` | Send a message within an existing case | Verified customer | HIGH | Yes |
| `handoff_to_customer_service` | Create a human-readable handoff with transcript summary | Context dependent | MEDIUM or HIGH | When it creates or sends data |

## Tool envelope

Every registered tool must declare:

```ts
type ToolPolicy = {
  name: string;
  version: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredIdentity: 'ANONYMOUS' | 'ORDER_VERIFIED' | 'AUTHENTICATED_CUSTOMER' | 'ADMIN';
  requiresConfirmation: boolean;
  idempotent: boolean;
  timeoutMs: number;
  allowedInputFields: readonly string[];
  redactedLogFields: readonly string[];
};
```

## Ownership boundaries

- Search Brain owns search orchestration, candidate retrieval and navigation intelligence.
- Product Data Pipeline and Ingredient Intelligence own product designation, INCI-derived evidence, category and tag facts.
- Hello Retail owns bounded behavioral personalization signals.
- Vendre owns current operational product and order facts.
- Returns Module owns return, claim, missing-item and wrong-item workflows and their deterministic rules.
- AI Arman owns interpretation, orchestration and customer-facing explanation.

## Recommendation sequence

```text
search_products
  -> analyze_product_suitability
  -> reject failed gates and blockers
  -> assign quality tiers
  -> get_personalization_signals within tier
  -> get_product_live_facts
  -> explain recommendations
```

## After-purchase sequence

```text
verify identity
  -> get_order / get_tracking_status
  -> collect structured answers
  -> prepare case
  -> display deterministic confirmation
  -> execute confirmed create tool
  -> return case ID and next step
```
