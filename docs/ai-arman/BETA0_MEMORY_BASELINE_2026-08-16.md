# AI Arman beta0 memory baseline — 2026-08-16

## Purpose

Measure the current AI Arman foundation candidate container before considering any Cloud Run memory reduction from 512 MiB to 256 MiB.

This was an isolated GitHub Actions container test only. No Cloud Run deploy, service update, traffic change, IAM change, or feature activation occurred.

## Image under test

The test built the current branch with the same `Dockerfile.ai-arman-candidate` used by the normal candidate path.

All beta0 feature flags stayed disabled:

- `AI_ARMAN_WIDGET_PREVIEW_ENABLED=false`
- `AI_ARMAN_MODEL_INTERPRETATION_ENABLED=false`
- `AI_ARMAN_MODEL_SHADOW_ENABLED=false`
- `AI_ARMAN_MODEL_PROMOTION_ENABLED=false`

## Unconstrained baseline

The container started successfully and passed the foundation endpoint readiness check.

Measured container memory:

- Idle after startup: **39.27 MiB**
- After 200 successful foundation requests: **46.12 MiB**
- OOM killed: **false**

## Isolated 256 MiB test

A second container was started with a hard Docker memory/swap limit of 256 MiB.

Results:

- Startup/readiness: **PASS**
- Idle memory: **33.54 MiB / 256 MiB**
- 10 load waves of 20 concurrent foundation requests each: **PASS**
- Observed post-wave memory range: approximately **32.59–34.97 MiB**
- Widget-disabled check: **PASS** (`/ai-arman/widget/beta0-preview` remained HTTP 404)
- Final OOM killed: **false**
- Final container state: **running**

Successful GitHub Actions run:

- Run ID: `31967995523`
- Job ID: `95215972005`

## Interpretation

For the current beta0 foundation workload, 256 MiB provides substantial measured headroom. The observed memory footprint stayed below 50 MiB even after the unconstrained 200-request test and below 35 MiB in the post-wave measurements under the 256 MiB hard limit.

This supports 256 MiB as technically viable for the **current foundation-only beta0 container**.

It does not prove that 256 MiB will remain sufficient after model clients, richer product/order integrations, caches, larger request payloads, tracing, or other future runtime features are enabled. Memory should be re-measured when those capabilities are introduced.

## Deployment decision

The live private Cloud Run service remains at **512 MiB** after this measurement. No production/beta0 service mutation was made as part of the test.

A future change to 256 MiB should be treated as a separate cost-optimization deployment gate, with private-service verification and rollback awareness.
