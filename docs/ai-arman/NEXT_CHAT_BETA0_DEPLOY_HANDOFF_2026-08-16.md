# AI Arman beta0 deployment handoff — 2026-08-16

## Läs detta först i nästa chat

Repo: `arman573/harmoniq-backend`

Branch: `feature/ai-arman-foundation-v1`

Draft PR: `#18 AI Arman foundation v1`

Checkpoint före denna handoff-fil skapades: `36e3ff8cc78777773fa079f472b9964b2bd7e0b9`

Exakt-head foundation CI för `36e3ff8...`: GitHub Actions run `31965836292`, job `95210762696`, **SUCCESS**.

Det jobbet verifierade:
- npm dependencies installerade
- unit tests gröna
- TypeScript build grön
- isolerad AI Arman candidate-container byggs
- isolerad candidate-container smoke-test är grön

VIKTIG ARBETSREGEL: Arman ska inte agera kodklistrare eller GitHub-mellanhand. ChatGPT ska själv göra GitHub-läsning, små säkra ändringar, commits, tester, GitHub Actions, CI-inspektion, loggläsning, tillfälliga verifierings-workflows och cleanup. Be Arman göra något manuellt endast när det faktiskt är tekniskt omöjligt för ChatGPT, till exempel vissa Owner/IAM-ändringar i Google Cloud Console. Om en manuell uppgift behövs ska den vara minimal, exakt och en sak i taget.

---

## Övergripande mål

Bygg **AI Arman som Harmoniqs svenska fria AI-rådgivare**, både före och efter köp.

Arkitekturprincipen ska vara:

`AI tolkar → backend bestämmer → verifierade system levererar fakta → AI formulerar svaret`

AI:n får aldrig hitta på:
- pris
- lager
- INCI
- produktfakta
- orderstatus
- tracking
- retur-/reklamationsstatus
- annan verifierbar kund- eller produktdata

Identitetskänsliga funktioner ska alltid gå genom verifierad kund-/orderaccess.

Målet är inte att släppa en fri modell direkt. Målet är en stegvis, säker rollout där deterministic/verifierad backend styr vad som får hända och modellen endast används där fakta- och accessgränser redan är säkra.

---

## Status just nu — viktigast

**AI Arman beta0 foundation är nu faktiskt deployad som en privat Cloud Run-service.**

Cloud Run:
- project: `harmoniq-210513`
- project number: `222024985388`
- region: `europe-north1`
- service: `harmoniq-ai-arman-beta0`
- URL: `https://harmoniq-ai-arman-beta0-222024985388.europe-north1.run.app`
- deployed revision: `harmoniq-ai-arman-beta0-beta0-d6311f3d-1-1`
- image tag used during approved deploy: `beta0-d6311f3d5c16-run-31965681233-attempt-1`
- image digest: `sha256:b4b81b7560c885bcc2c8dfa32a9825057358d121acdfd0f92cde2ea8311f802b`
- approved deploy workflow run: `31965681233`
- source verification job: `95210383751` — SUCCESS
- deploy job: `95210498370` — SUCCESS

Important: the temporary deploy workflow was removed after success. Cleanup commit:
`36e3ff8cc78777773fa079f472b9964b2bd7e0b9`

The service is private. Deploy log explicitly said:
`This service will require authentication to be invoked.`

Post-deploy IAM check verified that neither `allUsers` nor `allAuthenticatedUsers` exists on the service.

The Cloud Run revision receives 100% of traffic **inside this new private beta0 service**. This is not public production traffic and no existing Harmoniq service traffic was changed.

---

## Cost lock — beta0

Arman explicitly wants cost as low as safely possible.

Current deployed profile is:
- `--cpu 1`
- `--memory 512Mi`
- `--cpu-throttling`
- `--no-cpu-boost`
- `--min 0`
- `--max 1`
- `--concurrency 20`
- `--timeout 30`
- startup probe: `/ai-arman/foundation` on port `8080`

Labels:
- `release=beta0-candidate`
- `cost-profile=beta0-minimal`
- source SHA label from deploy source

The deploy workflow verified after creation:
- CPU throttling = true
- startup CPU boost = false
- min scale = 0
- max scale = 1
- startup probe path and port are correct
- runtime service account is exact

Current AI/model cost is effectively locked off because all model/widget flags are false.

Do not raise min instances, max instances, memory, CPU, or enable model calls without measurement and explicit reason.

512 MiB was intentionally kept rather than prematurely forcing 256 MiB. Later, measure actual beta0 memory and only lower to 256 MiB if verified safe.

---

## Runtime feature flags — all OFF

The deployed service has:
- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=false`
- `AI_ARMAN_MODEL_SHADOW_ENABLED=false`
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`

