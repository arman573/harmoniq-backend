# AI Arman – next-chat handoff: provider green, shadow not live yet

Date: 2026-08-17
Repository: `arman573/harmoniq-backend`
Branch: `feature/ai-arman-foundation-v1`
Draft PR: #18 `AI Arman foundation v1`
Branch head before this handoff: `e86671f14f3dd188f57ed54d78afb5e60a3b76b3`

## Read this first

This is the current continuation checkpoint for AI Arman. The next chat should read this file first, then:

1. `docs/ai-arman/BETA0_MODEL_PROVIDER_QUOTA_CHECKPOINT_2026-08-17.md`
2. `docs/ai-arman/BETA0_MODEL_SHADOW_PREFLIGHT_2026-08-16.md`
3. `docs/ai-arman/BETA0_256MI_LIVE_BASELINE_2026-08-16.md`
4. `docs/ai-arman/DEPENDENCY_SECURITY_AUDIT_2026-08-16.md`
5. `docs/ai-arman/BETA0_PRIVATE_REMOTE_SMOKE_2026-08-16.md`
6. `docs/ai-arman/NEXT_CHAT_BETA0_POST_AUDIT_HANDOFF_2026-08-16.md`
7. `docs/ai-arman/NEXT_CHAT_BETA0_DEPLOY_HANDOFF_2026-08-16.md`

Do not restart the project diagnosis from scratch.

---

## Working rule from Arman

Arman does **not** want to act as a code-paster, command intermediary or GitHub operator.

For this project:

- ChatGPT should perform code changes directly in GitHub.
- ChatGPT should create commits directly in GitHub.
- ChatGPT should create/run GitHub Actions tests directly.
- ChatGPT should inspect GitHub Actions logs directly.
- ChatGPT should build/deploy/test/clean up through GitHub/WIF when permissions allow.
- Take coherent larger work blocks; do not require Arman to repeatedly write `kör` for every tiny sub-step.
- Only give Arman a manual task when it is genuinely impossible with available tools, for example entering a payment card or changing an OpenAI billing setting in the OpenAI web UI.
- Never ask Arman to paste secrets, API keys, private keys or deploy-hook URLs into chat.
- Never claim a phase is complete before it has been verified.

---

# Product goal

AI Arman is intended to become Harmoniq's Swedish free AI adviser before and after purchase.

Core architecture principle:

`AI tolkar -> backend bestämmer -> verifierade system levererar fakta -> AI formulerar svaret`

The AI must never invent or become the authority for:

- price;
- stock;
- INCI;
- verified product facts;
- order status;
- tracking;
- return/reclamation facts;
- identity-sensitive customer/order data.

Identity-sensitive operations must always go through verified backend/customer/order access. The model must not be given production tools that allow it to bypass those rules.

The current milestone is **safe model shadow evaluation**, not public AI answers.

---

# Current live beta0 baseline

Cloud Run project: `harmoniq-210513`
Region: `europe-north1`
Service: `harmoniq-ai-arman-beta0`
Live revision: `harmoniq-ai-arman-beta0-00002-2kq`

Known verified live settings:

