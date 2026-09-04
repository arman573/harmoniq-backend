# AI Arman admin reply recovery candidate trigger / boundary diagnosis

- Functional application source before docs-only triggers: `df0b13d2f5a8d5d4254f91369e5b543602f5637a`
- First candidate deploy attempt: workflow run `33527934323`.
- Source verification PASS: **true**.
- Full AI suite PASS: **676/676 tests**.
- Build PASS: **true**.
- Local candidate Docker verification build PASS: **true**.
- GCP authentication PASS: **true**.
- First pre-deploy production-boundary snapshot gate: **failure**.
- First immutable image build/push after boundary failure: **not executed**.
- First new Cloud Run candidate: **not deployed**.
- Production traffic cutover: **false**.
- IAM mutation: **false**.
- Customer/Returns/Vendre/Gmail/nShift write: **false**.

Read-only boundary diagnosis at `2026-09-01T16:03:57Z` proved the current positive traffic boundary is one revision at `100%`: `harmoniq-ai-arman-beta0-retadminv2-1`. The older candidate workflow was stale because it required exactly `99/1` traffic and `maxScale=2` before doing any deploy work.

The existing canonical candidate workflow has now been repaired in-place to snapshot the actual positive-traffic set, require total positive traffic to remain 100%, require private IAM, and compare the exact positive-traffic snapshot before/after deployment. It still requires the new recovery candidate itself to remain at `0%`.

## 2026-09-03 bounded-timeout recovery

- Owning-layer source commit: `732c5e7bd15a763d217969d8c748bb51c2efe418`.
- Foundation CI push run `33766173165`: **PASS**.
- Foundation CI PR run `33766179313`: **PASS**.
- Full suite: **676/676 PASS**.
- Reply timeout default: **18 seconds**.
- `admin_reply_model_timeout` is intentionally **not retried** synchronously.
- Incomplete/provider transient recovery remains retryable once.
- Safety contract remains `sendsCustomerMessage=false` and `executesWrites=false`.
- This docs-only trigger deploys the same application code as a fresh private **0%-traffic** candidate through the existing canonical v2 workflow.
- No production cutover is authorized.

After candidate PASS, the next gate is the real `HQR-2493528` read-only reply-draft through the Returns zero-traffic candidate.