`NODE_ENV=production`.

Therefore:
- no widget preview is enabled
- no model interpretation is enabled
- no model shadow is enabled
- no model promotion is enabled
- no production actions are enabled by the foundation endpoint

Local isolated candidate smoke verified `/ai-arman/foundation` returns expected foundation state and `productionActionsEnabled == false`.

Local smoke also verified widget preview endpoint is disabled/404 when the flag is false.

---

## Candidate architecture that avoids legacy Postgres startup

Legacy `AppModule` attempts localhost/Postgres `5432`, which must not be used by the AI Arman candidate.

The candidate is intentionally isolated:
- `src/ai-arman-candidate.module.ts`
- `src/main-ai-arman-candidate.ts`
- imports only AI Arman candidate/foundation module path, not the legacy application graph that opens Postgres
- `Dockerfile.ai-arman-candidate`
- Node 22 runtime
- non-root runtime user
- production dependencies only in runtime layer
- `.dockerignore`

CI and approved deploy source verification both explicitly scan candidate startup logs for localhost/Postgres connection attempts. No forbidden startup attempt was detected.

Do not replace the candidate entrypoint with the legacy main/AppModule.

---

## GCP identities now in place

### Runtime service account

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

Purpose:
- runtime identity for beta0 Cloud Run service
- intentionally minimal
- no JSON keys

Do not give this runtime broad project roles casually. Future verified system access should be granted narrowly and only when a specific read-only capability is ready.

### GitHub deploy service account

`github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`

Purpose:
- dedicated GitHub deploy identity for AI Arman beta0
- no JSON keys
- authenticated through Workload Identity Federation

It currently has the permissions necessary to deploy beta0:
- Cloud Run Developer on project `harmoniq-210513`
- Artifact Registry Writer only on repository `harmoniq-containers`
- Service Account User / `actAs` boundary on exact AI Arman runtime service account

Do not replace this with the old pickup deployer.

---

## Workload Identity Federation — blocker is resolved

Pool:
`github-actions`

Provider:
`github-harmoniq`

Full provider resource:
`projects/222024985388/locations/global/workloadIdentityPools/github-actions/providers/github-harmoniq`

The old provider Attribute Condition did not allow `arman573/harmoniq-backend`, which caused `unauthorized_client`.

Arman manually added this exact backend clause to the existing provider condition:

`(assertion.repository == 'arman573/harmoniq-backend' && assertion.ref == 'refs/heads/feature/ai-arman-foundation-v1')`

After that, direct WIF authentication from the backend repo succeeded.

There was then a second issue: an initial subject-principal binding on the deploy service account did not allow access-token impersonation. A repository `principalSet` binding was added:

`principalSet://iam.googleapis.com/projects/222024985388/locations/global/workloadIdentityPools/github-actions/attribute.repository/arman573/harmoniq-backend`

with Workload Identity User.

Branch restriction remains enforced by provider CEL.

A read-only GitHub permission probe then proved:
- WIF authentication works
- `setup-gcloud` works
- active account is exact dedicated deploy service account
- `gcloud auth print-access-token` works

The older subject binding may still exist as a redundant row. Do not rush to remove it during functional work. If later cleaning IAM, first read current policy and remove only a clearly redundant old binding after confirming repository principalSet remains effective.

Older docs that describe WIF as blocked are now historical and must not be treated as current status.

---

## IAM permissions verified before deploy

Read-only `testIamPermissions` checks from GitHub passed for:

Cloud Run:
- `run.services.create`
- `run.services.get`
- `run.services.update`
- `run.operations.get`
- `run.services.getIamPolicy`

Runtime account:
- `iam.serviceAccounts.actAs`

Artifact Registry repository `harmoniq-containers`:
- `artifactregistry.repositories.downloadArtifacts`
- `artifactregistry.repositories.uploadArtifacts`

The full read-only preflight passed before deploy.

The permanent preflight workflow was also corrected so it does not unnecessarily require service-account metadata read permissions merely to prove identity.

Permanent file:
`.github/workflows/ai-arman-beta0-gcp-preflight.yml`

Permanent candidate deploy file:
`.github/workflows/ai-arman-beta0-candidate-deploy.yml`

These permanent workflows are manual-gated. Do not casually weaken their gates.

---

## What initially did not work / lessons learned

### 1. WIF provider blocked backend repo

Symptom:
- `unauthorized_client`

Cause:
- provider Attribute Condition allowed several other Harmoniq repos but not `arman573/harmoniq-backend` on the AI Arman branch.

Fix:
- manual Owner-level provider condition edit in GCP Console.

Status:
- fixed and verified.

