# AI Arman outbound autonomy rollout

Updated: 2026-08-21

## Product decision

Roll out AI Arman customer communication in two distinct stages. Promotion between stages must be an explicit operational change; it must never happen implicitly because the resolver was deployed.

## Stage 1 — approval required (CURRENT TARGET)

AI Arman may:

- read verified case/order context;
- analyze the case;
- draft a customer reply;
- propose named supported actions.

Before any customer reply is sent, an administrator must:

1. review the actual reply text;
2. explicitly mark the reply as reviewed;
3. explicitly approve the next execute action;
4. trigger the send.

Existing resolver rules remain authoritative:

- `approved` must be exactly `true`;
- one typed action per execute request;
- unknown/generic actions are rejected;
- no autonomous customer message is sent;
- human decision actions remain human decisions.

This is the launch mode.

## Stage 2 — autonomous customer replies (FUTURE, NOT ENABLED)

After enough reviewed production examples show acceptable quality, AI Arman may be promoted to autonomous sending for a deliberately limited class of low-risk customer replies.

Autonomous customer communication must be a separate feature/promotion path from the existing human-approved resolver execute path. It must not be implemented by silently treating model output as `approved:true`.

Initial autonomous scope should be customer communication only and only when all policy gates pass. Examples of required gates:

- authoritative case and order context available;
- no missing facts required to answer correctly;
- model indicates no human decision is required;
- reply confidence/policy classification is inside an allowed threshold;
- reply contains no unsupported promise, refund, compensation, replacement, cancellation, payment decision or other high-impact commitment;
- action belongs to an explicit autonomous allowlist;
- audit record captures input facts, generated reply, policy result and send result;
- automatic fallback to Stage 1 when any gate is uncertain or fails.

## Actions that remain human-controlled when Stage 2 starts

Do not interpret “autonomous customer replies” as unrestricted admin autonomy.

The following remain human-controlled until separately designed and promoted:

- claim/product approval or rejection;
- return-status choices that encode a human business decision;
- return-label creation where policy or eligibility needs a human decision;
- refunds;
- compensation/goodwill;
- replacement/reshipment decisions;
- payment/order changes;
- cancellations;
- any arbitrary internal API call.

## Promotion rule

Stage 2 requires a separate explicit configuration/deployment change plus its own verification. A normal resolver deploy must preserve Stage 1 behavior.

Until that promotion is deliberately performed, the expected production behavior is:

`AI Arman drafts -> admin reviews -> admin approves -> AI Arman sends`

Future promoted behavior for eligible low-risk replies becomes:

`AI Arman reads verified facts -> policy gates pass -> AI Arman sends -> full audit`

Anything outside the autonomous allowlist falls back to Stage 1.
