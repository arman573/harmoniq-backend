# AI Arman – customer widget foundation latest

## Status

The customer-facing AI Arman widget foundation is implemented on `feature/ai-arman-foundation-v1` and remains **not live**.

Latest verified gateway CI before this checkpoint:

- workflow: `AI Arman foundation CI`
- run: `32262628403`
- unit tests: PASS
- TypeScript build: PASS
- isolated AI candidate container: PASS
- isolated AI candidate smoke: PASS
- isolated customer gateway container: PASS
- customer gateway HTTP boundary smoke: PASS

No production traffic, public IAM, model promotion, production write, or customer email was activated by this work.

## Customer flow implemented

1. Customer opens the AI Arman frontend widget.
2. Chat input is locked until identity verification succeeds.
3. Customer enters an email address.
4. Backend generates a six-digit OTP and stores only a salted SHA-256 digest of the code.
5. Gmail OTP delivery is behind `AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED=true` and fails closed otherwise.
6. Customer submits the OTP.
7. Only after the OTP is correct does backend verify the normalized email against the Vendre customer directory.
8. Vendre directory verification is behind `AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED=true` and fails closed otherwise.
9. Only a verified Vendre customer receives a short-lived signed AI Arman session.
10. `/ai-arman/customer/chat/messages` rejects missing, invalid, or expired sessions before parsing or executing a chat request.
11. The customer widget uses `sessionStorage`, not `localStorage`, and renders backend text through `textContent` only.

## Security boundaries implemented

- Widget master flag: `AI_ARMAN_CUSTOMER_WIDGET_ENABLED`
- Identity master flag: `AI_ARMAN_CUSTOMER_IDENTITY_ENABLED`
- Session signing secret: `AI_ARMAN_CUSTOMER_SESSION_SECRET` (minimum 32 characters)
- OTP default TTL: 10 minutes
- Customer session default TTL: 30 minutes
- OTP max verification attempts: 5
- OTP resend cooldown: 60 seconds
- OTP max sends per normalized email: 3 per 15 minutes
- global OTP send cap: 30 per minute per gateway instance
- rate limiter keys hash normalized emails instead of storing plaintext email keys
- customer directory is checked only after correct OTP, reducing customer-enumeration leakage
- raw model HTML is never accepted by the widget
- frontend never trusts browser-owned `customerId` or DOM customer identity

## Customer gateway isolation

A separate gateway entrypoint/container now exists:

- `src/main-ai-arman-customer-gateway.ts`
- `src/ai-arman-customer-gateway.module.ts`
- `Dockerfile.ai-arman-customer-gateway`

The HTTP boundary exposes only:

- `GET /health`
- `GET /ai-arman/customer/widget.js`
- `POST /ai-arman/customer/identity/start`
- `POST /ai-arman/customer/identity/verify`
- `POST /ai-arman/customer/chat/messages`

Stateful POST requests require the exact browser origin `https://harmoniq.se` or `https://www.harmoniq.se`.

The gateway explicitly returns 404 for internal/non-customer routes including:

- `/ai-arman/foundation`
- `/ai-arman/internal-preview`
- `/ai-arman/internal-preview/diagnostics`
- `/ai-arman/widget/beta0-preview`
- `/ai-arman/chat/messages`
- legacy `/auth/login`

This lets the customer gateway become a separately controlled public surface later without making the existing private AI Arman service or internal diagnostics public.

## External adapters implemented but default OFF

### Vendre customer directory

`VendreCustomerDirectoryVerificationProvider` uses the established Vendre pattern:

- HTTPS base URL from `VENDRE_API_BASE_URL`
- API key from `VENDRE_API_KEY`
- `GET /API/1/customer?match=<normalized-email>`
- exact normalized email match required in returned customer data
- bounded response body
- short timeout
- no PII response logging
- explicit activation flag required

### Gmail OTP delivery

`GmailCustomerEmailOtpSender` uses Gmail REST via OAuth refresh-token flow with built-in `fetch`; no new `googleapis` runtime dependency was added.

It requires:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `AI_ARMAN_CUSTOMER_OTP_FROM_EMAIL` or existing Gmail outbound/inbound email config
- explicit `AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED=true`

Only the six-digit OTP and expiry guidance are sent. OAuth credentials are never included in the message payload.

## Read-only GCP configuration inventory

See `docs/ai-arman/CUSTOMER_GATEWAY_SECRET_REFERENCE_INVENTORY_LATEST.md`.

Verified without reading secret values:

- current AI Arman service has no Vendre/Gmail/customer-session-secret configuration
- returns service has `VENDRE_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` as Secret Manager references
- returns service has Vendre base URL and Gmail email settings as plain configuration values, with the values intentionally redacted from the inventory document

The one-shot inventory workflow was removed immediately after use.

## Important current limitation

The new identity session gates access to AI Arman, but the customer chat route currently uses the general safe conversation orchestrator. It does **not yet** map the verified customer principal into authenticated order/tracking/returns reads. This is intentional: no fake legacy numeric user ID is created and no browser identity is trusted.

A later patch must introduce an explicit verified-customer principal path before personalized order, tracking, purchased-product, or return data is unlocked.

## Next safe steps

1. Run exact-head CI after this checkpoint and cleanup.
2. Perform a read-only IAM/preflight to determine whether ChatGPT-controlled deployment identity can safely create or attach a dedicated customer-gateway runtime identity and a new session-signing Secret Manager secret.
3. Do not reuse Gmail/Vendre secret values; reference existing Secret Manager secrets only if the dedicated gateway runtime has explicit least-privilege access.
4. Build a private 0%-traffic customer-gateway candidate first.
5. Verify widget script, gateway route isolation, identity flags, no public IAM, and no live traffic changes.
6. Only then wire private candidate OTP/Vendre references and perform a controlled synthetic/owned-email E2E test.
7. Before any public customer exposure, add the final public-ingress anti-bot control and decide the same-origin `harmoniq.se` routing/proxy design.
8. Public exposure requires a separate explicit approval; the existing private AI Arman service must remain private.
