# AI Arman beta0 private remote smoke — 2026-08-16

## Scope

This gate verified the already-deployed private beta0 Cloud Run service remotely from GitHub Actions without deploying a new revision, changing traffic, changing IAM, making the service public, or enabling any AI/model/widget feature flags.

Target:

- Project: `harmoniq-210513`
- Region: `europe-north1`
- Service: `harmoniq-ai-arman-beta0`
- Verified revision: `harmoniq-ai-arman-beta0-beta0-d6311f3d-1-1`
- GitHub WIF service account: `github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`

## First attempt and diagnosis

The first read-only remote-smoke attempt successfully verified the service and private IAM boundary, but `gcloud auth print-identity-token --audiences=...` failed before any Cloud Run request was made:

```text
Invalid account type for --audiences. Requires valid service account.
```

This was a Google Cloud CLI token-generation limitation for the externally federated account context, not a Cloud Run failure and not evidence of an invocation/IAM problem.

No IAM change was made to work around it.

## Successful method

The second attempt kept the existing WIF setup and used `google-github-actions/auth@v3` in its native `id_token` mode with the private Cloud Run service URL as the token audience.

Verified results:

- WIF authentication: **PASS**
- Existing service read: **PASS**
- Private IAM boundary (`allUsers` / `allAuthenticatedUsers` absent): **PASS**
- Revision unchanged: **PASS**
- Service-account ID token minted through existing WIF: **PASS**
- Authenticated `GET /ai-arman/foundation`: **HTTP 200**
- Foundation payload validation: **PASS**
  - `ok == true`
  - `service == "ai-arman"`
  - `phase == "foundation-v1"`
  - `productionActionsEnabled == false`
- Authenticated `GET /ai-arman/widget/beta0-preview`: **HTTP 404**
- Widget remains disabled: **PASS**

Successful GitHub Actions run:

- Run ID: `31967929943`
- Job ID: `95215817768`

## Safety state after smoke

Unchanged:

- service remains private
- no public IAM member added
- no Cloud Run deploy
- no traffic change
- no IAM mutation
- widget preview OFF
- model interpretation OFF
- model shadow OFF
- model promotion OFF
- production actions disabled
- no PR merge

## Next gate

The dependency/security audit and authenticated private remote smoke are now both green.

The next safe optimization gate is to measure real memory use of the current candidate container in isolated CI before considering a reduction from 512 MiB to 256 MiB. The deployed Cloud Run service must remain unchanged during measurement.
