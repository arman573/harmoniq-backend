# AI Arman — Tool Registry

Status: Current architecture
Updated: 2026-08-20

Every AI Arman tool is a backend-owned capability with a strict request/response contract and an explicit trust boundary. Model output may express intent and structured arguments, but backend orchestration decides which named capability is eligible to run. The model must never construct arbitrary upstream URLs, HTTP methods or mutation payloads.

## Customer-facing capabilities

Customer tools remain identity-scoped and must never inherit admin authority.

| Capability | Purpose | Identity | Risk | Confirmation |
| --- | --- | --- | --- | --- |
| `search_products` | Retrieve catalog candidates by structured need | Anonymous allowed | LOW | No |
| `analyze_product_suitability` | Evaluate designation and INCI evidence | Anonymous allowed | LOW | No |
| `get_product_live_facts` | Read current price, stock, status and URL | Anonymous allowed | LOW | No |
| `get_personalization_signals` | Read bounded Hello Retail ranking signals | Customer ID only when lawfully available | LOW | No |
| `get_order` | Read one verified order | Order verification or login | MEDIUM | No |
| `get_tracking_status` | Read shipment/tracking facts | Order verification or login | MEDIUM | No |
| `get_case_status` | Read an existing customer case | Verified customer | MEDIUM | No |
| `prepare_return_case` | Validate answers and prepare deterministic summary | Verified customer | MEDIUM | No |
| `create_return_case` | Submit return through Returns Module | Verified customer | HIGH | Yes |
| `prepare_claim_case` | Validate claim data and prepare summary | Verified customer | MEDIUM | No |
| `create_claim_case` | Submit claim through Returns Module | Verified customer | HIGH | Yes |
| `create_missing_item_case` | Submit missing-item case | Verified customer | HIGH | Yes |
| `create_wrong_item_case` | Submit wrong-item case | Verified customer | HIGH | Yes |
| `send_case_message` | Send a message within an existing case | Verified customer | HIGH | Yes |
| `handoff_to_customer_service` | Create a human-readable handoff | Context dependent | MEDIUM/HIGH | When it creates or sends data |

These customer capabilities must continue to use verified customer identity/session and customer-safe projections. They must not call the full-admin gateway simply because that gateway exists.

## Admin capabilities

The canonical return/reclamation admin path is:

```text
admin intent
  -> deterministic command/policy layer or resolver
  -> named typed admin action
  -> ReturnsAdminGatewayClient
  -> returns full-admin gateway
  -> existing returns admin route/domain logic
```

Current permanent typed admin actions:

| Action | Purpose | Access | Approval / decision boundary |
| --- | --- | --- | --- |
| `case.read` | Read the authoritative case | READ | No |
| `case.order_context.read` | Read authoritative live order + tracking context | READ | No |
| `case.customer_message.send` | Send a reviewed customer message through the real returns communication path | WRITE | Explicit admin approval |
| `case.pause` | Set work queue to waiting | WRITE | Explicit admin approval |
| `case.complete` | Set work queue to completed | WRITE | Explicit admin approval |
| `case.return_status.set` | Set one exact allowed return status; Returns owns GCS/Vendre/pre-dispatch guards | WRITE | Explicit admin approval + human decision |
| `case.product_decision.set` | Persist one product decision (`pending/approved/rejected`) | WRITE | Explicit admin approval + human decision; rejection requires reason |
| `case.return_label.create` | Create a real return label using authoritative case/Vendre data | WRITE/EXTERNAL | Explicit admin approval + human decision |

The gateway itself can technically forward the admin methods supported by the Returns Module, but that raw capability is not a model tool. New admin functionality must be introduced as another named typed action with a fixed route, fixed payload semantics, tests and policy.

The controlled resolver is documented in `ADMIN_CASE_RESOLVER_V1.md`. Its `prepare` phase is read-only. Its `execute` phase accepts one allowlisted action, requires `approved:true`, and reads the case back after a successful write.

## Tool/action envelope

Every registered capability should declare equivalent policy metadata:

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

For admin writes, `requiresConfirmation` maps to deterministic explicit-admin-approval semantics in backend policy. Technical write capability alone is not sufficient to execute a mutation. Sensitive return/product decisions are treated as human decisions that AI Arman may execute only after explicit approval; the model does not independently approve/deny them.

## Ownership boundaries

- Search Brain owns search orchestration, candidate retrieval and navigation intelligence.
- Product Data Pipeline and Ingredient Intelligence own product designation, INCI-derived evidence, category and tag facts.
- Hello Retail owns bounded behavioral personalization signals.
- Vendre owns current operational product and order facts.
- Returns Module owns return/claim workflows, stored case state and the authenticated admin routes that perform return-domain writes.
- AI Arman owns interpretation, orchestration, typed action policy and the explanation/discussion/resolver layer.

AI Arman should reuse existing authenticated backend routes instead of duplicating Vendre, GCS, Gmail, nShift or tracking write logic.

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

## Customer after-purchase sequence

```text
verify customer identity
  -> get_order / get_tracking_status
  -> collect structured answers
  -> prepare customer action
  -> obtain required confirmation
  -> execute allowed customer-scoped action
  -> return verified result
```

## Admin case resolver sequence

```text
prepare(caseId)
  -> authoritative case.read
  -> authoritative case.order_context.read when available
  -> bounded AI analysis + optional customer reply draft
  -> show supported named actions
  -> no write

execute(one action, approved=true)
  -> validate action-specific input
  -> execute one typed admin action
  -> Returns Module applies its own domain guards + side effects
  -> case.read post-write verification
  -> distinguish writeExecuted from verifiedAfterWrite
```

Refunds, compensation, order cancellation, payment changes and unrestricted arbitrary mutations are not resolver actions simply because the full-admin gateway could technically reach admin routes.

See `ADMIN_ACCESS_ARCHITECTURE_CURRENT.md` for the current full-admin production boundary and configuration rules.
