# AI Arman beta0 - GCP IAM preparation

Status: Ready for owner-applied IAM preparation; no candidate deployment performed
Date: 2026-08-15

## Purpose

Prepare dedicated identities for the isolated `harmoniq-ai-arman-beta0` Cloud Run candidate without reusing the historical pickup deployer as AI Arman's permanent identity.

This document intentionally separates:

1. GitHub deployment identity;
2. Cloud Run runtime identity;
3. existing temporary bootstrap/read identity.

The candidate deployment remains a separate gate.

## Verified current state

Project: `harmoniq-210513`
Region: `europe-north1`
WIF pool: `github-actions`
WIF provider: `github-harmoniq`
Candidate service name: `harmoniq-ai-arman-beta0`
Preferred existing Artifact Registry repository: `harmoniq-containers`

Verified through read-only inventory on 2026-08-15:

- `harmoniq-ai-arman-beta0` does not exist yet;
- `harmoniq-containers` exists in `europe-north1`;
- `github-pickup-deployer@harmoniq-210513.iam.gserviceaccount.com` can read Cloud Run, Artifact Registry and service-account inventory;
- the pickup deployer can upload/download Artifact Registry artifacts, act as service accounts, and create/get/update Cloud Run services;
- the pickup deployer cannot create service accounts, read/set service-account IAM policy or read/set project IAM policy;
- therefore it must not be used to bootstrap permanent AI Arman IAM by silently broadening its privileges.

## Dedicated identities

### Deployment service account

Create:

`github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`

Display name:

`GitHub AI Arman beta0 deployer`

Purpose:

- authenticate GitHub Actions after the existing WIF provider accepts `arman573/harmoniq-backend` on `feature/ai-arman-foundation-v1`;
- push the isolated candidate image;
- create/update only the candidate Cloud Run service through the controlled deployment workflow;
- impersonate only the dedicated AI Arman runtime service account when deploying.

### Runtime service account

Create:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

Display name:

`AI Arman beta0 runtime`

Initial permissions:

- no broad project role;
- no Vendre write access;
- no Gmail access;
- no Returns write access;
- no unrestricted Secret Manager access;
- no production mutation permissions.

The foundation-only candidate starts with all model/widget/production-action flags disabled, so the runtime identity should start effectively empty and receive narrowly scoped read permissions only when a later verified integration requires them.

## Least-privilege bindings

The owner-applied IAM preparation should grant only the following.

### 1. GitHub WIF -> deploy service account

Grant `roles/iam.workloadIdentityUser` on the **deployment service account**, not project-wide, to the GitHub WIF principal for repository:

`arman573/harmoniq-backend`

The WIF provider itself must remain branch-restricted to:

`refs/heads/feature/ai-arman-foundation-v1`

Do not weaken the provider condition to all repositories or all branches.

### 2. Deploy service account -> Artifact Registry

Grant `roles/artifactregistry.writer` on repository:

`projects/harmoniq-210513/locations/europe-north1/repositories/harmoniq-containers`

The deployment workflow verifies both artifact upload and download permissions before its first mutation.

Do not grant Artifact Registry admin.

### 3. Deploy service account -> Cloud Run

Preferred predefined role:

`roles/run.developer`

The hardened preflight/deploy gates explicitly require and verify these Cloud Run permissions before mutation:

- `run.services.create`;
- `run.services.get`;
- `run.services.update`;
- `run.operations.get`;
- `run.services.getIamPolicy`.

`run.operations.get` is required so the deploy command can read deployment status. `run.services.getIamPolicy` is used only to verify that the candidate target is not publicly invocable.

The deploy workflow intentionally does **not** modify the service IAM policy. It must therefore not require or receive `run.services.setIamPolicy` merely to make the candidate private. A newly created Cloud Run service keeps the Invoker IAM check enabled by default unless an explicit public-access configuration changes it; the workflow verifies the resulting IAM boundary read-only after deployment.

