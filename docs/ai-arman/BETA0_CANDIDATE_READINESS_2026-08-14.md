# AI Arman Beta 0 candidate readiness — 2026-08-14

## Status

AI Arman Beta 0 is code-ready for a controlled candidate environment, but it is **not deployed, not merged and not enabled in production**.

The current candidate foundation is intentionally fail-closed. Existing credentials alone cannot activate model interpretation, model shadow execution, promotion, or the widget preview.

## Current branch and review state

- Repository: `arman573/harmoniq-backend`
- Branch: `feature/ai-arman-foundation-v1`
- Draft PR: #18
- Production traffic: unchanged
- Widget preview: default disabled
- Model interpretation: default disabled
- Model shadow: default disabled
- Model promotion: default disabled
- Production writes: disabled

## Candidate safety gates

A candidate must treat these controls as independent gates.

| Capability | Required configuration | Default | Effect |
| --- | --- | --- | --- |
| Beta 0 preview route | `AI_ARMAN_WIDGET_PREVIEW_ENABLED=true` | off | Makes `/ai-arman/widget/beta0-preview` available instead of 404 |
| Model interpretation client | `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=true` + `OPENAI_API_KEY` + valid `AI_ARMAN_OPENAI_MODEL` | off | Allows the model interpretation client to be usable when invoked |
| Model shadow execution | `AI_ARMAN_MODEL_SHADOW_ENABLED=true` | off | Allows deterministic chat processing to run the interpretation provider in shadow |
| Model semantic promotion | `AI_ARMAN_MODEL_PROMOTION_ENABLED=true` | off | Allows only policy-approved semantic fields from a valid model candidate to be promoted |

**Important:** enabling interpretation credentials does not enable shadow. Enabling shadow without valid interpretation configuration cannot create a valid model result. Enabling shadow does not enable promotion. The preview can be enabled while the model remains fully off.

## Recommended staged candidate sequence

### Stage 0 — deterministic widget candidate

Enable only:

- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=true`

Keep model interpretation, shadow and promotion off.

Verify:

1. `/ai-arman/widget/beta0-preview` loads.
2. Free-text messages reach `/ai-arman/chat/messages`.
3. The widget preserves `conversationId` between turns.
4. Only `ai-arman-chat-v1` responses are rendered.
5. Unknown or malformed response contracts fail closed.
6. Product, order and tracking data are never invented by the widget.
7. Outbound card links are rendered only for credential-free absolute HTTPS URLs.
8. No model/API call is made by merely loading the preview.

### Stage 1 — model shadow candidate

After Stage 0 is verified, additionally enable:

- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=true`
- `AI_ARMAN_MODEL_SHADOW_ENABLED=true`
- `AI_ARMAN_OPENAI_MODEL=<explicit approved model>`
- `OPENAI_API_KEY=<secret>`

Keep:

- `AI_ARMAN_MODEL_PROMOTION_ENABLED` off

Expected behavior:

- Deterministic backend output remains customer-facing authority.
- The model may interpret the same customer message in shadow.
- Shadow output is validated and compared but cannot alter the customer-facing semantic interpretation while promotion is disabled.
- Backend tool and identity policy remains authoritative.
- Shadow budget, timeout, concurrency, token and cost limits remain enforced.

### Stage 2 — guarded model promotion candidate

Only after Stage 1 comparison quality is acceptable, additionally enable:

- `AI_ARMAN_MODEL_PROMOTION_ENABLED=true`

Expected behavior:

- Only the guarded semantic subset may be promoted.
- Order references, verified identity facts and security-critical fields remain deterministic/backend-owned.
- Backend recomputes tool policy after promotion.
- Identity-required intents still require verified identity before protected reads.
- Production writes remain disabled.

## Shadow limits

Default shadow limits are conservative and may be tuned only within hard clamps:

| Limit | Default | Clamp |
| --- | ---: | ---: |
| Provider timeout | 1500 ms | 500–10000 ms |
| Calls/minute | 30 | 1–300 |
| Concurrent calls | 2 | 1–20 |
| Tokens/call | 4096 | 256–32768 |
| Tokens/minute | 30000 | 256–500000 |
| Estimated cost/call | USD 0.02 | USD 0.001–1.00 |
| Estimated cost/minute | USD 0.10 | USD 0.001–10.00 |

Optional tuning variables:

- `AI_ARMAN_MODEL_SHADOW_PROVIDER_TIMEOUT_MS`
- `AI_ARMAN_MODEL_SHADOW_MAX_CALLS_PER_MINUTE`
- `AI_ARMAN_MODEL_SHADOW_MAX_CONCURRENT_CALLS`
- `AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_CALL`
- `AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_MINUTE`
- `AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_CALL`
- `AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_MINUTE`

## Widget contract and renderer guarantees

The Beta 0 preview:

- sends `ai-arman-chat-v1` requests;
- uses channel `internal_preview`;
- limits user input to 2000 characters;
- stores only the returned conversation identifier in widget runtime memory;
- uses DOM `textContent` for dynamic text;
- never accepts model-provided HTML;
- refuses incompatible response contract versions;
- renders only known structured block types;
- filters outbound links to credential-free HTTPS URLs;
- returns 404 unless explicitly enabled;
- sends `no-store` and `noindex/nofollow/noarchive` headers.

## Anonymous versus authenticated coverage

The current preview posts to the anonymous endpoint `/ai-arman/chat/messages`.

It can safely exercise:

- free-text conversation;
- deterministic/model interpretation flow;
- before-purchase discovery/recommendation journey where configured read dependencies are available;
- identity-required intent detection;
- safe prompts telling the customer that verified identity is required.

It **cannot by itself prove authenticated order/tracking reads** because those flows are exposed through `/ai-arman/chat/messages/authenticated` and require the existing JWT-authenticated customer context. Do not weaken this boundary for the preview.

Before a public widget claims authenticated order/tracking capability, the storefront integration must intentionally bridge the existing authenticated customer session to the authenticated AI Arman endpoint. Free-text order numbers must never substitute for authentication.

## Candidate test conversations

Use separate conversations for these checks:

1. `Hej` — safe greeting and no tool execution.
2. `Hjälp mig välja schampo` — asks useful follow-up questions instead of inventing a product.
3. `Jag har slitet och frissigt hår och behöver schampo` — preserves deterministic needs and recommendation policy.
4. `Var är mitt paket?` — detects tracking intent but does not expose tracking without verified identity.
5. `Vad händer med order 90250?` — order reference alone must not establish identity.
6. `Jag vill reklamera en produkt` — guidance only; no claim approval or write.
7. A deliberately malformed/unsupported response in automated testing — widget fails closed rather than rendering unknown data.

## Candidate acceptance criteria

A candidate is acceptable for controlled internal testing only if all of these hold:

- exact-head unit tests pass;
- exact-head TypeScript build passes;
- preview is still default-off in source;
- model shadow is still default-off in source;
- promotion is still default-off in source;
- no production traffic changes have occurred;
- no write capability has been enabled;
- anonymous order/tracking requests remain identity-gated;
- model errors/timeouts fail closed to deterministic/backend-controlled behavior;
- no secret is exposed in logs, HTML or repository content.

## Next environment action — approval required

The next environment-changing step is a **controlled candidate deployment**, ideally with zero production traffic or an otherwise isolated candidate URL, initially using Stage 0 deterministic widget settings only.

That step must not be performed merely because the code is green. It requires explicit approval immediately before changing deployment/environment configuration.
