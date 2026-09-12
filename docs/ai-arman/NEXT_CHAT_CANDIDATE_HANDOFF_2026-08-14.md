# AI ARMAN — Candidate Handoff 2026-08-14

## Start here

Continue in repository `arman573/harmoniq-backend` on branch `feature/ai-arman-foundation-v1`.

Draft PR: #18 `AI Arman foundation v1`.

Do not merge, deploy to production, move production traffic, enable public beta, enable model promotion, or alter unrelated Harmoniq projects without explicit approval.

Working style: ChatGPT should do all feasible implementation and testing directly through GitHub and GitHub Actions. Arman does not want to paste code or act as a coding intermediary. Only hand work to Arman when it is genuinely impossible from available tools or when an external production/security approval or account-owner action is unavoidable.

## Product goal

AI Arman is intended to become Harmoniq.se's Swedish free-text AI beauty advisor for both pre-purchase and after-purchase support.

Core architecture rule:

`AI interprets -> backend decides -> verified systems provide facts -> AI formulates answer`

The AI must never invent product facts, INCI, price, stock, order status, tracking, return information, or other operational facts. The browser must never directly access Vendre, Product Intelligence, nShift, Gmail, DB, or GCP. Free-text customer/order input never establishes identity.

Initial beta scope remains primarily haircare plus read-only after-purchase capabilities. No order/address changes, cancellation, claim approval, refunds, stock/price writes, unrestricted Vendre writes, or medical diagnosis.

## Main repo and current branch state

Repository: `arman573/harmoniq-backend`

Branch: `feature/ai-arman-foundation-v1`

The last code/container checkpoint before this handoff was commit:

`9bfae4236fd51fdaf910cef56bf4e386eb77f3fd`

GitHub Actions run #808 completed successfully. The job `Test and build` passed all of these steps:

- npm dependency installation
- all unit tests
- TypeScript build
- isolated AI Arman candidate Docker image build
- isolated candidate container smoke test

The handoff document itself is committed after that checkpoint, so first inspect branch HEAD and its latest CI before making further changes.

## What already works

### 1. AI Arman foundation and deterministic backend

The AI Arman module already contains deterministic chat/recommendation infrastructure, controlled integrations, safety gates, and after-purchase orchestration.

Important foundation endpoint:

`GET /ai-arman/foundation`

It returns a deterministic status payload including:

- `ok: true`
- `service: ai-arman`
- `phase: foundation-v1`
- `productionActionsEnabled: false`

This endpoint is now used as the candidate smoke-test health surface because it does not require DB, authentication, OpenAI, or other external integrations.

### 2. Anonymous and authenticated chat paths

Anonymous chat:

`POST /ai-arman/chat/messages`

Authenticated chat:

`POST /ai-arman/chat/messages/authenticated`

Authenticated chat is guarded by bearer JWT through Passport `AuthGuard('jwt')`. Do not assume browser cookies authenticate this endpoint.

The authenticated path includes verified account/order binding and read-only order/tracking foundations. Free-text order IDs alone never grant access.

### 3. Tracking foundation

Tracking intent/tool/UI contract exists:

- intent `tracking_status`
- tool `get_tracking_status`
- UI block `tracking_card`

`VerifiedTrackingReadService` routes through `TrackingReadClient` to the authoritative tracking service. AI Arman does not directly call nShift.

### 4. Purchased-product projection

Safe purchased-product projection work is green. Generic product `id` is not blindly treated as canonical identity; the projection prefers explicit product identity such as `product_id`.

The strict Vendre purchased-product read client/service/module integration is still unfinished and remains a later task.

### 5. Product recommendation safety direction

Search Brain is intended to provide candidates. Product Intelligence is the suitability authority. Live facts must come from authoritative sources.

Companion Product Intelligence repo:

`arman573/harmoniq-product-data-pipeline`

Branch:

`sync/ai-arman-product-intelligence-v1`

Draft PR #25.

Read-only batch evaluation endpoint already exists there:

`POST /v1/ai-arman/product-intelligence/evaluate-batch`