If `roles/run.developer` must initially be project-scoped because the target service does not exist yet, treat that as bootstrap scope and review narrowing after service creation. Do not grant `roles/run.admin` unless a concrete authenticated permission failure proves a genuinely required capability that cannot be handled with a narrower role.

### 4. Deploy service account -> runtime service account

Grant `roles/iam.serviceAccountUser` to `github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com` on:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

The preflight verifies `iam.serviceAccounts.actAs` before any deployment mutation.

Do not grant Service Account Admin or Token Creator unless a concrete authenticated error proves it is required.

## Provider gate still required

Before any deploy workflow can use the new deploy identity, `github-harmoniq` must actually accept the backend branch.

Expected exact repository and branch condition addition:

```text
(assertion.repository == 'arman573/harmoniq-backend' && assertion.ref == 'refs/heads/feature/ai-arman-foundation-v1')
```

Previous direct WIF verification returned `unauthorized_client` / `The given credential is rejected by the attribute condition`, so this gate is not considered complete until a fresh GitHub Actions authentication from the backend branch succeeds.

Do not run repeated blind WIF preflights while the provider condition is still unverified.

## Prepared GitHub gates

The branch now contains two manual-only workflows:

- `.github/workflows/ai-arman-beta0-gcp-preflight.yml`
- `.github/workflows/ai-arman-beta0-candidate-deploy.yml`

The read-only preflight requires exact input:

`VERIFY_AI_ARMAN_BETA0_GCP`

The candidate deploy requires exact input:

`DEPLOY_AI_ARMAN_BETA0`

Both workflows also require the exact AI Arman branch and actor `arman573`. Neither workflow has a push trigger. The deploy workflow never falls back to the historical pickup deployer.

## Candidate deployment gate after IAM preparation

Even after IAM is prepared, do not deploy until a separate explicit candidate-deploy approval.

The first candidate deploy must use:

- service: `harmoniq-ai-arman-beta0`;
- region: `europe-north1`;
- isolated entrypoint `dist/main-ai-arman-candidate.js`;
- isolated Dockerfile `Dockerfile.ai-arman-candidate`;
- runtime service account: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`;
- immutable SHA/run-specific Artifact Registry image tag;
- HTTP startup probe on `/ai-arman/foundation`;
- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`;
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=false`;
- `AI_ARMAN_MODEL_SHADOW_ENABLED=false`;
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`;
- production actions disabled.

The local pre-deploy verification must prove:

- unit tests pass;
- TypeScript build passes;
- isolated candidate container builds;
- `/ai-arman/foundation` returns the expected foundation contract;
- `productionActionsEnabled === false`;
- widget preview returns 404;
- candidate logs contain no localhost/Postgres startup attempt.

The Cloud Run deployment verification must prove:

- service becomes Ready;
- the configured startup probe is `/ai-arman/foundation` on port 8080;
- runtime service account is exactly `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`;
- all model/widget activation flags remain `false`;
- no `allUsers` or `allAuthenticatedUsers` IAM member exists on the target service;
- no model call or external customer action is executed.

## Rollback / deletion

If IAM preparation is abandoned before deployment:

1. remove the WIF `roles/iam.workloadIdentityUser` binding from the AI Arman deploy service account;
2. remove Artifact Registry writer and Cloud Run developer bindings from the deploy service account;
3. remove the deployer's `roles/iam.serviceAccountUser` binding on the runtime account;
4. delete `github-ai-arman-deployer` and `ai-arman-beta0-runtime` only after confirming they are unused.

No production Cloud Run service or traffic needs to be touched for this rollback.

## Safety rules

- no service-account JSON keys;
- no secret values in GitHub;
- no project Owner/Editor grants;
- no broad provider condition;
- no reuse of pickup deployer as permanent AI Arman deploy identity;
- no reuse of default compute service account as AI Arman runtime;
- no `run.services.setIamPolicy` grant merely for private candidate deployment;
- no candidate deployment as part of IAM preparation;
- no PR merge as part of IAM preparation.
