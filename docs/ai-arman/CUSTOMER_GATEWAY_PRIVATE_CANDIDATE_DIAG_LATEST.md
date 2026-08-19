# AI Arman – customer gateway private candidate diagnostic latest

- Recorded at: 2026-08-19T15:37:13Z
- Diagnostic source commit: `0931ef6a79b889716f3be27494e43eee2f1e2ca1`
- Expected deployed source label: `75e339f1`
- Active identity: `github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`
- Mode: **read-only Cloud Run/IAM/runtime probes; no GCP mutation**

## Gateway service state

- Service exists: **no**
- Service describe: `failed`
- Revision: `-`
- Revision Ready: `unknown`
- Service URL present: **no**
- Runtime service account: `-`
- Max instances: `-`
- Concurrency: `-`
- Source label: `-`
- Source label matches expected deploy commit: **no**
- Image configured: **no**

## Gateway feature flags

- Customer widget: `-`
- Customer identity: `-`
- Gmail OTP: `-`
- Vendre customer directory: `-`
- Model interpretation: `-`
- Model shadow: `-`
- Model promotion: `-`

## Privacy / invocation probes

- IAM read: `not_attempted`
- Public allUsers/allAuthenticatedUsers IAM: `unknown`
- Identity-token probe: `not_attempted`
- /health HTTP: `not_attempted`
- /ai-arman/customer/widget.js HTTP: `not_attempted`
- /ai-arman/foundation HTTP: `not_attempted`

## Existing live AI boundary

- Live service read: `success`
- Positive traffic percentages sorted: `1/99`
- Live max instances: `2`

No secret values, ID tokens, customer data, IAM policies, or response bodies are written to this checkpoint.
