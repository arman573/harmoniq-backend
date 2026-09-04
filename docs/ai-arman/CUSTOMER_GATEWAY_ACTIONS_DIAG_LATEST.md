# AI Arman – customer gateway Actions diagnostic latest

- Recorded at: 2026-08-19T15:38:48Z
- Diagnostic source commit: `ce386369b5f05bac9b9056fd3162560ef6a6a718`
- Target workflow: `ai-arman-customer-gateway-private-candidate-v2-once.yml`
- Target source commit: `75e339f18b1784c3a7ac8c8639d59065f4b41d8e`
- Mode: **GitHub Actions metadata only; no GCP mutation**

- Target run found: **yes**
- Run ID: `32269387136`
- Run status: `completed`
- Run conclusion: `failure`
- Created: `2026-08-19T15:19:46Z`
- Updated: `2026-08-19T15:20:48Z`
- Job count: **1**
- Job summary: `deploy-private-candidate:completed:failure`
- First failed step: **Re-run source gate**

## Step results

- deploy-private-candidate / Set up job: status=completed, conclusion=success
- deploy-private-candidate / Checkout exact branch head: status=completed, conclusion=success
- deploy-private-candidate / Set up Node.js: status=completed, conclusion=success
- deploy-private-candidate / Re-run source gate: status=completed, conclusion=failure
- deploy-private-candidate / Authenticate deployer: status=completed, conclusion=skipped
- deploy-private-candidate / Set up Google Cloud SDK: status=completed, conclusion=skipped
- deploy-private-candidate / Snapshot live boundary: status=completed, conclusion=skipped
- deploy-private-candidate / Build and push immutable image: status=completed, conclusion=skipped
- deploy-private-candidate / Deploy separate private gateway candidate: status=completed, conclusion=skipped
- deploy-private-candidate / Verify private IAM and unchanged live AI: status=completed, conclusion=skipped
- deploy-private-candidate / Mint private ID token: status=completed, conclusion=skipped
- deploy-private-candidate / Smoke private Cloud Run gateway: status=completed, conclusion=skipped
- deploy-private-candidate / Write PASS checkpoint: status=completed, conclusion=skipped
- deploy-private-candidate / Post Set up Node.js: status=completed, conclusion=skipped
- deploy-private-candidate / Post Checkout exact branch head: status=completed, conclusion=success
- deploy-private-candidate / Complete job: status=completed, conclusion=success

No logs, credentials, secrets, tokens, customer data, or response bodies are written to this checkpoint.
