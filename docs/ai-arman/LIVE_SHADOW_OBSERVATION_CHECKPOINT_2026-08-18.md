# AI Arman live-shadow observation checkpoint — 2026-08-18

## Scope

This checkpoint covers the first read-only observation pass after AI Arman was placed at 1% live-shadow traffic.

No Cloud Run traffic increase, model promotion, widget activation, public IAM, or customer-facing AI authority change was performed in this observation work.

## Live boundary verified

GitHub Actions run `32156034886` authenticated through the existing branch-scoped WIF identity and successfully verified the current Cloud Run boundary before attempting metrics collection.

Verified state:

- service: `harmoniq-ai-arman-beta0`
- deterministic revision: `harmoniq-ai-arman-beta0-00002-2kq`
- deterministic traffic: **99%**
- shadow revision: `harmoniq-ai-arman-beta0-shadow-a979b694-2`
- shadow traffic: **1%**
- service-level max instances: **2**
- public IAM: **absent**
- `AI_ARMAN_MODEL_PROMOTION_ENABLED`: **false**
- `AI_ARMAN_WIDGET_PREVIEW_ENABLED`: **false**
- candidate immutable digest: `sha256:f28eff874264cdf72d3edc3f8d7cda9a7c4a8770f3254f4c240136900e151932`

The boundary step emitted:

- `LIVE_SHADOW_BOUNDARY=PASS`
- `PRIVATE_IAM=PASS`
- `PROMOTION_OFF=PASS`
- `WIDGET_OFF=PASS`
- `IMMUTABLE_DIGEST=PASS`

## Observation implementation

Workflow:

`.github/workflows/ai-arman-live-shadow-observe.yml`

The workflow is intentionally non-mutating toward Cloud Run. It contains no `gcloud run services update`, `gcloud run services update-traffic`, deploy, revision update, or IAM mutation command.

It verifies the live boundary first and then attempts to read Cloud Run revision request metrics through Cloud Monitoring.

The latest machine-written observation record is:

`docs/ai-arman/LIVE_SHADOW_OBSERVATION_LATEST.md`

## Metrics result

Cloud Monitoring request metrics could **not** be read by the existing GitHub deployer identity.

Exact result from run `32156034886`:

- Cloud Monitoring HTTP response: **403**
- message: `Permission denied (or the resource may not exist).`

This failure occurred only in the metrics-read step, after the live boundary checks had already passed.

It is therefore an **observation-permission limitation**, not evidence of a Cloud Run runtime failure or model-provider failure.

No request-count or 5xx totals should be inferred from this failed metrics query.

## Important audit limitation discovered

The current application shadow audit implementation uses `InMemoryChatInterpretationShadowAuditStore` with a 24-hour TTL and a maximum of 500 records.

That means it is process-local and not a durable cross-revision production telemetry source. It should not be treated as sufficient evidence for a later promotion decision.

## IAM decision

No new GCP IAM role was granted during this work.

In particular, the existing GitHub deployer was **not** given broader Monitoring Viewer / Logging Viewer permissions merely to make the observation workflow pass.

This preserves the current least-privilege boundary.

A separate, narrowly scoped observation identity or another durable telemetry mechanism should be designed before any traffic increase or model promotion decision.

## PR/WIF note

A temporary `pull_request` trigger was tested only to make the observation run visible through the available GitHub connector. The existing WIF provider correctly rejected the PR ref with `unauthorized_client` because its attribute condition is branch-scoped.

No GCP action occurred in that failed PR run.

The workflow was then returned to branch `push` / `workflow_dispatch` execution so it uses the already-approved branch-ref WIF path. The WIF condition was not loosened.

## Hard stop remains

Until durable observation evidence exists:

- do **not** increase shadow traffic above 1%
- do **not** enable `AI_ARMAN_MODEL_PROMOTION_ENABLED`
- do **not** enable the widget or public access
- do **not** add `allUsers` or `allAuthenticatedUsers`
- do **not** loosen provider call/token/cost budgets
- do **not** reduce the rollback safeguards
- do **not** treat model output as customer authority

## Safest next engineering step

Design a least-privilege telemetry path that can answer, without exposing prompt/model content or secrets:

1. how many requests actually reached the shadow revision,
2. whether the shadow revision produced 5xx responses,
3. how often the model provider completed versus rate-limited/timed-out/failed,
4. token/cost totals within the existing budget,
5. deterministic-vs-model comparison metadata needed for a later promotion decision.

Prefer a dedicated read-only metrics identity or a durable privacy-safe audit sink over broadening the deployer identity.

Do not promote or raise traffic merely because the 99/1 boundary itself is healthy.
