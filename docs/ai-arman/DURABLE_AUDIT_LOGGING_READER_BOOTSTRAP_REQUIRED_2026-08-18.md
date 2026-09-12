# AI Arman durable audit log reader bootstrap required — 2026-08-18

## Why this checkpoint exists

The read-only workflow `AI Arman durable audit logging IAM preflight` ran successfully and proved that the dedicated telemetry service account does **not** currently have `logging.logEntries.list`.

Latest evidence:

- workflow run: `32163657440`
- source commit: `a41e6034dcf57878f8f7c775aa8e98ee7772f662`
- `logging.logEntries.list`: `NO`
- `logging.logEntries.create`: `NO`
- `logging.sinks.create`: `NO`
- `run.services.update`: `NO`
- `run.services.setIamPolicy`: `NO`
- `secretmanager.versions.access`: `NO`

The workflow made no IAM, Cloud Run, traffic, secret, model-promotion or widget change.

## Minimum required IAM bootstrap

Dedicated telemetry identity:

`github-ai-arman-telemetry@harmoniq-210513.iam.gserviceaccount.com`

Grant exactly this project-level role in project `harmoniq-210513`:

`roles/logging.viewer` — Logs Viewer

Purpose: allow the dedicated telemetry reader to query future privacy-safe structured model-shadow audit entries through Cloud Logging.

Do **not** grant:

- `roles/logging.logWriter`
- `roles/logging.admin`
- `roles/logging.configWriter`
- `roles/logging.privateLogViewer`
- Cloud Run admin/developer roles
- Secret Manager access
- broad Editor/Owner roles

No application runtime service account needs this Logs Viewer role for writing. The application writes the privacy-safe JSON event to stdout and Cloud Run captures container logs through the platform.

## Owner-only manual step

The current GitHub/deployer identities do not have project IAM write permission, so ChatGPT cannot safely create this binding through the available GitHub tooling.

In Google Cloud Console:

1. Open project `harmoniq-210513`.
2. Go to IAM & Admin → IAM.
3. Find `github-ai-arman-telemetry@harmoniq-210513.iam.gserviceaccount.com`.
4. Edit principal.
5. Add one role: **Logs Viewer** (`roles/logging.viewer`).
6. Save.

Do not remove its existing Monitoring Viewer role or repo-scoped Workload Identity User binding.

## Verification after bootstrap

After the role is granted, rerun GitHub Actions workflow:

`AI Arman durable audit logging IAM preflight`

Expected result:

- `logging.logEntries.list: YES`
- `logging.logEntries.create: NO`
- `logging.sinks.create: NO`
- `run.services.update: NO`
- `run.services.setIamPolicy: NO`
- `secretmanager.versions.access: NO`
- decision/readiness: `YES`

Only after that proof should the next candidate-only durable-audit verification be designed or run.

## Hard stop

This checkpoint is **not** approval to:

- enable `AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED` live;
- deploy a new live-shadow revision;
- increase shadow traffic above 1%;
- enable model promotion;
- enable widget/public access;
- change provider budgets/concurrency;
- add logging writer roles.

The current production boundary remains unchanged until separately verified and explicitly approved.