### 2. First deploy-SA WIF binding did not permit access-token impersonation

Symptom:
- auth action could start, but setup-gcloud failed with `iam.serviceAccounts.getAccessToken denied`.

Cause:
- initial exact subject principal binding did not match the effective impersonation path as expected.

Fix:
- add repository `principalSet` binding for `arman573/harmoniq-backend`, while branch restriction stays in provider CEL.

Status:
- fixed and verified.

### 3. One temporary runtime permission workflow was accidentally truncated

A temp verifier file was first created incomplete and failed before jobs ran. It was a workflow-file construction error, not a GCP/IAM failure.

Fix:
- patch temp workflow, rerun, `iam.serviceAccounts.actAs` passed, then remove temp file.

Lesson:
- after any workflow write, read back the complete file or verify the resulting job definition before interpreting failures as infrastructure failures.

### 4. GCP Artifact Registry UI guidance was initially confusing

The Permissions control was not on the repository image-detail page. Correct path was:
- Artifact Registry → Repositories
- select the checkbox beside `harmoniq-containers`
- Permissions
- Add principal

Arman manually granted Artifact Registry Writer to the dedicated deploy service account on that exact repository.

Status:
- verified PASS from GitHub.

### 5. Cloud Run Developer had to be project-level for first service creation

Because target service did not exist yet, the deployer was granted Cloud Run Developer at project level for bootstrap.

Status:
- working.

Later least-privilege tightening may be evaluated after the service exists, but do not introduce brittle IAM conditions without proving they still support deploy/update.

### 6. GitHub connector cannot directly dispatch workflow_dispatch in current tool surface

For verification/deploy work in this chat, ChatGPT used temporary push-triggered workflows that exactly reproduced the permanent gated logic, followed them to completion, read logs, and deleted them afterward.

This is acceptable, but temporary workflows must always be cleaned up after a definitive result.

---

## Approved beta0 deploy — exact evidence

Approved temporary deploy workflow run:
`31965681233`

Source verify job:
`95210383751`
- explicit approval marker gate passed
- exact branch gate passed
- full tests passed
- TypeScript build passed
- candidate Docker build passed
- local foundation smoke passed
- widget-disabled smoke passed
- no localhost/Postgres startup pattern detected

Deploy job:
`95210498370`
- WIF auth passed
- setup-gcloud passed
- permissions gate passed
- immutable image built and pushed
- digest validated
- Cloud Run service created
- startup/readiness completed
- post-deploy cost/settings assertions passed
- private IAM boundary passed

Cloud Run deploy output:
- service requires authentication
- revision `harmoniq-ai-arman-beta0-beta0-d6311f3d-1-1`
- service created successfully

Post-deploy IAM output:
`privateIamBoundary=PASS`

The temporary deploy workflow was then deleted.

---

## Important issue discovered during image build: npm vulnerabilities

This is now the first technical follow-up before enabling any new capability.

During runtime-layer `npm ci --omit=dev`, npm reported:
- 6 vulnerabilities total
- 1 low
- 2 moderate
- 3 high

During full build dependency install, npm reported:
- 10 vulnerabilities total
- 2 low
- 2 moderate
- 6 high

No conclusion has yet been made about exploitability or whether the high-severity items are reachable in the deployed runtime.

Do **not** blindly run `npm audit fix`, and especially do not use forced upgrades without impact analysis. This repo has working foundation behavior that must not be destabilized.

Next chat should inspect the exact audit graph first, classify runtime vs dev/build-only vulnerabilities, identify direct/transitive packages, available patched versions, and regression risk.

---

## What is NOT done yet

The following are deliberately not enabled or not verified yet:

1. No public access to AI Arman beta0.
2. No widget preview enabled in Cloud Run.
3. No model interpretation enabled.
4. No model shadow enabled.
5. No model promotion enabled.
6. No customer-facing UI rollout.
7. No authenticated order/tracking feature rollout.
8. No live product-system integration in this beta0 service beyond foundation scaffolding.
9. No production action capability.
10. No merge of draft PR #18.
11. No memory reduction from 512 MiB to 256 MiB yet.
12. No least-privilege tightening of project-level Cloud Run Developer after service creation yet.
13. No remote authenticated functional request to the private Cloud Run foundation endpoint has been documented yet beyond Cloud Run startup/readiness and local smoke. If doing this, first check whether the existing deploy identity already has `run.routes.invoke`; do not grant new invoker access blindly.
14. No dependency vulnerability remediation has been performed yet.

---

## Exact next step — start here

### Step 1: dependency/security audit, GitHub-only, no deploy

Do this before enabling widget/model/public access.

