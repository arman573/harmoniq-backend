# AI Arman live durable audit activation gate — 2026-08-18

## Status

This checkpoint prepares the next production gate only. It is **not** approval to change live traffic or enable durable audit on the live 1% shadow.

Current verified production boundary remains:

- Deterministic revision: `harmoniq-ai-arman-beta0-00002-2kq` at 99%
- Existing live shadow revision: `harmoniq-ai-arman-beta0-shadow-a979b694-2` at 1%
- Model promotion: false
- Widget preview: false
- Service remains private
- Service max instances: 2
- Durable audit is not enabled on the existing live shadow revision

## Evidence already completed

### Durable audit transport

The isolated temporary Cloud Run Job transport smoke passed:

- Cloud Logging roundtrip: PASS
- Privacy allowlist: PASS
- Temporary job cleanup: PASS
- No customer traffic
- No live service mutation
- No model provider call in the transport-only smoke

### Real shadow candidate

The real `POST /ai-arman/chat/messages` shadow path was verified on a separate 0%-traffic revision:

- Candidate revision: `harmoniq-ai-arman-beta0-durable-20ff1996-1`
- Candidate traffic: 0%
- Immutable image digest: `sha256:0f9c7b718c0457f231af770aa82b18f5c2bbe02ecfe295cd5b6647ca249661a0`
- Durable audit: enabled on candidate only
- Model promotion: false
- Widget preview: false
- Customer-facing authority remained deterministic
- OpenAI durable audit entry: verified
- Privacy allowlist: verified
- Production remained 99% deterministic / 1% existing shadow / 0% candidate

### Candidate quality matrix

GitHub Actions run `32188087699` measured eight synthetic Swedish intent cases on the 0%-traffic candidate.

Result:

- Cases attempted: 8
- Provider calls completed: 8
- Valid model candidates: 8
- Primary-intent matches vs deterministic backend: 8/8
- Total estimated provider cost: about USD 0.0067

Covered intents:

- greeting
- product_recommendation
- tracking_status
- order_status
- return_help
- claim_help
- human_handoff
- purchased_product_usage

This is candidate-quality evidence only. It is not promotion approval.

### Exact-head CI

After the temporary quality-matrix push trigger was removed, foundation CI run `32189638317` passed on commit `39a2be689958ed993574747ad14e41d1ad0efd23`:

- Unit tests: PASS
- TypeScript build: PASS
- Isolated candidate container build: PASS
- Isolated candidate smoke: PASS

## Safest activation design

If live durable audit is explicitly approved later, do **not** rebuild or silently replace the current live shadow with unverified source.

The minimal change is to reuse the already verified immutable 0%-traffic candidate revision and move the existing 1% shadow traffic to it:

Before:

- `harmoniq-ai-arman-beta0-00002-2kq`: 99%
- `harmoniq-ai-arman-beta0-shadow-a979b694-2`: 1%
- `harmoniq-ai-arman-beta0-durable-20ff1996-1`: 0%

Proposed after explicit approval:

- `harmoniq-ai-arman-beta0-00002-2kq`: 99%
- `harmoniq-ai-arman-beta0-durable-20ff1996-1`: 1%
- old shadow revision: 0%

No traffic above 1% is permitted by this gate.

## Mandatory preflight immediately before any live traffic change

A live activation workflow must fail closed unless all of the following are still true at execution time:

1. Service is private; no `allUsers` or `allAuthenticatedUsers` binding exists.
2. Current traffic is exactly 99% deterministic / 1% existing shadow / 0% durable candidate.
3. Service max instances is exactly 2.
4. Existing live shadow still has:
   - model interpretation true
   - shadow true
   - promotion false
   - widget false
   - durable audit not true
5. Durable candidate is Ready and still uses immutable digest `sha256:0f9c7b718c0457f231af770aa82b18f5c2bbe02ecfe295cd5b6647ca249661a0`.
6. Durable candidate still has:
   - model interpretation true
   - shadow true
   - promotion false
   - widget false
   - durable audit true
   - one provider call/minute
   - one concurrent provider call
   - max 1024 tokens/call
   - max 1024 tokens/minute
   - max USD 0.005/call
   - max USD 0.005/minute
7. Runtime service account and OpenAI secret reference remain unchanged.
8. The exact explicit live approval string is supplied manually.

## Post-change verification required

After a future approved 1% switch, the workflow must verify:

- deterministic revision remains 99%
- durable candidate is exactly 1%
- old shadow is 0%
- service remains private
- service max instances remains 2
- promotion remains false
- widget remains false
- deterministic customer authority remains unchanged
- one synthetic authenticated request to the tagged revision succeeds
- a durable OpenAI audit event is readable through the dedicated telemetry identity
- privacy allowlist still holds
- no customer text or client message ID appears in the durable audit payload

## Rollback rule

If any post-change check fails after traffic was changed, immediately restore:

- `harmoniq-ai-arman-beta0-00002-2kq`: 99%
- `harmoniq-ai-arman-beta0-shadow-a979b694-2`: 1%
- durable candidate: 0%

Then verify private IAM and service max instances again.

## Hard stops

This gate does **not** authorize:

- more than 1% model shadow traffic
- model promotion
- widget/public access
- public Cloud Run IAM
- relaxed provider budgets
- higher concurrency
- higher service max instances
- writes, refunds, order changes or other production actions
- using synthetic 8/8 quality results as sole promotion evidence

A later live activation must require an explicit user instruction equivalent to `kör live` before the manual workflow is executed.
