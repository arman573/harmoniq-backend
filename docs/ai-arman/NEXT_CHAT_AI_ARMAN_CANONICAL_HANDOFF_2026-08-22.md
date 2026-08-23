# NEXT CHAT HANDOFF — AI ARMAN RESOLVER / REVIEWED-REPLY LEARNING

**Updated:** 2026-08-23

**Primary repo:** `arman573/harmoniq-backend`

**Canonical source + deploy branch:** `feature/ai-arman-foundation-v1`

**PR #18:** `AI Arman foundation v1` — open, draft, do not merge to `main` merely because individual capabilities are live.

**Former resolver source PR #21:** merged by squash into `feature/ai-arman-foundation-v1` at `2d45f5c15fa507e528a6f2a0b17ac5f95c1809bc`.

**Returns repo:** `arman573/harmoniq-returns-module`

**Returns resolver branch:** `feature/ai-arman-case-resolver-ui`

**Risk:** LEVEL 3 — customer data / AI actions / writes.

Standing rule: `HARMONIQ ADVANCED MODULE BUILD CONTRACT v2` + Harmoniq Development Operating System.

---

# GOAL

AI Arman in Returns admin follows:

`verified case -> understand current customer need -> propose solution + reply -> admin reviews -> admin approves -> one allowlisted action may execute -> approved reply may become a private learning example`

Stage 1 remains **approval required**. Autonomous customer sending is not enabled.

AI may learn handling patterns, tone and approved reply examples. Prior lessons are never source of truth for price, stock, order, tracking, return status or other current facts; verified backend/system facts always win.

---

# CURRENT STATE

Reviewed-reply learning, AI resolver and Returns resolver are **IMPLEMENTED + TESTED + DEPLOYED** to verified tagged 0%-resolver revisions.

Frontend learning UI is verified in the production Cloudflare bundle.

The only learning item not yet called fully **LIVE OBSERVED** is the first real persistent lesson written by a naturally reviewed and sent customer reply. Do not create a synthetic customer message or fake lesson merely to tick this box.

---

# CANONICAL SOURCE OF TRUTH

Resolver/learning source is now consolidated into:

`feature/ai-arman-foundation-v1`

Source consolidation commit:

`2d45f5c15fa507e528a6f2a0b17ac5f95c1809bc`

Canonical CI run on that exact merged head:

`32657431486` — **PASS**

Passed on merged head:

- unit tests
- TypeScript build
- isolated AI candidate container build
- isolated AI candidate smoke
- customer gateway container build
- customer gateway boundary smoke

PR #21 is merged/closed and no longer owns deploy responsibility.

---

# REVIEWED-REPLY LEARNING DESIGN

Separate admin field:

`Intern lärnotering till AI Arman`

This is not the product-decision `Adminnotering`.

Safety invariants:

1. Internal learning rationale is private and never part of customer transport.
2. Customer transport receives only the approved customer subject/message.
3. After a successful explicitly approved customer send, the approved reply may be saved as a learning example.
4. If learning-save fails after the send, the customer message must never be sent again.
5. Raw `internalRationale` may be stored privately but is stripped before future customer-reply model context.
6. `approvedReplyExample` is handling/style precedent, never factual precedent.
7. Fresh verified case/order/product/stock facts always override lessons.
8. An approved reply may become a lesson even when the extra internal learning note is empty.

---

# AI BACKEND — VERIFIED RUNTIME

Canonical workflow:

`.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Frozen deployed resolver/learning source used by the current stable resolver runtime:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Canonical v4 run:

`32580717752`

Verified in that run:

- 107/107 test suites PASS
- 648/648 tests PASS
- build PASS
- Docker PASS
- WIF PASS
- immutable image push PASS
- HQR-2494077 read-only prepare PASS
- `approved:false` execute blocked
- real write during verification = false
- customer message during verification = false

Image digest:

`sha256:db42496f6f2448c165f98940e86141c1f62b0d06648bdff6c5c89cc7bd2c8101`

Stable resolver revision:

`harmoniq-ai-arman-beta0-resv4-07aacf15-15`

Stable tag:

`resolver-ready-3298af83`

Stable resolver URL:

`https://resolver-ready-3298af83---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