ChatGPT should:
1. Read `package.json` and `package-lock.json` on current branch.
2. Create a temporary GitHub Actions audit workflow or extend an isolated CI path that runs at least:
   - `npm audit --omit=dev --json`
   - full `npm audit --json` for comparison
3. Save audit output as workflow artifact if useful, or inspect logs/JSON through GitHub tooling.
4. Classify every moderate/high runtime finding:
   - package
   - direct vs transitive
   - runtime vs dev/build-only
   - affected version
   - fixed version
   - dependency path
   - whether the vulnerable functionality appears reachable by AI Arman candidate
5. Do not change dependencies yet unless the fix is small and demonstrated safe.
6. If a fix is needed, make the smallest dependency update, run full foundation CI + candidate container smoke, inspect diff, and only then decide whether a new private beta0 revision is warranted.
7. No public/model activation during this work.

### Step 2: authenticated remote beta0 smoke without broadening access

After security classification, verify the deployed private service from GitHub.

First run read-only `testIamPermissions` for `run.routes.invoke` on the exact service/deployer identity.

- If current deployer already has invoke permission, obtain an ID token and call only `/ai-arman/foundation`, verify expected response, then verify widget endpoint remains inaccessible/disabled.
- If deployer does not have invoke permission, do not casually add Cloud Run Invoker. Design the narrowest temporary or dedicated verifier path first.

Do not make the service public just to smoke-test it.

### Step 3: document final beta0 baseline

Update `docs/ai-arman/BETA0_GCP_IAM_PREP_2026-08-15.md` or add a final baseline document so stale blocker language is clearly superseded by this successful deployment.

Include:
- identities
- WIF state
- IAM roles/scopes
- service/revision/digest
- cost profile
- private IAM result
- all flags off
- exact CI/deploy evidence

### Step 4: cost measurement

Once beta0 can be safely invoked in an authenticated test:
- observe startup/memory behavior
- determine whether 256 MiB is safe
- keep min 0 / max 1
- do not enable CPU boost
- do not enable model calls during memory measurement

### Step 5: first controlled capability

After security + remote smoke + cost baseline are clean, choose the next capability deliberately.

Recommended order:
1. private deterministic widget preview only
2. verified live read-only product facts
3. model interpretation in shadow mode
4. authenticated order/tracking read-only path
5. internal beta
6. public beta only after separate explicit approval

At every stage preserve:
`AI tolkar → backend bestämmer → verifierade system levererar fakta → AI formulerar svaret`

---

## Security / rollout locks

Do not:
- merge PR #18 without explicit approval
- make Cloud Run public without explicit approval
- enable widget/model flags casually
- enable production actions
- add service-account JSON keys
- print tokens/private keys
- use `github-pickup-deployer` as permanent AI Arman deploy identity
- give runtime broad roles without a concrete verified dependency
- increase min instances or max instances without reason
- deploy dependency changes before tests pass
- interpret old WIF blocker docs as current state
- touch unrelated Harmoniq production services

For future real deployment mutations, keep an explicit approval gate.

---

## Working style for next chat

Arman wants ChatGPT to take longer coherent work blocks instead of requiring repeated `kör` messages.

Default behavior:
- read GitHub first
- inspect before editing
- make small safe patches
- test in GitHub
- follow GitHub Actions to definitive PASS/FAIL
- read failure logs and fix directly
- clean temporary workflows/files
- keep Arman out of code-pasting/manual GitHub work
- only ask Arman for a manual action if ChatGPT literally cannot perform it with available tools
- when manual action is unavoidable, give one exact action at a time and inspect screenshots before giving UI directions

No more manual GCP work is currently known to be required for the immediate dependency-audit next step.

---

## Key current files

Start by reading:
1. `docs/ai-arman/NEXT_CHAT_BETA0_DEPLOY_HANDOFF_2026-08-16.md`
2. `docs/ai-arman/NEXT_CHAT_CANDIDATE_HANDOFF_2026-08-14.md`
3. `docs/ai-arman/BETA0_GCP_IAM_PREP_2026-08-15.md`
4. `docs/ai-arman/WIF_BLOCKER_CHECKPOINT_2026-08-15.md` — historical blocker context only
5. `.github/workflows/ai-arman-foundation-ci.yml`
6. `.github/workflows/ai-arman-beta0-gcp-preflight.yml`
7. `.github/workflows/ai-arman-beta0-candidate-deploy.yml`
8. `Dockerfile.ai-arman-candidate`
9. `src/ai-arman-candidate.module.ts`
10. `src/main-ai-arman-candidate.ts`

Then start with the dependency/security audit. Do not redeploy beta0 just to prove it exists; the approved deploy already succeeded.
