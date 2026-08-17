# AI Arman — 1% live shadow checkpoint — 2026-08-17

## Scope

Repository: `arman573/harmoniq-backend`

Branch: `feature/ai-arman-foundation-v1`

Draft PR: #18

This checkpoint records the first verified tiny live-shadow boundary for AI Arman. It does **not** enable model promotion or public/customer-facing AI.

## Current Cloud Run traffic boundary

Service: `harmoniq-ai-arman-beta0`

Region: `europe-north1`

Canonical service URL: `https://harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

Traffic verified by GitHub Actions run `32062744315`:

- `99%` → deterministic revision `harmoniq-ai-arman-beta0-00002-2kq`
- `1%` → shadow revision `harmoniq-ai-arman-beta0-shadow-a979b694-2`
- `0%` → older candidate `harmoniq-ai-arman-beta0-shadow-80e88734-1`

Shadow tag: `shadow-a979b694-2`

Shadow immutable image digest:

`sha256:f28eff874264cdf72d3edc3f8d7cda9a7c4a8770f3254f4c240136900e151932`

## Security and authority state

Verified on the active 1% shadow gate:

- Service IAM remains private.
- Candidate is Ready.
- Candidate memory is `256Mi`.
- Candidate concurrency is `1`.
- Runtime identity is `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`.
- OpenAI API key is referenced from Secret Manager as `ai-arman-openai-api-key:1`; plaintext is never put in workflow configuration.
- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`.
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=true` on shadow.
- `AI_ARMAN_MODEL_SHADOW_ENABLED=true` on shadow.
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`.
- Deterministic/backend-owned response authority was verified against the tagged candidate before traffic mutation.
- The tagged candidate returned `deterministic_fallback`, `backend_policy`, no writes, no production actions and no model HTML acceptance.
- Widget preview remained `404`.
- Canonical authenticated foundation smoke passed after the 99/1 traffic split.

## Cost and capacity guardrails

Shadow provider limits remain deliberately tiny:

- provider calls/minute: `1`
- provider concurrency: `1`
- provider tokens/call: `1024`
- provider tokens/minute: `1024`
- estimated provider cost/call: max `$0.005`
- estimated provider cost/minute: max `$0.005`

Cloud Run service-level max instances is now `2`, because two revisions receive non-zero traffic. This service-level setting can be changed without deploying a new revision.

Do not increase this capacity casually. It is part of the current cost-safety boundary.

## First 1% attempt — intentionally failed closed

Workflow run: `32062507171`

The preflight and tagged candidate tests passed, but Cloud Run rejected the traffic mutation with:

`metadata.annotations[run.googleapis.com/maxScale]: service level max instances must be greater than or equal to the number of targets receiving traffic.`

At that time service-level max instances was `1`, while a 99/1 split requires two traffic-receiving revisions.

The workflow's rollback path executed successfully and explicitly restored:

- deterministic revision to `100%`
- shadow candidates to `0%`

No 1% boundary was accepted from that failed run.

## Fix and successful 1% gate

Workflow file:

`.github/workflows/ai-arman-model-live-shadow-1pct.yml`

Fix commit:

`c4b98be7f7eac4ebb3d80ac5403c7200210a1a71`

Successful workflow run:

`32062744315`

The corrected gate:

1. verifies exact 100/0 starting state and service max `1`,
2. verifies private IAM, candidate digest/config, Secret Manager and promotion OFF,
3. runs authenticated foundation + real chat smoke against the tagged 0% candidate,
4. requires deterministic/backend-owned response authority,
5. raises service-level max from `1` to `2`,
6. shifts exactly `1%` to the shadow tag,
7. verifies exact `99/1`, service max `2`, private IAM and promotion OFF,
8. runs authenticated canonical foundation smoke,
9. has a fail-closed rollback path that restores both `100%` deterministic traffic and service max `1` if any post-mutation gate fails.

Green markers from the successful run include:

- `LIVE_SHADOW_PREFLIGHT=PASS`
- `PRIVATE_IAM=PASS`
- `LIVE_TRAFFIC=100`
- `CANDIDATE_TRAFFIC=0`
- `SERVICE_MAX_BEFORE=1`
- `PROMOTION_OFF=PASS`
- `CANDIDATE_IMMUTABLE_DIGEST=PASS`
- `TAGGED_CANDIDATE_FOUNDATION=PASS`
- `TAGGED_CANDIDATE_DETERMINISTIC_AUTHORITY=PASS`
- `TAGGED_CANDIDATE_WIDGET_DISABLED=PASS`
- `SERVICE_MAX_AFTER=2`
- `ONE_PERCENT_SHIFT_COMMAND=PASS`
- `LIVE_SHADOW_TRAFFIC_BOUNDARY=PASS live=harmoniq-ai-arman-beta0-00002-2kq:99 candidate=harmoniq-ai-arman-beta0-shadow-a979b694-2:1`
- `SERVICE_MAX_DURING_SHADOW=2`
- `PRIVATE_IAM_AFTER_SHIFT=PASS`
- `PROMOTION_OFF_AFTER_SHIFT=PASS`
- `CANONICAL_SERVICE_AFTER_SHIFT=PASS`

Rollback was skipped on the successful run because no post-mutation gate failed.

## Foundation CI at the live-shadow checkpoint

GitHub Actions foundation CI run `32062748420` completed successfully for commit `c4b98be7f7eac4ebb3d80ac5403c7200210a1a71`.

Verified stages:

- install dependencies: PASS
- unit tests: PASS
- TypeScript build: PASS
- isolated candidate container build: PASS
- isolated candidate container smoke: PASS

The prior authority checkpoint also had 80/80 test suites and 542/542 tests green with zero npm audit vulnerabilities.

## Prior real provider authority proof

Before the 1% traffic boundary, isolated authority workflow run `32061242042` succeeded.

Execution: `ai-arman-shadow-authority-32061242042-66xpp`

Verified markers:

- `MODEL_SHADOW_PROVIDER_CALL=PASS`
- `DETERMINISTIC_RESPONSE_AUTHORITY=PASS`
- `MODEL_PROMOTION=OFF`
- `CUSTOMER_TRAFFIC=NONE`
- temporary Cloud Run Job cleanup: PASS

This proves a real OpenAI shadow call can complete while deterministic/backend-owned response authority remains intact when promotion is OFF.

## Hard stop / next-step rule

Do **not** automatically increase shadow traffic above `1%`.

Do **not** enable `AI_ARMAN_MODEL_PROMOTION_ENABLED`.

Do **not** enable the public/customer-facing widget.

Do **not** loosen provider call, token, concurrency or USD limits without a separate reviewed gate.

The next safe phase should be read-only observation/verification of the 1% boundary and its provider behavior. Any later increase in traffic or any model promotion must be a separate explicit decision with its own rollback and cost controls.

## Working rule

Arman should not be used as a code copier or GitHub intermediary. Continue to perform GitHub changes, Actions execution, log inspection, testing and cleanup directly through available tools. Ask Arman to perform a manual action only when it is genuinely unavailable through the tools.