### 6. Controlled OpenAI interpretation

A controlled OpenAI Responses API adapter exists with structured outputs and `store:false`.

Important environment gates:

- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED`
- `AI_ARMAN_MODEL_SHADOW_ENABLED`
- `AI_ARMAN_MODEL_PROMOTION_ENABLED`
- `AI_ARMAN_OPENAI_MODEL`
- `OPENAI_API_KEY`

These use exact/guarded enablement. Model configuration alone does not automatically give the model backend authority.

Shadow interpretation exists. Deterministic interpretation remains primary unless guarded promotion is explicitly enabled.

Model promotion can only influence limited semantic interpretation fields. Identity-sensitive fields, tools, routes, authorization, and policy remain backend controlled.

Identity-sensitive intents include purchased-product usage, order status, tracking, returns, and claims.

### 7. Widget preview

Internal preview endpoint:

`GET /ai-arman/widget/beta0-preview`

It is feature-gated by exact:

`AI_ARMAN_WIDGET_PREVIEW_ENABLED=true`

When disabled it must return 404.

Security properties already added:

- `Cache-Control: no-store`
- `X-Robots-Tag: noindex,nofollow,noarchive`
- dynamic backend/model text inserted with DOM `textContent`
- outbound URLs must be absolute HTTPS and may not contain credentials
- no localStorage conversation persistence
- widget response contract fails closed on contract mismatch

Current preview widget is anonymous. It can honestly test anonymous recommendation/follow-up/identity-gated responses, but not authenticated order/tracking/purchased-product flows.

## Candidate/deployment work completed on 2026-08-14

### Cloud Run PORT problem found and fixed

The old `src/main.ts` listened on hardcoded port 3000. Cloud Run injects `PORT`, so this was a readiness risk.

Added `src/http-port.ts` with validated `PORT` resolution and fallback to 3000.

`src/main.ts` now calls `resolveHttpPort()`.

Unit tests cover valid and malformed/out-of-range values.

This work was already CI-green before the isolated candidate work began.

### Critical legacy AppModule problem found

`src/app.module.ts` still configures TypeORM/Postgres with hardcoded local development settings:

- host `localhost`
- port `5432`
- username `harmoniq`
- password `password`
- database `harmoniq`
- `synchronize: true`

A normal Cloud Run boot through `AppModule` would therefore be unsafe/unreliable and could fail immediately.

Do NOT work around this by inventing DB secrets or pointing the candidate at a production DB.

### Isolated AI Arman candidate runtime created

To avoid legacy DB/Tickets/Users entirely, a separate candidate runtime was created.

Files:

- `src/ai-arman-candidate.module.ts`
- `src/ai-arman-candidate.module.spec.ts`
- `src/main-ai-arman-candidate.ts`

`AiArmanCandidateModule` imports only `AiArmanModule`.

The candidate bootstrap uses `AiArmanCandidateModule`, the same global validation pipe behavior, and `resolveHttpPort()`.

`package.json` now contains:

`start:ai-arman-candidate`

which runs the compiled candidate bootstrap.

A regression test asserts the candidate module imports only `AiArmanModule`.

### Isolated candidate Docker image created

File:

`Dockerfile.ai-arman-candidate`

It uses a multi-stage Node 22 build, compiles TypeScript, installs production dependencies in the runtime image, runs as the non-root `node` user, exposes 8080, and starts:

`node dist/main-ai-arman-candidate.js`

It never starts `dist/main.js`, so it does not boot the legacy `AppModule`.

### Docker build context hardened

File:

`.dockerignore`

It excludes Git metadata, node_modules, dist, coverage, environment files, logs, docs and editor/OS junk from the candidate build context.

### CI now tests the actual candidate container

Workflow:

`.github/workflows/ai-arman-foundation-ci.yml`

It now tracks the candidate bootstrap, Dockerfile, `.dockerignore`, port resolver and relevant build/config files.

After unit tests and TypeScript build, CI performs:

1. `docker build -f Dockerfile.ai-arman-candidate ...`
2. starts the container locally with `PORT=8080`
3. explicitly sets these safety flags false:
   - `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`
   - `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=false`
   - `AI_ARMAN_MODEL_SHADOW_ENABLED=false`
   - `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`
4. polls `/ai-arman/foundation`
5. verifies the service/foundation payload and `productionActionsEnabled == false`
6. verifies `/ai-arman/widget/beta0-preview` returns HTTP 404 while disabled

Run #808 passed the entire container build and smoke test.

## GCP / Cloud Run infrastructure findings

The repository itself had no deployment workflow, GitHub Environment, deployment record, Dockerfile, or documented Cloud Run service before this work.

We searched repository history, other accessible GitHub repos, Gmail and Drive for an existing AI Arman/Customer Core service identity. No existing dedicated AI Arman Cloud Run service was found.

From other working Harmoniq infrastructure we verified:

- GCP project ID: `harmoniq-210513`
- project number: `222024985388`
- common WIF provider: `projects/222024985388/locations/global/workloadIdentityPools/github-actions/providers/github-harmoniq`
- Harmoniq Cloud Run workloads commonly use region `europe-north1`

A candidate service name `harmoniq-ai-arman-beta0` was selected for the isolated candidate path, but no Cloud Run mutation has yet been performed.

## What failed and why

### Read-only WIF/GCP preflight failed

A temporary GitHub Actions workflow was created only to test Google Cloud authentication and read-only metadata access. It made no Cloud Run mutation.

Google authentication failed with:

`unauthorized_client`

and:

`The given credential is rejected by the attribute condition.`

This precisely shows that `arman573/harmoniq-backend` is not currently accepted by the `github-harmoniq` Workload Identity Provider's attribute condition.

The temporary preflight workflow was immediately removed afterward so PR #18 would not retain an intentionally failing check.

No GCP service, secret, environment variable or production traffic was changed.

### Existing GitHub/GCP identities cannot repair this from current tools

We inspected existing Harmoniq IAM/WIF automation in `arman573/harmoniq-account-identity-bridge`.

There is precedent for repository-specific `roles/iam.workloadIdentityUser` bindings, but the available approved deploy service account does not have sufficient IAM visibility/authority to safely modify the Workload Identity Provider itself. Existing audit output even shows it lacks `iam.serviceAccounts.getIamPolicy`.

No accessible GitHub workflow or connected GCP tool was found that has verified authority to modify the provider attribute condition.

There is also no Google Cloud/GCP connector/plugin available to ChatGPT in the current environment.

Therefore the WIF provider allow-list/attribute-condition change is currently the one genuine external blocker.

## Manual action that may be unavoidable

If no new GCP-capable connector/tool becomes available, the GCP account owner must modify the existing Workload Identity Provider `github-harmoniq` in project `harmoniq-210513` so repository:

`arman573/harmoniq-backend`

is permitted by the existing repository attribute condition.

Important: preserve all currently allowed repositories. Do not replace the entire condition with only this repository.

After this external action, ChatGPT should immediately rerun a read-only WIF preflight from GitHub before attempting any deployment.

Arman should not be asked to paste code, create workflows, or run tests. Only give him the minimal account-owner/GCP-console action if it is still impossible from tools.

## Next steps — exact order

### Step 1 — Read current handoff and verify branch state

Read this file first, then inspect branch HEAD, PR #18 and latest exact-head GitHub Actions run.

Do not assume `9bfae423...` remains HEAD because this handoff commit itself comes afterward.

### Step 2 — Confirm candidate CI remains green

The important baseline is that unit tests, TS build, Docker build, and container smoke test are green.

If a later CI is red, inspect and fix only the actual failure before moving on.

### Step 3 — Resolve WIF provider access

First see whether a newly available GitHub/GCP automation or connector can safely add `arman573/harmoniq-backend` to the existing WIF provider condition.

If not, this is the single minimal manual task for Arman/GCP account owner.

Do not guess or weaken the WIF condition.

### Step 4 — Rerun read-only GCP preflight

After WIF provider access is changed, create/run a temporary read-only GitHub Actions check that:

- authenticates to `harmoniq-210513`
- verifies project identity
- confirms access in `europe-north1`
- checks whether `harmoniq-ai-arman-beta0` already exists
- performs no Cloud Run mutation

Remove the temporary workflow afterward if it is only diagnostic.

### Step 5 — Establish least-privilege deployment identity

Do not reuse an unrelated deploy service account blindly.

Determine the minimum permissions required to:

- build/push the AI Arman candidate image
- create/update only the isolated candidate service
- inspect that service
- deploy with no production traffic impact

Prefer repository-scoped Workload Identity and a dedicated/least-privilege deploy identity.

Do not expose service-account keys.

### Step 6 — Verify Artifact Registry destination

Do not invent a repository/image path. Read actual GCP metadata once access exists and reuse an existing suitable Artifact Registry repository or create a narrowly scoped one only if explicitly appropriate.

Candidate image should be uniquely tagged with commit SHA/time; never rely only on `latest`.

### Step 7 — Deploy isolated candidate only

Deploy `harmoniq-ai-arman-beta0` using `Dockerfile.ai-arman-candidate`.

Initial candidate environment must keep:

- widget preview off
- model interpretation off
- model shadow off
- model promotion off

The initial deployment should only prove that the isolated deterministic service boots correctly.

No existing production service should be replaced. No production traffic should move.

### Step 8 — Verify candidate runtime

Verify the candidate directly:

- `/ai-arman/foundation` returns correct deterministic status
- `productionActionsEnabled` remains false
- widget preview returns 404 while disabled
- no model calls occur
- no legacy Postgres connection is attempted

Inspect Cloud Run logs for startup errors without exposing secrets.

### Step 9 — Enable widget preview only

Once the default-off candidate is green, enable only:

`AI_ARMAN_WIDGET_PREVIEW_ENABLED=true`

Keep model interpretation, shadow and promotion off.

Verify the internal Beta-0 widget and anonymous deterministic chat path.

### Step 10 — Model shadow later, separately

After deterministic candidate/widget proof, model configuration can be considered in a separate guarded step.

Recommended sequence:

1. model credentials/model configured while shadow remains off — verify zero model calls
2. enable shadow only, keep promotion off
3. audit shadow behavior/cost/rate/concurrency
4. only later consider promotion with explicit approval

Do not enable promotion as part of initial candidate deployment.

### Step 11 — Authenticated after-purchase work remains separate

The anonymous widget cannot prove authenticated order/tracking/purchased-product behavior.

Authenticated storefront integration still requires bearer JWT and verified account-order flow. Test this separately from anonymous widget rollout.

### Step 12 — Remaining product work after candidate infrastructure

After candidate infrastructure is proven:

- strict purchased-product Vendre read integration
- Product Intelligence live candidate connectivity
- Search Brain candidate connectivity
- model-facing natural-language answer composition beyond deterministic structured blocks
- authenticated storefront/widget integration
- environment/budget/audit/rollback hardening
- internal beta
- limited public beta only after separate approval

## Safety / non-negotiable rules

- No merge of PR #18 without explicit approval.
- No production traffic changes without explicit approval.
- No public beta activation without explicit approval.
- No secrets printed in chat or committed to GitHub.
- No service-account JSON keys.
- No guessing GCP service/project/registry identities when they can be verified.
- No pointing the isolated candidate at the legacy hardcoded Postgres configuration.
- No OpenAI model/shadow/promotion in the first candidate boot.
- No identity-sensitive customer data access from free-text input.
- No browser-direct Vendre/nShift/Product Intelligence/GCP access.
- Do not touch unrelated Harmoniq repos/projects while doing this work.
- Prefer small isolated commits and exact-head CI after meaningful changes.

## User working preference

Arman wants ChatGPT to perform implementation, GitHub edits, CI, debugging, and verification directly whenever tools allow it. Do not ask him to paste code or act as a GitHub intermediary. If something is truly impossible — for example an account-owner-only GCP IAM/provider change with no available connector or authorized workflow — give him only that minimal external action, then resume autonomous work immediately afterward.
