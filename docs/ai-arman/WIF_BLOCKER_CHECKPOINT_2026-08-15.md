# AI Arman – WIF blocker checkpoint 2026-08-15

## Current repository state

- Repo: `arman573/harmoniq-backend`
- Branch: `feature/ai-arman-foundation-v1`
- Draft PR: #18 `AI Arman foundation v1`
- Verified head before this checkpoint: `8ed904e10de33e161b54b5af29b55fe70d4ebc67`
- AI Arman foundation CI was green for both push and PR on that exact head.

## Candidate status

The isolated AI Arman candidate remains the approved architecture:

- `src/ai-arman-candidate.module.ts`
- `src/main-ai-arman-candidate.ts`
- `Dockerfile.ai-arman-candidate`

The candidate must not start the legacy `AppModule` or legacy Postgres.

First candidate boot must keep these off:

- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=false`
- `AI_ARMAN_MODEL_SHADOW_ENABLED=false`
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`

## Verified GCP facts

- Project: `harmoniq-210513`
- Project number: `222024985388`
- Region: `europe-north1`
- WIF pool: `github-actions`
- WIF provider: `github-harmoniq`
- Provider resource: `projects/222024985388/locations/global/workloadIdentityPools/github-actions/providers/github-harmoniq`
- Existing read/deploy-capable historical service account: `github-pickup-deployer@harmoniq-210513.iam.gserviceaccount.com`
- Target candidate service `harmoniq-ai-arman-beta0` did not exist in the latest read-only inventory.
- Artifact Registry repository `harmoniq-containers` exists.

## Verified backend GitHub OIDC claims

The real GitHub OIDC token from the AI Arman branch has been inspected safely. Relevant claims are:

- `repository=arman573/harmoniq-backend`
- `repository_owner=arman573`
- `repository_id=1227148314`
- `repository_owner_id=280713151`
- `ref=refs/heads/feature/ai-arman-foundation-v1`
- `ref_type=branch`
- `actor=arman573`
- `event_name=push`
- `sub=repo:arman573/harmoniq-backend:ref:refs/heads/feature/ai-arman-foundation-v1`

## Current blocker

`google-github-actions/auth@v3` from `arman573/harmoniq-backend` is still rejected with:

- `unauthorized_client`
- `The given credential is rejected by the attribute condition.`

This happens before `gcloud` can run, so the failure is at the WIF provider attribute condition.

The most recent known provider condition from audit history did not include `arman573/harmoniq-backend`.

## What was tested and ruled out

- The direct identity in `arman573/harmoniq-account-identity-bridge` can authenticate to WIF but has no provider get/update/create/delete permissions.
- `github-pickup-deployer@harmoniq-210513.iam.gserviceaccount.com` can read Cloud Run, Artifact Registry and service accounts and has Cloud Run create/update plus Artifact Registry upload/download and `iam.serviceAccounts.actAs`.
- The pickup identity does **not** have service-account creation or IAM-policy write permissions.
- The pickup identity also has **zero** WIF provider get/update permissions and cannot describe `github-harmoniq`.
- Direct identity cannot read the relevant Cloud Audit Logs.
- No installable GCP/Cloud IAM connector is available in ChatGPT.
- Repeated blind backend WIF preflights are intentionally stopped until the real provider condition is known.

## Least-privilege target

The intended design remains:

- dedicated deploy identity for AI Arman;
- dedicated runtime identity for `harmoniq-ai-arman-beta0`;
- no Owner/Editor grants;
- Artifact Registry writer scoped to the intended repository;
- Cloud Run deploy permissions only as needed;
- `iam.serviceAccountUser` scoped only to the AI Arman runtime identity;
- WIF binding scoped to the backend repository/branch;
- no service-account JSON keys.

See `docs/ai-arman/BETA0_GCP_IAM_PREP_2026-08-15.md`.

## Only unresolved external fact

Before another backend WIF auth attempt, obtain the **actual current Attribute condition** from:

`GCP → IAM & Admin → Workload Identity Federation → github-actions → github-harmoniq → Edit`

The condition must be read after reload and compared exactly with the verified OIDC claims above.

Do not replace the whole condition with only AI Arman. Existing approved Harmoniq repositories must remain allowed.

The required backend clause is logically equivalent to:

```text
(assertion.repository == 'arman573/harmoniq-backend' && assertion.ref == 'refs/heads/feature/ai-arman-foundation-v1')
```

## After the provider condition is verified/fixed

Continue automatically without asking between safe steps:

1. Run one temporary exact-branch direct-WIF auth verification.
2. Inspect the actual auth step result/logs.
3. If green, run read-only GCP validation.
4. Validate the dedicated deploy/runtime IAM path.
5. Do not deploy until the separate candidate-deploy gate is explicitly approved.

No Cloud Run deploy, traffic change, IAM mutation, provider mutation, secret change or PR merge was performed while producing this checkpoint.
