# AI Arman customer widget frontend v1

Status: source implementation for the canonical customer widget frontend.

Canonical branch: `feature/ai-arman-foundation-v1`

## Goal

Provide one customer-facing AI Arman widget that can later be controlled by the customer-admin module without introducing a second frontend stack or bypassing the existing customer gateway.

## Canonical path

`harmoniq.se -> customer widget.js -> customer gateway -> verified session -> customer chat contract -> verified backend facts -> customer-safe response blocks`

The widget does not inherit admin authority.

## UI contract

Presentation contract: `ai-arman-customer-ui-v1`.

The frontend contains:

- fixed bottom-right launcher;
- dedicated AI Arman avatar slot with initials fallback;
- responsive desktop panel and mobile sheet;
- Shadow DOM isolation from storefront CSS;
- welcome and capability overview;
- email + one-time-code verification flow;
- verified chat state;
- bounded quick prompts;
- typing state, error notices and expired-session recovery;
- keyboard Escape close, Enter-to-send and accessibility labels;
- reduced-motion and safe-area handling.

No model/customer text is rendered as HTML. Dynamic text uses `textContent` only.

## Existing authority boundary preserved

The frontend keeps the existing routes only:

- `POST /ai-arman/customer/identity/start`
- `POST /ai-arman/customer/identity/verify`
- `POST /ai-arman/customer/chat/messages`

A chat request is not made until a verified customer session token exists. Session material remains in `sessionStorage`, not `localStorage`.

No admin action, arbitrary internal API call, order mutation, return mutation, payment mutation or other new write is added by this frontend phase.

## Presentation contract for the next customer-admin module

`AiArmanCustomerWidgetPresentationV1` separates presentation from authority. The next admin module may manage bounded presentation values such as:

- assistant/launcher copy;
- welcome copy;
- identity copy;
- composer placeholder;
- quick prompts;
- approved avatar URL.

Changing presentation must never grant new customer data access or admin/write authority. Backend facts and permissions remain backend-owned.

The script also supports integration-level `data-api-base` and `data-avatar-url` overrides. These are presentation/routing hooks only and must not be used to inject customer facts or admin capability.

## Current activation rule

The existing `AI_ARMAN_CUSTOMER_WIDGET_ENABLED` and identity/session gates remain authoritative. This frontend source change does not by itself turn the widget on in production.
