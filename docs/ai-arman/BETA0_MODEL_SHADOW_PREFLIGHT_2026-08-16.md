# AI Arman beta0 – model shadow preflight

Date: 2026-08-16
Repository: `arman573/harmoniq-backend`
Branch: `feature/ai-arman-foundation-v1`
Draft PR: #18

## Purpose

Prepare the next AI Arman beta0 phase where a language model may interpret synthetic/internal chat input in shadow mode while the deterministic backend remains authoritative.

This phase must not make the model customer-visible and must not allow model output to execute production actions.

## Safety boundary confirmed

The existing implementation keeps shadow evaluation separate from promotion:

- `AI_ARMAN_MODEL_SHADOW_ENABLED` controls whether a provider candidate is evaluated.
- `AI_ARMAN_MODEL_PROMOTION_ENABLED` separately controls whether a valid model candidate can replace deterministic interpretation.
- With promotion disabled, the deterministic backend response remains authoritative.
- The model provider has no tools and receives a strict JSON schema.
- Backend code derives identity requirements instead of trusting the model.
- Email addresses are redacted before provider input.
- Provider failures fail closed.
- Shadow orchestration already applies timeout, concurrency, calls-per-minute and token budgets.

## Hardening added during this preflight

A cost-accounting gap was found before live shadow activation: the shadow orchestrator supported USD budgets, but the OpenAI provider did not populate `estimatedCostUsd`.

The model configuration is now fail-closed unless all of the following are explicitly configured:

- model interpretation enabled;
- API key present;
- valid model identifier;
- positive input cost per million tokens;
- positive output cost per million tokens.

The OpenAI provider now calculates estimated cost from actual reported input/output token usage and passes that value to the existing per-call and per-minute shadow budget checks.

Added tests cover:

- default-disabled behavior;
- pricing-missing fail-closed behavior;
- invalid pricing rejection;
- explicit pricing activation;
- provider cost calculation;
- provider refusal when activation is incomplete.

A full AI Arman foundation CI run after the hardening passed unit tests, TypeScript build, candidate container build and isolated container smoke.

## Credential findings

Read-only preflights were performed without printing or reading any secret value.

GitHub Actions:

- repository secret `OPENAI_API_KEY`: not present for the test workflow.
- therefore no real model request was sent.

Google Cloud beta0 service:

- current service: `harmoniq-ai-arman-beta0`
- current live revision at this checkpoint: `harmoniq-ai-arman-beta0-00002-2kq`
- current Cloud Run environment names are only:
  - `NODE_ENV`
  - `AI_ARMAN_WIDGET_PREVIEW_ENABLED`
  - `AI_ARMAN_MODEL_INTERPRETATION_ENABLED`
  - `AI_ARMAN_MODEL_SHADOW_ENABLED`
  - `AI_ARMAN_MODEL_PROMOTION_ENABLED`
- `OPENAI_API_KEY` is not currently attached to the service, neither as a plain environment variable nor as a Secret Manager reference.

The dedicated GitHub deployer service account intentionally does not have `secretmanager.secrets.list`, so broad Secret Manager discovery was not granted or added merely for this investigation.

## Live state remains safe

No model activation was performed during this preflight.

Live remains:

- private Cloud Run service;
- 256 MiB memory;
- 1 vCPU;
- min 0 / max 1;
- CPU throttling enabled;
- startup CPU boost disabled;
- widget preview OFF;
- model interpretation OFF;
- model shadow OFF;
- model promotion OFF;
- production actions disabled.

No public exposure, customer widget rollout, PR merge or IAM broadening was performed.

## External blocker

A real provider credential is required before a genuine provider smoke or live shadow run can happen.

The credential must never be pasted into source code, workflow YAML, GitHub logs, documentation or chat. It should be stored in a dedicated secret store and injected into Cloud Run as a secret reference.

Recommended secret resource name for the beta0 runtime: `ai-arman-openai-api-key`.

## Next gate after credential exists

1. Verify the credential through a synthetic provider smoke only.
2. Keep `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`.
3. Use explicit current model pricing configuration so cost accounting remains active.
4. Build and deploy an immutable image from the clean branch head rather than reusing the older live image.
5. Preserve private IAM, runtime service account, 256 MiB, 1 vCPU, min 0/max 1, CPU throttling, no startup boost, concurrency 20 and timeout 30 seconds.
6. Start shadow with deliberately low calls/minute, concurrency, token and USD budgets.
7. Run authenticated remote smoke and prove deterministic customer output is unchanged while shadow provider telemetry records successful internal evaluation.
8. Roll back immediately if provider configuration, cost accounting, private IAM or deterministic-response invariants fail.

Promotion remains a later, separate gate and must not be enabled as part of initial shadow activation.
