# AI Arman telemetry bootstrap required — 2026-08-18

## Why this manual bootstrap is required

GitHub Actions run `32156609134` verified read-only that the current AI Arman deployer has none of the IAM write permissions required to create or bind a dedicated telemetry identity, and it also lacks `monitoring.timeSeries.list`.

Do not broaden `github-ai-arman-deployer`. Keep deployment and telemetry identities separate.

## Target identity

Create exactly:

`github-ai-arman-telemetry@harmoniq-210513.iam.gserviceaccount.com`

Display name:

`GitHub AI Arman telemetry reader`

Purpose:

- authenticate GitHub Actions through the existing branch-restricted WIF provider;
- read Cloud Monitoring time-series only;
- never deploy Cloud Run;
- never change Cloud Run IAM or traffic;
- never access Secret Manager;
- never enable model promotion.

## Minimal owner-applied bootstrap

Run once from an authenticated owner Cloud Shell / gcloud session:

```bash
gcloud iam service-accounts create github-ai-arman-telemetry \
  --project=harmoniq-210513 \
  --display-name="GitHub AI Arman telemetry reader"

gcloud projects add-iam-policy-binding harmoniq-210513 \
  --member="serviceAccount:github-ai-arman-telemetry@harmoniq-210513.iam.gserviceaccount.com" \
  --role="roles/monitoring.viewer" \
  --condition=None

gcloud iam service-accounts add-iam-policy-binding \
  github-ai-arman-telemetry@harmoniq-210513.iam.gserviceaccount.com \
  --project=harmoniq-210513 \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/222024985388/locations/global/workloadIdentityPools/github-actions/attribute.repository/arman573/harmoniq-backend"
```

`--condition=None` is intentional. The project already contains conditional IAM bindings, so an unconditional Monitoring Viewer binding must be stated explicitly to avoid the interactive condition prompt. If the service account was already created, do not recreate it; apply only the missing binding(s).

The existing WIF provider must remain branch-restricted to:

`refs/heads/feature/ai-arman-foundation-v1`

Do not add a broader repository or branch condition.

## Why Monitoring Viewer

Google documents `roles/monitoring.viewer` as read-only and includes `monitoring.timeSeries.list`, which is the permission Cloud Run documents for reading its metrics. This bootstrap deliberately avoids Monitoring Admin, Logging Viewer, Cloud Run Developer/Admin, Secret Manager access, Project Viewer/Editor/Owner, or any service-account administration role on the telemetry identity.

## Prepared post-bootstrap gate

After the identity exists, run:

`.github/workflows/ai-arman-live-shadow-telemetry.yml`

with exact approval input:

`VERIFY_AI_ARMAN_TELEMETRY`

The gate uses two identities deliberately:

1. existing deployer only for the already-proven Cloud Run boundary reads;
2. dedicated telemetry identity only for Cloud Monitoring metrics.

Before reading metrics it proves the telemetry identity has `monitoring.timeSeries.list` and does NOT have these obvious write/sensitive permissions:

- `run.services.update`
- `run.services.setIamPolicy`
- `iam.serviceAccounts.create`
- `resourcemanager.projects.setIamPolicy`
- `secretmanager.versions.access`

Then it reads `run.googleapis.com/request_count` for the deterministic and 1% shadow revisions and fails if the shadow revision has any 5xx responses in the observation window.

## Hard stops remain

- no traffic above 1%;
- no model promotion;
- no widget/public activation;
- no widening of the deployer IAM;
- no Cloud Run traffic/config change as part of telemetry bootstrap.
