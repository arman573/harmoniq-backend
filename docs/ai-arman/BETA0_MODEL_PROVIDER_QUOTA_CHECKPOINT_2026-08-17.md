# AI Arman beta0 – model provider quota checkpoint

Date: 2026-08-17
Repository: `arman573/harmoniq-backend`
Branch: `feature/ai-arman-foundation-v1`
Draft PR: #18

## Result

The isolated real OpenAI provider smoke reached the provider but failed with the safe backend classification:

- Cloud Run task exit code: `42`
- AI Arman classification: `quota`
- Client mapping: OpenAI HTTP `429` -> `model_interpretation_quota`

This is not a Google Cloud Secret Manager or runtime IAM failure.

## What was proven

- Secret Manager secret `ai-arman-openai-api-key` exists with version 1 enabled.
- Runtime service account `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com` has Secret Manager Secret Accessor on the dedicated secret.
- A transient Cloud Run Job can start with that runtime identity and inject secret version 1 as `OPENAI_API_KEY`.
- The immutable smoke image was successfully built and pushed.
- The isolated job reached the model provider path.
- No secret value, raw provider body, prompt, customer data or API credential was printed.
- The provider returned a condition classified by the client as quota/rate-limit (`429`).

## Immutable smoke image

Verified smoke image digest:

`sha256:5ed92d23fee206b2eb8f453ae91398ae32d243e2b7f3e8c02c8166236b90e674`

The transient Job used:

- model: `gpt-5-mini`
- interpretation enabled only inside the isolated job
- input price configuration: `0.25 USD / 1M tokens`
- output price configuration: `2 USD / 1M tokens`
- secret version: `ai-arman-openai-api-key:1`
- max retries: 0
- task timeout: 60 seconds

The successful classifier execution metadata was:

- execution: `ai-arman-model-provider-smoke-sw98v`
- task count: 1
- safe exit code: 42
- classification: quota

The transient Cloud Run Job was deleted after classification.

## Source validation

Before the provider smoke, the current branch passed:

- 80 test suites
- 542 tests
- TypeScript build
- runtime dependency audit during container build: 0 vulnerabilities
- full dependency audit during container build: 0 vulnerabilities

## Live beta0 remains unchanged

No live service deployment was performed during this provider investigation.

Live remains:

- service `harmoniq-ai-arman-beta0`
- revision `harmoniq-ai-arman-beta0-00002-2kq`
- private IAM
- 256 MiB
- 1 vCPU
- min 0 / max 1
- widget preview OFF
- model interpretation OFF
- model shadow OFF
- model promotion OFF
- production actions disabled

No customer traffic was sent to a model.

## External blocker

OpenAI API quota/billing must be available for the API project/key before the provider smoke can pass. Do not weaken Google Cloud IAM, switch on live shadow, or change model promotion to work around this blocker.

After OpenAI quota/billing is available, rerun the isolated provider smoke first. Only after it passes should a 0%-traffic/private candidate and then a tightly budgeted shadow deployment be considered.

## Cleanup

Temporary workflows used for secret binding, logging diagnostics, task metadata probing and final classification were removed after use.

The synthetic smoke entrypoint `src/ai-arman/model/model-provider-smoke.ts` remains intentionally available so the same safe test can be rerun after the external quota/billing blocker is resolved.
