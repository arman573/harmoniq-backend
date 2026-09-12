# AI Arman beta0 — post-audit handoff — 2026-08-16

## Repo / branch

- Repo: `arman573/harmoniq-backend`
- Branch: `feature/ai-arman-foundation-v1`
- Draft PR: #18

## Current live beta0 baseline

The existing Cloud Run beta0 remains unchanged during the work documented here:

- Project: `harmoniq-210513`
- Region: `europe-north1`
- Service: `harmoniq-ai-arman-beta0`
- Revision verified remotely: `harmoniq-ai-arman-beta0-beta0-d6311f3d-1-1`
- Service remains private
- Memory remains **512 MiB**
- min 0 / max 1
- 1 vCPU
- CPU throttling enabled
- startup CPU boost disabled
- concurrency 20
- timeout 30 s

Feature state remains OFF:

- widget preview OFF
- model interpretation OFF
- model shadow OFF
- model promotion OFF
- production actions disabled

No PR merge, public exposure, customer rollout, model activation, IAM mutation, or Cloud Run deploy was performed during the dependency audit, remote smoke, or memory measurement phases.

## Dependency/security phase — COMPLETE

Baseline audit before remediation:

- Runtime audit: 6 vulnerabilities — 3 high, 2 moderate, 1 low
- Full audit: 10 vulnerabilities — 6 high, 2 moderate, 2 low

Remediation was tested in isolated CI copies first. No blind `npm audit fix` was used and no major dependency upgrade was required.

Important commits:

- `5bb9372cded23fdc8a2fc4617ccefe85905d46b2` — runtime dependency remediation
- `e6dd6f403181a9374796a937fd46a4f1870937dc` — dev/build dependency remediation
- `3616e4bd7aa624580a230e9cc5e3f03b6ba89fdf` — temporary audit cleanup
- `4230138a27694736c85322af027f4e2bc0ecad21` — permanent security-audit documentation

Final verified result:

- `npm audit --omit=dev`: 0 vulnerabilities
- full `npm audit`: 0 vulnerabilities
- package.json unchanged
- unit tests PASS
- TypeScript build PASS
- isolated candidate container build PASS
- isolated candidate smoke PASS

Ordinary final foundation CI:

- Run `31967805348`
- Job `95215525693`
- Conclusion: success

Permanent report:

- `docs/ai-arman/DEPENDENCY_SECURITY_AUDIT_2026-08-16.md`

## Authenticated private remote smoke — COMPLETE

First token attempt used `gcloud auth print-identity-token --audiences=...` and failed because gcloud rejected the external/WIF account type. This occurred before any Cloud Run request and was not a service failure.

The successful method used `google-github-actions/auth@v3` in `id_token` mode with the Cloud Run URL as audience.

Verified remotely against the existing private service:

- WIF auth PASS
- private IAM boundary PASS
- same revision still live PASS
- ID token generation PASS
- authenticated `/ai-arman/foundation`: HTTP 200
- foundation payload PASS
- `productionActionsEnabled == false`
- authenticated `/ai-arman/widget/beta0-preview`: HTTP 404
- widget remains disabled PASS

Successful remote-smoke run:

- Run `31967929943`
- Job `95215817768`

Permanent report:

- `docs/ai-arman/BETA0_PRIVATE_REMOTE_SMOKE_2026-08-16.md`

Temporary remote-smoke workflow was removed after verification.

## Memory measurement — COMPLETE

The current candidate image was measured in isolated GitHub Actions only. Cloud Run was not changed.

Unconstrained candidate:

- idle: 39.27 MiB
- after 200 successful foundation requests: 46.12 MiB
- OOM: false

Hard 256 MiB isolated container:

- startup/readiness PASS
- idle: 33.54 MiB
- 10 waves x 20 concurrent foundation requests PASS
- measured post-wave range: ~32.59–34.97 MiB
- widget-disabled check PASS
- final OOM: false
- final container state: running

Memory run:

- Run `31967995523`
- Job `95215972005`
- Conclusion: success

Permanent report:

- `docs/ai-arman/BETA0_MEMORY_BASELINE_2026-08-16.md`

Temporary memory workflow was removed after verification.

## Current conclusion

256 MiB has very large measured headroom for the **current foundation-only beta0 workload**. This does not guarantee future model/integration workloads will fit; memory must be re-measured as richer runtime features are activated.

The live service intentionally remains at 512 MiB for now.

## Exact next gate

The next step is a **separate private cost-optimization deploy gate** if/when explicitly approved:

1. update only Cloud Run memory from 512 MiB to 256 MiB using the existing private beta0 safety profile
2. do not change image/features/IAM/public access unless a fresh candidate is intentionally being deployed
3. verify min 0 / max 1, 1 vCPU, throttling, no boost, concurrency 20, timeout 30 s
4. verify all AI/widget/model flags remain false
5. verify no `allUsers` / `allAuthenticatedUsers`
6. run authenticated remote foundation smoke
7. verify widget endpoint remains 404
8. confirm revision/service healthy and document rollback target

Do not perform that live service mutation implicitly. Treat it as a distinct deploy approval gate.

## Working rule

Arman should not be used as a code-paste or GitHub intermediary. Read/change GitHub, run Actions, inspect logs, test, document, and clean temporary workflows directly through tools. Give Arman a manual action only when it is genuinely impossible to perform with available tools.