- service is private;
- no `allUsers`;
- no `allAuthenticatedUsers`;
- runtime service account: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`;
- 256 MiB memory;
- 1 vCPU;
- min instances 0;
- max instances 1;
- CPU throttling enabled;
- startup CPU boost disabled;
- concurrency 20;
- timeout 30 seconds;
- widget preview OFF;
- model interpretation OFF;
- model shadow OFF;
- model promotion OFF;
- production actions disabled;
- no customer-visible AI widget;
- no PR merge.

The memory change from 512 MiB to 256 MiB was deployed through a guarded live gate and verified. The current foundation workload has a very large memory margin at 256 MiB.

Do not change these unrelated settings during the shadow phase.

---

# Infrastructure / IAM already solved

Dedicated GitHub deployment service account:

`github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`

Runtime service account:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

WIF provider:

`projects/222024985388/locations/global/workloadIdentityPools/github-actions/providers/github-harmoniq`

Artifact Registry repository:

`harmoniq-containers`

Important least-privilege findings:

- the deployer intentionally does not have broad Secret Manager list permissions;
- the deployer intentionally does not have broad Cloud Logging Viewer access;
- do not broaden IAM merely for convenience;
- runtime Secret Manager access was granted only to the dedicated AI Arman OpenAI secret.

---

# OpenAI secret is now configured

Dedicated Secret Manager resource:

`ai-arman-openai-api-key`

Secret version used by tests:

`1`

Runtime identity with Secret Manager Secret Accessor on this dedicated secret:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

The secret value has never been printed into GitHub logs, source, documentation or chat.

Do not copy the key into GitHub Actions secrets or plain Cloud Run environment variables. Keep it as a Secret Manager reference.

---

# Dependency/security work completed

A full dependency audit/remediation was completed before the model phase.

Initial state:

- runtime audit: 6 vulnerabilities;
- full/dev audit: 10 vulnerabilities.

After verified lockfile remediation:

- runtime audit: 0 vulnerabilities;
- full/dev audit: 0 vulnerabilities.

`package.json` was intentionally kept unchanged during the lockfile-only remediation.

Full CI after remediation passed tests, TypeScript build, candidate container build and container smoke.

See `docs/ai-arman/DEPENDENCY_SECURITY_AUDIT_2026-08-16.md` for package-level details.

---

# Private beta0 remote smoke completed

Authenticated remote smoke against the private Cloud Run service passed:

- private IAM boundary: PASS;
- `/ai-arman/foundation`: HTTP 200;
- foundation payload validated;
- `.productionActionsEnabled == false`;
- `/ai-arman/widget/beta0-preview`: HTTP 404;
- widget remained disabled.

No public IAM grant was needed.

---

# Model shadow safety boundary already reviewed

The implementation separates shadow from promotion:

- `AI_ARMAN_MODEL_SHADOW_ENABLED` controls provider evaluation;
- `AI_ARMAN_MODEL_PROMOTION_ENABLED` separately controls whether a valid model candidate may replace deterministic interpretation;
- with promotion false, deterministic backend interpretation remains authoritative.

Other confirmed safety properties:

- provider has no production tools;
- strict structured/JSON output is used;
- backend derives identity requirements rather than trusting the model;
- email addresses are redacted before provider input;
- provider errors fail closed;
- orchestration already has timeout, concurrency, calls/minute and token budgets.

**Promotion must remain false throughout the first live shadow phase.**

---

# Cost-accounting hardening completed

A real gap was found before model activation: the shadow orchestrator already had USD budgets, but the OpenAI provider did not populate `estimatedCostUsd`.

That was fixed before any live model activation.

The model configuration now fails closed unless all of these are explicitly configured:

- model interpretation enabled;
- API key present;
- valid model identifier;
- positive input price per million tokens;
- positive output price per million tokens.

The provider calculates estimated cost from actual input/output token usage and passes it into the existing per-call/per-minute shadow budget checks.

Tests were added for:

- default disabled behavior;
- missing pricing fail-closed behavior;
- invalid pricing rejection;
- explicit pricing activation;
- provider cost calculation;
- refusal when activation is incomplete.

Full source/container CI passed after this hardening.

Current smoke pricing configuration used for `gpt-5-mini`:

- input: `0.25 USD / 1M tokens`;
- output: `2 USD / 1M tokens`.

Before using these values for a future long-lived deployment, verify that they are still the intended/current API prices rather than blindly copying historical values.

---

# Provider smoke journey – what failed and why

A synthetic provider smoke entrypoint exists:

`src/ai-arman/model/model-provider-smoke.ts`

It is intentionally safe and emits classification through process exit codes rather than printing raw provider bodies or secrets.

An immutable smoke image was built and pushed with digest:

`sha256:5ed92d23fee206b2eb8f453ae91398ae32d243e2b7f3e8c02c8166236b90e674`

The isolated Cloud Run Job used:

- runtime identity `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`;
- secret `ai-arman-openai-api-key:1`;
- model `gpt-5-mini`;
- max retries 0;
- task timeout 60 seconds;
- synthetic input only;
- no customer traffic;
- no live Cloud Run service mutation.

Initially the real provider smoke consistently returned:

- safe exit code `42`;
- classification `quota`;
- OpenAI HTTP 429 mapped to `model_interpretation_quota`.

This happened in several executions, including:

- `ai-arman-model-provider-smoke-sw98v`;
- `ai-arman-model-provider-smoke-gx7kl`;
- `ai-arman-model-provider-smoke-q6lp7`;
- `ai-arman-model-provider-smoke-fhkfm`;
- `ai-arman-model-provider-smoke-k2fgz`.

The repeated 429s proved that Google Secret Manager/IAM and provider reachability were working; the blocker was OpenAI API billing/quota.

---

# OpenAI billing issue is now resolved enough for a successful provider call

Arman manually entered the OpenAI billing UI because this is not something ChatGPT can safely/actually do through GitHub.

Observed billing setup after the fix:

- API credit balance had been 0 before purchase;
- auto-reload is now OFF;
- Arman purchased 10 USD of OpenAI API credits;
- the payment method remained inside the OpenAI billing UI and was never shared in chat;
- no secret/API key was exposed.

After this purchase, the same isolated provider smoke was rerun.

Execution:

`ai-arman-model-provider-smoke-6ng4r`

Critical result from Cloud Run:

`Execution [ai-arman-model-provider-smoke-6ng4r] has successfully completed.`

This is the first real provider-green result after the quota blocker.

Therefore the following path is now proven together:

- Secret Manager secret injection;
- runtime identity;
- OpenAI API authentication;
- OpenAI billing/quota availability;
- `gpt-5-mini` provider call;
- synthetic model smoke process completing successfully.

---

# Important diagnostic bug discovered in the successful rerun

The GitHub Actions wrapper still concluded red after the successful Cloud Run execution because its post-execution classifier always polled Cloud Run task metadata for `lastAttemptResult.exitCode`.

For the successful execution `ai-arman-model-provider-smoke-6ng4r`:

- `gcloud run jobs execute --wait` returned success;
- Cloud Run explicitly reported that the execution successfully completed;
- task count was 1;
- `lastAttemptResult.exitCode` was not exposed in the polled metadata;
- the workflow eventually classified this as `metadata_not_available` and marked the GitHub step failed.

This is a **diagnostic workflow bug, not a provider failure**.

The next implementation should fix the wrapper logic:

- if `gcloud run jobs execute --wait` returns exit code 0, classify provider smoke as PASS immediately;
- only inspect safe task exit codes when `gcloud run jobs execute --wait` itself fails;
- still delete the temporary Cloud Run Job in `always()` cleanup;
- never print raw provider payloads or secret values.

Do not misdiagnose `ai-arman-model-provider-smoke-6ng4r` as a failed model call.

---

# Cost safety – current state and remaining manual gate

Arman explicitly requires that this project must not accidentally create high OpenAI costs.

Already done:

- OpenAI auto-reload is OFF;
- only 10 USD of API credits were purchased for this phase;
- backend model config has explicit token pricing;
- backend has per-call/per-minute USD budget controls;
- backend has timeout/concurrency/calls-per-minute/token controls;
- promotion is still OFF;
- no customer model traffic exists yet.

Still observed before the latest provider success:

- OpenAI project `Default project` had a project spend limit of **500 USD**;
- the visible spend alert was at 100% / 500 USD.

That is much too permissive for this beta phase even though auto-reload is OFF.

**Before any live shadow traffic is enabled, reduce the OpenAI project spend limit to approximately 10 USD/month (or another deliberately tiny beta limit explicitly chosen by Arman) and add low spend alerts.**

This specific OpenAI billing UI change is a legitimate manual task for Arman because ChatGPT does not have an OpenAI billing/admin connector capable of performing it. Do not ask Arman to do code/GitHub work for this.

Do not assume the UI's project spend limit is a hard enforcement boundary unless the current UI explicitly says so. Treat our backend budgets and the 10 USD prepaid/auto-reload-off setup as independent safety layers.

---

# What has NOT happened yet

Do not confuse provider-green with shadow-live.

The following are still NOT done:

- live beta0 does not have `OPENAI_API_KEY` attached;
- live model interpretation is not enabled;
- live model shadow is not enabled;
- model promotion is not enabled;
- no customer-visible AI response is enabled;
- no customer chat is being sent to OpenAI in production;
- no 0%-traffic shadow candidate has been verified yet;
- no live shadow telemetry has been verified yet;
- no PR merge has happened;
- no public IAM has been added;
- no order/tracking/return AI production action has been enabled.

Live should still be treated as the safe deterministic beta0 revision `harmoniq-ai-arman-beta0-00002-2kq` until a new candidate is explicitly verified and promoted through a separate gate.

---

# Exact next steps

## Gate 0 – finish OpenAI cost guard before live shadow

Manual only if not already done when the next chat starts:

1. Open OpenAI API Platform project `Default project`.
2. Go to Settings -> Limits.
3. Reduce project spend limit from the previously observed 500 USD to approximately 10 USD/month for beta testing.
4. Add low alerts, for example around 2 USD, 5 USD and 8 USD if the current UI allows it.
5. Keep auto-reload OFF.
6. Do not paste payment information, API keys or screenshots containing secrets into chat.

Once Arman confirms this, ChatGPT takes over again.

## Gate 1 – repair and permanently verify the provider smoke harness

ChatGPT should do this in GitHub:

1. Inspect the current provider smoke entrypoint and temporary workflow history.
2. Implement a small safe reusable/manual provider-smoke workflow rather than relying on a deleted temporary workflow rerun.
3. Treat a successful `gcloud run jobs execute --wait` as PASS.
4. Only use safe exit-code classification on failed executions.
5. Keep one synthetic request only.
6. Keep max retries 0.
7. Ensure cleanup always deletes the temporary Job.
8. Run it once and require a clean green GitHub Action.
9. Remove it again if it is intentionally temporary, or retain it only if it is clearly safe and useful as a permanent gated diagnostic.

This should be a tiny-cost test.

## Gate 2 – build a new immutable candidate from the latest clean branch

Do not deploy the older live application image merely to enable shadow.

1. Build from the latest branch head containing:
   - dependency remediation;
   - cost-accounting hardening;
   - provider smoke/hardening code;
   - all current AI Arman tests.
2. Run unit tests and TypeScript build.
3. Run dependency audits/container smoke.
4. Push a new immutable Artifact Registry image.
5. Record the exact digest for rollback/audit.

## Gate 3 – private 0%-traffic shadow candidate

Create a private candidate without moving customer traffic.

Preserve:

- private IAM;
- runtime service account;
- 256 MiB;
- 1 vCPU;
- min 0 / max 1;
- CPU throttling;
- no startup CPU boost;
- concurrency 20;
- timeout 30 seconds.

Candidate-only model settings should be deliberately conservative:

- attach `OPENAI_API_KEY` from Secret Manager, never plaintext;
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=true`;
- `AI_ARMAN_MODEL_SHADOW_ENABLED=true`;
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`;
- widget remains OFF;
- production actions remain disabled;
- deliberately low calls/minute;
- deliberately low concurrency;
- low token budgets;
- low per-call USD budget;
- low per-minute USD budget.

Use the existing Cloud Run candidate/deploy patterns in the repository and inspect them before writing. Prefer a tagged 0%-traffic/private revision or an equally isolated candidate mechanism that allows authenticated direct testing without sending normal customer traffic to it.

Do not change 100% live traffic at this gate.

## Gate 4 – authenticated candidate shadow verification

Test only synthetic/internal prompts first.

Prove all of the following:

1. private authentication still required;
2. foundation endpoint still works;
3. widget endpoint remains disabled;
4. provider shadow actually runs;
5. provider output satisfies structured schema;
6. deterministic backend response remains the authoritative response because promotion is false;
7. identity-sensitive intent remains backend-controlled;
8. no production actions execute;
9. token and estimated-cost telemetry is bounded;
10. no secret/prompt/customer-sensitive raw data appears in logs.

Include representative synthetic cases such as:

- beauty/product recommendation intent;
- order/tracking intent requiring identity;
- return/claim intent requiring identity;
- ambiguous/unsupported input;
- malformed provider/failure path if it can be safely simulated.

## Gate 5 – only then consider tiny live shadow traffic

This is a separate live-mutation decision.

If Gate 4 is completely green, prepare a guarded live-shadow deployment with:

- interpretation ON;
- shadow ON;
- promotion OFF;
- customer-visible deterministic answers unchanged;
- very low model budgets;
- rollback to the previous deterministic revision ready;
- authenticated post-deploy smoke;
- verification that private IAM did not change.

Do not enable promotion in the same change.

Promotion is a later phase after enough shadow evidence exists.

---

# Rollback rule

The known deterministic live revision before shadow work is:

`harmoniq-ai-arman-beta0-00002-2kq`

Before any live shadow mutation, capture current revision/image/env/IAM/scaling/runtime-service-account settings again and keep a one-command/one-workflow rollback path.

Rollback immediately if any of these change unexpectedly:

- private IAM;
- deterministic response invariants;
- promotion flag;
- production action flag;
- runtime identity;
- cost budgets;
- secret injection;
- health/foundation endpoint;
- widget remains disabled;
- unexpected cost growth.

---

# Important mistakes / dead ends not to repeat

1. Do not interpret OpenAI HTTP 429 as a Google Secret Manager failure. Secret injection/runtime IAM were already proven.
2. Do not broaden Secret Manager list permissions just to inspect secrets. The dedicated secret is already known.
3. Do not grant broad Cloud Logging Viewer merely for provider diagnosis.
4. Do not rely on Cloud Run task `lastAttemptResult.exitCode` being present after a successful Job. The successful `6ng4r` execution proved it may be absent.
5. Do not keep rerunning a known quota-failing smoke after quota has already been diagnosed; billing was the blocker and has now been funded.
6. Do not attach the OpenAI key as plaintext env or GitHub source/workflow text.
7. Do not turn shadow and promotion on together.
8. Do not move customer traffic just to test a provider candidate.
9. Do not enable public IAM.
10. Do not ask Arman to paste code or run GitHub commands that ChatGPT can perform itself.

---

# Current concise status

**Working:**

- deterministic AI Arman foundation;
- private Cloud Run beta0;
- 256 MiB live baseline;
- WIF/GitHub deploy identity;
- private authenticated remote smoke;
- dependency audits at zero vulnerabilities;
- model shadow/promotion separation;
- cost-accounting hardening;
- dedicated Secret Manager OpenAI credential;
- runtime secret access;
- isolated Cloud Run provider Job;
- real `gpt-5-mini` provider call after funding;
- successful provider execution `ai-arman-model-provider-smoke-6ng4r`.

**Not working / still to fix:**

- provider-smoke GitHub wrapper incorrectly marks a successful execution red when successful task exit-code metadata is absent;
- OpenAI project spend limit was still observed at 500 USD and should be reduced before live shadow;
- no live shadow candidate has yet been verified.

**Next goal:**

Get one clean green reusable provider smoke, then build and verify a new immutable **private 0%-traffic shadow candidate** with strict cost budgets and `promotion=false`. After synthetic authenticated verification proves deterministic customer output is unchanged, consider a separate tiny live-shadow gate. Public/customer AI and promotion remain later milestones.
