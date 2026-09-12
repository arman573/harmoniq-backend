# AI Arman beta0 — 256 MiB live baseline

Date: 2026-08-16

## Result

The private Cloud Run beta0 service was safely changed from 512 MiB to 256 MiB.

- Service: `harmoniq-ai-arman-beta0`
- Region: `europe-north1`
- New live revision: `harmoniq-ai-arman-beta0-00002-2kq`
- Traffic: 100% to the new revision
- Memory: 256 MiB
- CPU: 1 vCPU
- Min instances: 0
- Max instances: 1
- Concurrency: 20
- Timeout: 30 seconds
- CPU throttling: enabled
- Startup CPU boost: disabled
- Runtime service account unchanged: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- Image unchanged from the previous beta0 baseline

## Safety checks passed before mutation

The live gate verified the existing baseline before changing anything:

- memory was exactly 512 MiB
- CPU was exactly 1 vCPU
- runtime service account matched the dedicated AI Arman runtime account
- startup probe remained `/ai-arman/foundation` on port 8080
- concurrency remained 20
- timeout remained 30 seconds
- min/max scale remained 0/1
- private IAM boundary contained no `allUsers` or `allAuthenticatedUsers`
- all AI activation flags remained `false`

Baseline revision before the memory change:

`harmoniq-ai-arman-beta0-beta0-d6311f3d-1-1`

## Mutation

Only this intended Cloud Run setting was changed:

`memory: 512 MiB -> 256 MiB`

The update created revision:

`harmoniq-ai-arman-beta0-00002-2kq`

No new application image was built or deployed by this change.

## Post-mutation verification

All checks passed after the update:

- memory is exactly 256 MiB
- image is unchanged
- CPU is still 1 vCPU
- runtime service account is unchanged
- startup probe is unchanged
- concurrency is unchanged
- timeout is unchanged
- CPU throttling remains enabled
- startup CPU boost remains disabled
- min/max scale remains 0/1
- private IAM boundary remains intact
- widget preview remains disabled
- model interpretation remains disabled
- model shadow remains disabled
- model promotion remains disabled

## Authenticated remote smoke

The new 256 MiB revision was invoked through the existing GitHub WIF service-account identity.

Results:

- `/ai-arman/foundation` -> HTTP 200
- foundation payload -> PASS
- `productionActionsEnabled == false` -> PASS
- `/ai-arman/widget/beta0-preview` -> HTTP 404
- widget disabled -> PASS

## Rollback

The temporary live gate had an automatic defensive rollback to 512 MiB for any post-mutation failure.

Rollback was not triggered because all post-update checks and the authenticated remote smoke passed.

## Supporting pre-live memory measurement

Before the live change, the candidate container was tested locally in GitHub Actions with a hard 256 MiB Docker limit:

- idle memory around 33.5 MiB
- 10 waves of requests stayed around 32.6–35.0 MiB
- no OOM
- process remained running
- widget remained disabled

The unconstrained container was roughly 39 MiB idle and 46 MiB after 200 requests.

## Security/dependency baseline

Immediately before this live-memory phase:

- runtime npm audit: 0 vulnerabilities
- full npm audit: 0 vulnerabilities
- unit tests: PASS
- TypeScript build: PASS
- isolated candidate container build: PASS
- isolated container smoke: PASS
- authenticated private remote smoke: PASS

## Current activation state

This memory optimization does NOT activate AI functionality.

The following remain off:

- widget preview
- model interpretation
- model shadow
- model promotion
- production actions

The service remains private.

## Next safe project step

Do not make the service public and do not activate customer-facing AI yet.

The next work should be a separately reviewed beta0 capability/activation step using the established principle:

`AI interprets -> backend decides -> verified systems provide facts -> AI formulates the answer`

Any model activation should start in a non-customer-facing shadow/controlled path, with verified data boundaries and explicit cost/safety gates before promotion.