Resolver revision intentionally has 0% normal traffic. Positive production traffic was unchanged by the stable-tag move.

Known previous good AI resolver revision:

`harmoniq-ai-arman-beta0-resv4-07aacf15-9`

---

# PRIVATE LEARNING STORAGE

Bucket:

`gs://harmoniq-210513-ai-arman-learning`

Object:

`ai-arman/support-learning-v1.json`

Verified:

- region `EUROPE-NORTH1`
- storage class `STANDARD`
- uniform bucket-level access enabled
- public access prevention enforced
- no public principal
- runtime identity `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- runtime has `roles/storage.objectUser` at bucket scope
- runtime project roles = `[]`

Permanent sanitized evidence:

`arman573/harmoniq-account-identity-bridge/docs/automation-status/ai-arman-learning-bucket-provision-20260822.json`

AI deployer was not granted a broad Storage role.

---

# RETURNS RESOLVER — VERIFIED RUNTIME

Repo:

`arman573/harmoniq-returns-module`

Canonical workflow:

`.github/workflows/deploy-ai-arman-resolver-returns-write-ready-once.yml`

Final canonical run:

`32581393936`

Source:

`7c915d6f12711e60fd920ba3a5ecc09c5cc4bb2f`

Image digest:

`sha256:8612870f529854648efbda0fff02725f277bd147ba8504b17c26ca034dfa6469`

Stable resolver revision:

`harmoniq-returns-api-airesolver-7c915d6f-26`

Stable tag:

`resolver-ready-431fc50f`

Stable URL:

`https://resolver-ready-431fc50f---harmoniq-returns-api-cw6q5ekseq-lz.a.run.app`

Verified:

- focused resolver tests/build/Docker PASS
- immutable image provenance PASS
- AI learning config PASS
- real prepare PASS
- `approved:false` blocked
- unsupported approved action blocked
- real supported write during verification = false
- customer message during verification = false
- positive production Returns traffic unchanged

---

# FRONTEND

Production branch:

`refactor-admin-return-flow-cleanup`

Learning UI production commit:

`31e84781d8381d20951e55ac246451df48c58bc3`

Verified bundle:

`assets/index-CuJT6P6R.js`

Runtime marker proof: 5/5, including `Intern lärnotering till AI Arman`.

---

# CLEANUP COMPLETED

- old v3 resolver deploy path removed
- temporary v4 parity diagnostic removed
- temporary GCS/IAM discovery/provision workflows removed
- obsolete discovery JSON removed; final bucket evidence retained
- superseded resolver deploy workflows removed from former ops source branch
- obsolete resolver trigger documents removed
- temporary ops-branch CI trigger removed
- PR #21 source package squash-merged into foundation
- PR #21 closed by merge
- no v5/v6 resolver deploy path created

A stray inert branch named `noop` was accidentally created during tooling. It contains no unique changes and has no deploy/runtime role. Remove it when a safe delete-ref capability is available; do not build anything on it.

---

# CURRENT GATE / NEXT ACTION

Current gate: **post-consolidation architecture cleanup + first natural learning observation**.

Next safe sequence:

1. Keep `feature/ai-arman-foundation-v1` as the single canonical AI Arman source/deploy branch for this phase.
2. Do not reactivate old resolver deploy workflows.
3. When the next real admin-reviewed customer reply is sent with learning enabled, verify read-only that the learning object generation/timestamp changed without exposing lesson text.
4. On a later naturally similar case, verify that approved reply style/handling can influence the draft while old factual details are not reused.
5. Continue read-only workflow/branch cleanup by responsibility, not filename. Do not mass-delete model-shadow, telemetry, audit or customer-gateway workflows without proving they are obsolete.
6. PR #18 remains draft until a separate main/source-of-truth release decision is made.

---

# DEFINITION OF DONE FOR LEARNING PHASE

Technical learning infrastructure is implemented, tested and deployed with a verified privacy boundary and least-privilege storage. Frontend and both resolver chains are live-verified at read-only/blocked-write level.

The learning phase becomes fully **LIVE OBSERVED** only when the first natural admin-approved customer reply produces a persistent lesson and that write is verified read-only.
