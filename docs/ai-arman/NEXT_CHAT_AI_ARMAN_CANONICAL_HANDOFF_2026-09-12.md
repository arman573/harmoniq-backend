# AI ARMAN / HARMONIQ RETURNS — CANONICAL PROJECT STATE

Datum: 2026-09-12
Canonical state time: 2026-09-12 17:27 Europe/Stockholm
Risknivå: Level 3
Primary repo: `arman573/harmoniq-backend`
Companion repo: `arman573/harmoniq-returns-module`

> Denna fil är projektets SENASTE CANONICAL CONTINUATION STATE. Den ersätter behovet av att läsa gamla AI Arman-/Returns-handoffs för att förstå NUVARANDE state. Äldre handoffs får användas endast som historik/evidence när denna fil uttryckligen hänvisar till redan bevisade resultat. Om denna handoff och en fresh read-only verifiering skiljer sig: VERKLIGHETEN VINNER.

---

## 1. PROJECT IDENTITY

### Projektnamn

**AI Arman + Harmoniq Returns Admin / Customer Experience**

### Primary repo

`arman573/harmoniq-backend`

- default branch: `main`
- canonical active branch: `feature/ai-arman-foundation-v1`
- relevant PR: **#18 `AI Arman foundation v1`**

### Companion repo

`arman573/harmoniq-returns-module`

- default branch: `main`
- canonical active branch: `refactor-admin-return-flow-cleanup`

### Syfte

AI Arman ska vara Harmoniqs säkra svenska AI-rådgivare före och efter köp och samtidigt fungera som en kontrollerad admin-assistent för kundärenden. Systemet ska kunna förstå fri kundtext, använda verifierade fakta från Harmoniqs system, formulera korrekta svar och föreslå eller verkställa strikt tillåtna åtgärder efter mänskligt godkännande.

Grundprincip:

`AI tolkar -> backend verifierar/bestämmer -> verifierade system levererar fakta -> AI formulerar -> människa godkänner writes/sändning`

Kundens formulering är alltid ett **påstående**, aldrig source of truth. Historiska supportmail är stil-/resonemangsexempel, inte bevis på aktuell order-, retur-, tracking-, pris- eller lagerstatus.

### System/integrationer

Projektet hör ihop med:

- Harmoniqs kundwidget/webb
- AI Arman backend
- Harmoniq Returns admin
- Vendre order-/kund-/produktdata
- nShift/tracking/retursedel där relevant
- Gmail/kundservice för kontrollerade kundsvar där relevant
- GCP Cloud Run
- GCS för durable state/learning/presentation
- OpenAI/model interpretation under backendkontroll

Google Ads/Control Center, Cloudflare och övriga fristående Harmoniq-projekt ingår inte i detta projekts nuvarande execution path.

---

## 2. EXACT FINAL GOAL

Det verkliga slutmålet är ett verifierat produktionssystem där:

1. kunden öppnar AI Arman på Harmoniq,
2. kan skriva fri svenska och få rådgivning före köp,
3. vid efterköpsfrågor kan identifieras/verifieras via säkra backendflöden,
4. AI Arman kan läsa verifierade order-, tracking-, retur- och produktfakta utan att hitta på fakta,
5. backend äger slutsats, policy och tillåtna actions,
6. AI Arman kan formulera ett mänskligt, Harmoniq-anpassat svar utifrån dessa verifierade fakta,
7. admin kan använda AI Arman i Returns admin för analys, svarsförslag och strikt namngivna actions,
8. kundsändning eller affärskritisk write sker endast genom canonical Returns-write-boundary och efter uttryckligt mänskligt godkännande,
9. kundwidgetens presentation/copy kan administreras från befintlig Returns admin via ett strikt begränsat kontrakt,
10. kundwidgeten konsumerar den publika read-only presentationen men behåller låsta funktionella fält från kompilerade defaults,
11. systemet failar säkert: saknad/ogiltig extern presentation ger kompilerade defaults; saknade verifierade affärsfakta ger ingen fabricerad fakta eller osäker write,
12. production state, immutable artifacts, rollback och regressioner är bevisade och dokumenterade.

DONE betyder alltså inte bara att en adminruta finns. Det betyder att hela säkra kedjan från kund/admin-input till verifierad fakta, AI-formulering, kontrollerad action och live customer experience fungerar i produktion utan dubbla owners eller dolda write-vägar.

---

## 3. PROJECT SCOPE

### Ingår

- AI Arman customer widget och dess backend-endpoints.
- Svensk fri chat/rådgivning.
- Identitets-/sessionsgränser för efterköpsfunktioner.
- Verifierade order-/tracking-/retur-/produktläsningar.
- Product recommendations byggda på verifierade systemdata.
- Admin case companion/resolver.
- `prepare` read-only analys.
- strikt namngivna admin-actions med explicit approval.
- Returns som owner av faktiska business writes.
- Customer Admin för begränsad presentationscopy.
- Durable presentation i Returns/GCS.
- Public read-only presentation projection.
- Framtida AI-backend consumer av denna projection.
- Regressioner för befintliga Returns-/Vendre-/trackingflöden.
- Production provenance, candidate, rollback och cleanup.

### Ingår uttryckligen inte

- autonomt refund-/betalnings-/cancel-/orderändringsmandat utan separat typed action/policy/gate.
- fri modellgenererad URL/metod/payload mot interna API:er.
- att kundwidgeten ärver adminbehörighet.
- arbitrary Vendre/nShift/Gmail writes från AI-modellen.
- Google Ads-writes eller Ads Control Center.
- generell Cloudflare-arkitektur.
- unrelated bundle/performance cleanup i denna gate.
- ny adminapp, nytt repo, ny authmodell, nytt service account eller ny deployarkitektur för presentationen.

### Viktiga återstående delar

- reconcila aktuell Returns production drift.
- få Returns Customer Admin-kandidaten säkert live.
- därefter koppla AI-backendens widget till Returns public presentation projection.
- verifiera end-to-end adminändring -> public projection -> AI widget utan authority escalation.
- pensionera gammal AI-backend presentation dual ownership först när migration/rollback är säker.
- slutlig cleanup/provenance/DoD.

---

## 4. RISK LEVEL

**Level 3.**

Skäl:

- projektet hanterar kunddata/order-/returfakta,
- har privata adminflöden,
- har integrationsaccess till Vendre, Gmail och nShift,
- innehåller AI-genererade förslag som kan leda till writes,
- vissa actions kan påverka kundärende/returstatus/sändning,
- production routing och IAM måste bevaras exakt,
- felaktig authority-separation kan skapa kunddata- eller write-risk.

Även den aktuella presentation-slicen är Level 3 eftersom den ligger i samma production runtime/admin/auth-yta och måste bevisa att den inte råkar utöka authority.

---

## 5. CURRENT GATE

### Aktuell gate

**RETURNS CUSTOMER ADMIN LIVE PROMOTION RECONCILIATION / PRODUCTION DRIFT GATE**

### Varför projektet är här

Returns-side Customer Admin är:

- ownership-locked,
- implementerad,
- source-testad,
- byggd,
- verifierad som 0%-candidate.

En live-promotion försöktes därefter via befintlig canonical promotion workflow, men den stoppade korrekt **före varje traffic write**.

Senaste promotion-run:

- workflow: `.github/workflows/promote-admin-media-ui-live-20260815.yml`
- run: `34695891753`
- job: `103559192279`
- conclusion: `failure`
- första kända divergence: `PROMOTION_PREFLIGHT_FAIL=old-live-revision`
- promotion step: SKIPPED
- post-promotion verify: SKIPPED

Workflowen förväntade:

`harmoniq-returns-api-apoll-b25bf74a-72 = 100%`

men production positive traffic matchade inte längre exakt den basen.

### Vad som krävs för Gate PASS

Fresh READ-ONLY GATE 0 måste bevisa:

- faktisk aktuell Returns positive traffic state,
- exakt live revision,
- immutable image,
- runtime config/hash,
- IAM,
- AOC/ReturnPortal no-touch tags,
- provenance/source för den revision som ersatt den gamla basen,
- att Customer Admin candidate fortfarande är exakt rätt revision/image/tag och 0%,
- att nuvarande live är en legitim senare produktion och kan användas som ny prepromotion baseline.

Ingen promotion får göras mot en gissad eller stale baseline.

---

## 6. REPOSITORY SOURCE OF TRUTH

### AI backend — primary

Repo: `arman573/harmoniq-backend`

Default branch: `main`

Active canonical branch: `feature/ai-arman-foundation-v1`

PR: **#18 `AI Arman foundation v1`**

PR-state vid verifiering:

- open: yes
- draft: yes
- merged: no
- mergeable: yes
- base: `main`
- base SHA: `5b99a28ad3f09188c19405e62353f28a7d8cebf6`

Senaste AI application/source commit före denna docs-only handoff:

`45be62ba9aaf062691ddf91e8e7439fbd204a71a`

Commit message:

`Teach AI Arman verified return evidence semantics`

Detta är AI application/source baseline i current source state. Den nya handoff-committen är docs-only och är INTE en application/candidate SHA.

PR-fältet `merge_commit_sha` får inte beskrivas som faktisk merge eftersom PR #18 inte är merged.

### Returns companion

Repo: `arman573/harmoniq-returns-module`

Default branch: `main`

Active canonical branch: `refactor-admin-return-flow-cleanup`

Branch HEAD vid handoff-verifiering:

`6da4beb410d88bfb3b5fe2a690b18cbc518c6842`

Commit message:

`Retrigger customer admin promotion after workflow enable`

Detta är workflow/retrigger state, INTE Customer Admin application SHA.

Canonical Customer Admin application/source SHA:

`bb693d1b07ff1c522b4aba82fc5c4a118c586a83`

Commit message:

`Serve AI Arman customer admin SPA route`

Canonical successful Customer Admin candidate artifact är kopplad till denna application SHA.

---

## 7. PRODUCTION SOURCE OF TRUTH

### Returns service

GCP project: `harmoniq-210513`

Region: `europe-north1`

Cloud Run service: `harmoniq-returns-api`

Historiskt senast säkert bevisad baseline före drift:

- revision: `harmoniq-returns-api-apoll-b25bf74a-72`
- traffic: `100%` vid tidigare gate
- immutable image: `europe-north1-docker.pkg.dev/harmoniq-210513/cloud-run-source-deploy/harmoniq-returns-api@sha256:1d98a2fdc6e5091142cabd6a4b12a418e9717029b0110f925ca91f9b77c83d47`

**CURRENT Returns positive live revision as of this handoff: NOT PROVEN.**

Bevisat är att promotion-preflight 2026-09-12 13:15 UTC inte längre såg den exakta förväntade gamla live-revisionen som single 100% positive revision. Workflowen loggade inte den nya revisionen innan fail. Gissa inte vilken revision som är live.

Current Returns immutable live image: **NOT PROVEN**.

Current Returns application/source provenance: **NOT PROVEN** tills fresh Gate 0 reconcilar drift.

No-touch tags senast tidigare verifierade:

- `aoc-v10-3-20-menu -> harmoniq-returns-api-aocspd2-60`
- `order-issue-media-test -> harmoniq-returns-api-aocspd2-60`

Deras state efter drift måste verifieras fresh innan promotion.

### Returns Customer Admin candidate

Senast bevisad successful 0%-candidate:

- application/source SHA: `bb693d1b07ff1c522b4aba82fc5c4a118c586a83`
- revision: `harmoniq-returns-api-acadm-bb693d1b-74`
- image: `europe-north1-docker.pkg.dev/harmoniq-210513/cloud-run-source-deploy/harmoniq-returns-api@sha256:fdeb71c71bd04396dfe977f9ea743797569dcf46b877da4417dc45a113bca247`
- tag: `ai-customer-admin-test`
- traffic at candidate proof: `0%`
- successful candidate run: `34693533240`
- job: `103552956038`

Tag/revision/0%-state måste fresh-verifieras igen efter production drift innan promotion.

### AI Arman service

Cloud Run service: `harmoniq-ai-arman-beta0`

GCP project/region: `harmoniq-210513` / `europe-north1`

Senast historiskt bevisade general positive traffic i tillgängligt runtime-bevis från 2026-09-10:

`harmoniq-ai-arman-beta0-retadminv2-1 = 100%`

Samma runtime proof visade `PRIVATE_IAM_UNCHANGED=true` och `AI_GENERAL_POSITIVE_TRAFFIC_UNCHANGED=true` under en separat 0%-admin-reply adoption.

**Current AI positive live revision as of 2026-09-12 17:27: NOT FRESHLY PROVEN.**

**Current immutable AI live image digest: NOT PROVEN.**

Den separat bevisade 0%-admin-reply kandidaten i Sep-10-flödet var:

- revision `harmoniq-ai-arman-beta0-arrt-bedc762c-230`
- image `sha256:041a49a3a0b020a1d76727a66abe7ad59f952bd568cec6d4bea351fed501b493`

Den image-digesten får INTE felaktigt kallas general 100% live image.

### Canonical deploy ownership

Returns Customer Admin candidate: befintlig workflow

`.github/workflows/deploy-unified-order-admin-candidate-20260815.yml`

Returns Customer Admin promotion: befintlig workflow

`.github/workflows/promote-admin-media-ui-live-20260815.yml`

Ingen ny deployväg ska skapas för att kringgå drift-gaten.

---

## 8. CANONICAL EXECUTION PATH

### A. Customer widget presentation

Målarkitektur efter återstående gates:

`Returns admin UI`
-> `Returns existing admin auth`
-> `bounded ai-arman-customer-ui-v1 validation`
-> `Returns GCS presentation object`
-> `GET /api/public/ai-arman/customer-presentation`
-> `AI backend read-only client`
-> `schema validation + allowed-field patch merge over compiled defaults`
-> `AiArmanCustomerWidgetService.renderScript()`
-> `GET /ai-arman/customer/widget.js`
-> browser widget.

Nuvarande AI-backend path före migration är fortfarande:

`GET /ai-arman/customer/widget.js`
-> `AiArmanCustomerController.getWidget()`
-> `AiArmanCustomerWidgetPresentationStore.readForWidget()`
-> AI-backendens egna GCS/default-store
-> `AiArmanCustomerWidgetService.renderScript()`.

Detta är en kvarvarande dual-ownership/legacy-read som ska ersättas först efter Returns-side live pass.

### B. Customer conversation

`browser widget/free text`
-> `src/ai-arman/widget/customer/ai-arman-customer.controller.ts`
-> session/identity verification där efterköpsdata krävs
-> `ChatRequestParser`
-> relevant chat/orchestrator/domain service
-> verified integration/read services
-> backend-safe conclusion
-> `AiArmanCustomerResponseService`
-> kundsvar i widget.

### C. Admin case companion/resolver

`Returns admin case / admin intent`
-> AI Arman admin companion/resolver `prepare`
-> verifierade case/order/return/tracking facts
-> deterministic policy/domain analysis
-> AI draft/recommendation
-> explicit human approval
-> named typed action
-> `ReturnsAdminGatewayClient`
-> private Returns full-admin gateway
-> existing Returns route/domain service
-> Vendre/Gmail/nShift/GCS write where that named action permits it
-> read-back/result/audit.

AI-modellen får aldrig konstruera fri intern URL/metod/write-payload som canonical execution path.

---

## 9. CURRENT CANONICAL ARCHITECTURE

### AI/business-rule ownership

Backend bestämmer fakta/policy/authority. Model output är för tolkning/formulering inom kontrakt, inte source of truth.

Viktiga AI backend owners:

- customer controller: `src/ai-arman/widget/customer/ai-arman-customer.controller.ts`
- widget renderer: `src/ai-arman/widget/customer/ai-arman-customer-widget.service.ts`
- compiled presentation contract/defaults: `src/ai-arman/widget/customer/ai-arman-customer-widget.presentation.ts`
- current legacy AI presentation store: `src/ai-arman/widget/customer/ai-arman-customer-widget-presentation.store.ts`
- customer identity/session/response services i samma `widget/customer/`-område
- chat/orchestrators under `src/ai-arman/chat/` och specialistdomäner
- verified integrations under `src/ai-arman/integrations/`
- admin resolver/action services under `src/ai-arman/admin/`

### Returns ownership

Returns äger:

- verkliga case-/return-businessregler,
- full-admin gateway,
- actual business writes,
- customer-send boundary,
- Vendre/nShift/Gmail adapters för writes där tillåtet,
- existing admin auth/host,
- nya Customer Admin presentation owner/persistence/projection.

Customer Admin owners:

- GCS store: `server/src/services/aiArmanCustomerPresentationStore.js`
- API routes: `server/src/routes/aiArmanCustomerPresentationRoutes.js`
- server wiring/SPA route: `server/src/index-gcs-admin.js`
- frontend API client: `src/services/aiArmanCustomerPresentationService.js`
- admin UI: `src/features/admin/AiArmanCustomerAdmin.jsx`
- route owner: `src/App.jsx`

### State/storage

- Returns Customer Admin presentation canonical storage: GCS via existing Returns runtime identity.
- object: `AI_ARMAN_CUSTOMER_PRESENTATION_GCS_FILE || ai-arman/customer-presentation-v1.json`
- bucket: `AI_ARMAN_CUSTOMER_PRESENTATION_GCS_BUCKET || CASE_STORAGE_GCS_BUCKET`
- no new bucket/SA/IAM path.
- AI backend has legacy presentation GCS storage which is temporary until migration cleanup.
- private AI learning uses existing GCS learning storage; learning examples never override current verified business facts.

### Write boundaries

- customer widget: no admin authority.
- resolver `prepare`: read-only.
- resolver `execute`: explicit approval + typed action only.
- presentation config write: Returns protected admin `PUT`, bounded contract only.
- actual Vendre/nShift/Gmail writes: Returns-owned implementation only.

### Runtime/deploy

- AI backend: GCP Cloud Run `harmoniq-ai-arman-beta0`.
- Returns: GCP Cloud Run `harmoniq-returns-api`.
- candidate/live promotion is GitHub Actions + immutable Cloud Run revisions/images.

---

## 10. ARCHITECTURE DECISIONS

### Decision 1 — verified facts outrank AI/user claims

Why: prevent fabricated order/status/return/tracking/product facts.

Owner: backend/domain integrations.

Do not reintroduce: model/user text as authoritative state.

### Decision 2 — Returns owns actual admin/business writes

Why: centralize policy, validation and adapters.

Owner: `harmoniq-returns-module`.

Replaced/blocks: arbitrary AI-originated direct writes.

Do not reintroduce: model-built URLs, methods or mutation payloads.

### Decision 3 — Customer Admin lives in existing Returns admin

Why: existing host/auth/runtime already owns business admin surface.

Owner: Returns.

Do not reintroduce: standalone admin app/repo/auth system.

### Decision 4 — Customer presentation persists in Returns GCS, not local moduleSettings file

Why: Cloud Run local filesystem is not proven shared/durable across instances.

Owner: Returns presentation store.

Rejected path: `data/moduleSettings.json` as canonical presentation source.

### Decision 5 — Returns public projection is a PATCH, not full widget authority

Why: admin may edit copy but must not alter assistant identity, avatar, functional action IDs/categories/status semantics or any business authority.

Owner: Returns bounded contract + AI merge layer.

Do not reintroduce: full arbitrary presentation object from admin as customer widget source.

### Decision 6 — AI backend consumer must use public read-only endpoint only

Why: customer rendering does not need admin credentials.

Owner: future AI read client.

Do not reintroduce: Returns `ADMIN_ACCESS_TOKEN` inside AI widget consumption.

### Decision 7 — compiled defaults remain safe fallback

Why: widget must remain available if Returns projection is unavailable/invalid.

Owner: `AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION`.

Do not reintroduce: hard failure of widget because presentation service is down.

### Decision 8 — old AI-backend presentation GCS/admin path is legacy, not future owner

Why: Customer Admin ownership is now locked to Returns.

Owner after migration: Returns.

Do not delete prematurely before migration/rollback evidence; do not expand it or make it canonical again.

### Decision 9 — no production promotion on stale provenance

Why: a legitimate later production gate may have moved live revision.

Owner: promotion workflow/GATE 0.

Do not reintroduce: hardcoded stale baseline overwrite or blind rollback.

---

## 11. ACCEPTANCE CRITERIA

Project-level acceptance requires all of the following:

1. current Returns and AI production provenance is fresh and exact.
2. Returns Customer Admin source tests pass.
3. exact Customer Admin candidate revision/image is verified at 0% before promotion.
4. current live baseline and candidate have compatible expected runtime/IAM/no-touch config.
5. Returns Customer Admin is promoted through canonical workflow only after full preflight.
6. post-promotion verifies exact live revision/image, IAM and preserved tags.
7. `/admin/ai-arman` serves correct SPA.
8. unauth admin presentation endpoint returns 401.
9. auth admin GET works.
10. public presentation GET works without admin token and exposes only safe projection.
11. bounded validation rejects unknown authority/data fields.
12. Customer Admin promotion itself does not create config via hidden PUT.
13. AI backend adds a read-only Returns projection consumer only after Returns live pass.
14. AI consumer validates exact contract and ignores/rejects unknown/locked fields.
15. allowed copy is merged over compiled defaults; locked defaults remain unchanged.
16. unavailable/invalid projection fails open to compiled defaults.
17. AI consumer sends no Returns admin token and performs no write.
18. AI consumer gets its own source tests, candidate proof and explicit live promotion gate.
19. after both sides are live, a controlled approved end-to-end config update/readback proves admin copy reaches actual customer widget.
20. end-to-end test proves forbidden fields cannot change customer widget authority/identity/actions.
21. existing Vendre status regression remains valid (`2495068 = Skickad` unless business data legitimately changes and test fixture is consciously updated).
22. Returns `/api/cases` stays within established guardrail (<= 8 s in this gate).
23. existing return-interpretation semantics remain intact.
24. existing tracking/Vendre-first + nShift fallback remains intact.
25. no customer message, Vendre write or nShift write occurs during read-only/candidate probes.
26. rollback path is proven against the freshly captured prepromotion production revision, not a stale historical revision.
27. dual presentation ownership is cleaned up after migration.
28. latest canonical handoff reflects final production truth.

---

## 12. NO-TOUCH BEHAVIOR

Do not break/change without a separate explicit gate:

- current Returns case/admin behavior outside Customer Admin presentation.
- AOC tag/path.
- ReturnPortal/order-issue-media tag/path.
- Returns admin auth semantics.
- `/api/cases` latency/cache behavior.
- existing Vendre status/order-context mapping.
- Vendre-first tracking with nShift fallback.
- return evidence semantics.
- AI admin resolver authority model.
- explicit approval requirement for writes/customer send.
- customer widget identity/session security.
- product recommendation verified-facts boundaries.
- private IAM posture.
- model-promotion safety flags unless a separate model gate approves changes.
- no customer-visible internal learning rationale.
- no duplicate customer send if learning persistence fails after send.

Closed return interpretation semantics to preserve:

- `pickup_point_return_verified`
- `return_received_verified`
- `customer_claim_return_unverified`
- `order_cancelled_no_return_proof`
- `no_return_signal`

Priority:

`pickup > verified received > customer claim > cancelled-only > none`

Customer claim + cancelled is still unverified return evidence.

---

## 13. PROJECT ROADMAP / WHAT REMAINS

### NU — blocker/current gate

1. READ-ONLY reconcile current Returns production drift.
2. identify exact live revision/image/runtime/traffic/IAM/tags/provenance.
3. reverify exact Customer Admin 0%-candidate.

### Därefter — Returns Customer Admin live

4. retarget existing promotion workflow to the freshly proven live baseline only if drift is legitimate.
5. rerun full fail-closed prepromotion checks.
6. promote exact candidate to 100% only after PASS.
7. post-verify same read-only invariants.
8. rollback to freshly captured prepromotion revision on any failed postcheck.
9. record Returns-side PRODUCTION LIVE PASS.

### Därefter — AI-backend presentation consumption

10. fresh AI backend GATE 0.
11. inspect current live AI revision/image/config before implementation/deploy.
12. implement narrow read-only Returns public presentation consumer.
13. validate `ai-arman-customer-ui-v1` patch.
14. merge only allowed fields over compiled defaults.
15. fallback to compiled defaults on unavailable/invalid projection.
16. source tests/build.
17. zero-traffic/private candidate using existing canonical AI deploy pattern.
18. runtime proof: no admin token, no write, correct merge, fallback works, existing customer/admin behavior preserved.
19. separate explicit live promotion gate.
20. post-live verification/rollback.

### End-to-end completion

21. controlled approved admin presentation write in production.
22. GET/readback verifies stored config.
23. public projection reflects allowed copy only.
24. actual live customer widget reflects allowed fields.
25. forbidden/locked fields remain compiled defaults.
26. revert or retain test copy intentionally; verify final desired presentation.

### Cleanup

27. inventory old AI presentation GCS/admin endpoint usage/data.
28. migrate anything still needed or prove no migration needed.
29. retire/disable legacy dual-owner path safely.
30. clean obsolete candidate tags/workflow trigger patches only when safe and without deleting useful audit history.
31. final source/production provenance + regression suite + canonical handoff.

---

## 14. CURRENT STATE

### IMPLEMENTED

AI backend:

- customer widget foundation/rendering.
- identity/session boundary.
- customer chat/orchestration.
- verified integration clients for relevant product/order/return/tracking facts.
- admin companion/resolver and typed action model.
- learning/style precedent mechanisms.
- return evidence semantics at current source head.
- legacy AI presentation store/admin endpoint.

Returns:

- bounded Customer Admin presentation contract.
- GCS presentation store.
- protected admin GET/PUT.
- public read-only GET projection.
- `/admin/ai-arman` frontend.
- explicit SPA route.

### TESTED

- AI backend current head CI: PASS, run `34591772952` for application source `45be62ba...`.
- Returns presentation focused suite: 5/5 PASS.
- Returns exact frontend production build: PASS.
- Customer Admin candidate runtime: PASS at successful 0%-candidate.
- `/api/cases` regression/guardrail passed in candidate.
- real Vendre status regression passed in candidate.
- IAM/no-touch tags unchanged during successful candidate proof.

### DEPLOYED

- Returns Customer Admin exact candidate deployed as 0%-candidate `harmoniq-returns-api-acadm-bb693d1b-74` with image `sha256:fdeb71c...` at last successful candidate proof.
- legacy/core AI Arman runtime has multiple historical deployed revisions/tags.

### LIVE VERIFIED

- Customer Admin presentation: **NOT LIVE VERIFIED**.
- Its latest promotion attempt failed before traffic write.
- AI general production was last positively verified as `harmoniq-ai-arman-beta0-retadminv2-1 = 100%` on 2026-09-10, but is **NOT FRESHLY VERIFIED for 2026-09-12**.
- Current Returns positive live revision/image after detected drift: **NOT PROVEN**.

---

## 15. TEST / CHECK STATUS

### AI source

Canonical current source check:

- `AI Arman foundation CI`
- run: `34591772952`
- head SHA: `45be62ba9aaf062691ddf91e8e7439fbd204a71a`
- conclusion: SUCCESS.

### Returns Customer Admin source

Focused suite:

`server/test/aiArmanCustomerPresentationStore.test.js`

5/5 PASS:

1. accepts bounded presentation copy fields,
2. rejects unknown authority/data fields,
3. rejects unsafe support URLs/oversized values,
4. bounds quick prompts,
5. safe public projection only.

### Successful candidate runtime

Run `34693533240`, job `103552956038`:

- health 200,
- `/admin/ai-arman` 200,
- served JS API marker present,
- unauth admin GET 401,
- auth admin GET 200,
- public GET 200,
- safe public projection,
- `/api/cases` valid and `2.263228s`,
- order `2495068 = Skickad` verified provenance,
- IAM unchanged,
- positive traffic unchanged,
- no GCS config PUT/write during proof.

### Latest promotion check

Run `34695891753`, job `103559192279`:

- exact source checkout: PASS,
- source build/tests: PASS,
- GCP auth: PASS,
- fail-closed production preflight: FAIL,
- first divergence: `old-live-revision`,
- traffic promotion: SKIPPED.

### Known test gaps

- current Returns actual positive revision/image/provenance after drift.
- current AI actual positive revision/image fresh on Sep-12.
- real production Customer Admin PUT/readback.
- actual live AI widget consumption of Returns projection.
- locked-field merge tests for future AI consumer not yet implemented.
- live end-to-end admin copy -> widget proof.
- exact direct-Vendre tracking sample remains observationally unproven.
- first naturally produced persistent learning lesson has not been separately live-observed as a final acceptance proof.

---

## 16. EXTERNAL SYSTEM STATUS

### GCP / Cloud Run

VERIFIED:

- project `harmoniq-210513`.
- region `europe-north1`.
- services `harmoniq-returns-api` and `harmoniq-ai-arman-beta0` exist in established architecture.
- GitHub Actions WIF/deployer identities are established.

Returns promotion deployer used:

`github-pickup-deployer@harmoniq-210513.iam.gserviceaccount.com`

AI historical deployer used:

`github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`

AI runtime identity historically:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

Current exact runtime config after Returns drift: NOT PROVEN.

### GCS

Returns Customer Admin uses existing Returns runtime identity and existing bucket path; no new IAM/SA/bucket.

AI learning has existing private GCS storage.

Legacy AI customer-presentation GCS store still exists in source and is currently read by widget controller; exact production object contents/need for migration: NOT PROVEN.

### Vendre

Read/status contract verified in real regression:

order `2495068` -> `Skickad` with verified provenance at prior gates.

Vendre writes remain Returns-owned typed business actions only.

Current Customer Admin presentation gate performs no Vendre write.

### nShift

Used where canonical tracking fallback/return-label flows require it.

Writes must remain Returns-owned typed/approved actions.

No nShift write belongs in presentation migration/probes.

### Gmail

Customer send is a controlled Returns/admin boundary; historical support mail is style precedent only.

No Gmail ingestion/send changes belong in current presentation gate.

### OpenAI/model

Model may interpret/formulate, but verified backend facts and policy own truth/authority.

Historical runtime evidence had model promotion disabled in relevant admin-reply flows.

No model config change belongs in current drift reconciliation or Customer Admin promotion.

### Google Ads / Cloudflare

NOT IN CURRENT PROJECT SCOPE for this continuation state.

---

## 17. WRITE SAFETY

### Admin resolver writes

Canonical boundary:

`prepare read-only -> deterministic verified analysis -> named typed action -> explicit admin approval -> Returns gateway -> Returns domain validation -> external write -> result/readback`

Safety:

- model cannot invent arbitrary internal calls,
- missing/malformed facts fail closed,
- customer widget cannot inherit admin authority,
- high-impact actions not implicitly allowed.

Global idempotency/max-write caps are action-specific and are **NOT UNIFORMLY PROVEN** across every possible typed action; do not claim a global cap. Verify per action before expanding scope.

### Customer presentation write

Canonical boundary:

`Returns /admin/ai-arman UI -> existing admin auth -> PUT /api/admin/ai-arman/customer-presentation -> allowlist/bounds -> GCS`

Safety:

- strict allowed fields,
- unknown authority/data fields fail closed,
- support URL constrained to same-site relative path,
- no order/customer/tracking/write-action fields,
- public endpoint read-only,
- promotion/candidate probes must not call PUT.

Actual production PUT/readback/idempotency/conflict behavior is not yet live-proven end-to-end; verify in a separately approved controlled write gate after both sides are live.

### Promotion writes

No Cloud Run traffic write unless exact preflight passes.

Latest failed promotion proves this fail-closed property: `old-live-revision` mismatch stopped before promotion.

Rollback must target the freshly captured immediate prepromotion live revision, never blindly a stale historical revision.

---

## 18. CHANGES IN CURRENT CANDIDATE

Canonical Returns Customer Admin candidate application source:

`bb693d1b07ff1c522b4aba82fc5c4a118c586a83`

Relevant delta:

### Backend new

- `server/src/services/aiArmanCustomerPresentationStore.js` — bounded durable presentation storage.
- `server/src/routes/aiArmanCustomerPresentationRoutes.js` — admin GET/PUT + public read-only projection.
- `server/test/aiArmanCustomerPresentationStore.test.js` — contract/safety tests.

### Backend updated

- `server/src/index-gcs-admin.js` — route wiring and explicit `/admin/ai-arman` SPA path.

### Frontend new

- `src/services/aiArmanCustomerPresentationService.js` — existing-admin-token client.
- `src/features/admin/AiArmanCustomerAdmin.jsx` — bounded presentation UI.

### Frontend updated

- `src/App.jsx` — `/admin/ai-arman` route.

Contract version:

`ai-arman-customer-ui-v1`

Allowed copy fields:

- `assistantSubtitle` max 120
- `launcherLabel` max 80
- `welcomeTitle` max 180
- `welcomeText` max 500
- `categoryTitle` max 120
- `categoryText` max 300
- `identityTitle` max 180
- `identityText` max 500
- `verifiedWelcome` max 300
- `composerPlaceholder` max 120
- `privacyText` max 500
- `humanSupportLabel` max 80
- `humanSupportUrl` max 240
- `quickPrompts`: max 8, each max 160.

`humanSupportUrl` must start `/`, cannot start `//`, cannot contain backslash.

Locked/not writable:

- assistant name,
- avatar,
- status labels,
- action IDs/definitions,
- category definitions,
- order/customer/tracking data,
- resolver/action authority,
- arbitrary external URL.

---

## 19. BEVISAT

- AI backend repo/branch/PR #18 state.
- AI application/source baseline `45be62ba...` and green foundation CI.
- Returns repo/branch current workflow head `6da4beb...`.
- Returns Customer Admin application SHA `bb693d1b...`.
- Customer Admin ownership belongs in existing Returns admin.
- local moduleSettings file is not canonical durable presentation storage.
- bounded Returns GCS architecture is implemented.
- protected admin routes + public projection are implemented.
- source test 5/5 passes.
- exact production frontend build passed.
- first candidate failed safely at 0% due missing SPA route.
- SPA route fix works in second candidate.
- second candidate `acadm-bb693d1b-74` passed runtime proof at 0%.
- candidate image `sha256:fdeb71c...` matched candidate proof.
- `/api/cases` candidate time 2.263228 s.
- Vendre order `2495068 = Skickad` verified at candidate proof.
- no config PUT/GCS write occurred during candidate proof.
- latest production promotion did not happen.
- latest promotion stopped specifically at `PROMOTION_PREFLIGHT_FAIL=old-live-revision` before traffic mutation.
- therefore stale expected Returns live baseline must not be reused blindly.
- current AI widget source still reads old `AiArmanCustomerWidgetPresentationStore.readForWidget()` and has NOT been connected to Returns public projection.

---

## 20. INTE BEVISAT

- exact current Returns positive live revision after drift.
- exact current Returns live image after drift.
- provenance/source SHA of current Returns live revision after drift.
- whether current Returns traffic is exactly one 100% revision or a split.
- whether AOC/ReturnPortal tags are still unchanged after whatever moved production.
- whether Customer Admin tag still points exact `acadm-bb693d1b-74` now; last candidate proof says yes but fresh check remains required.
- Customer Admin as live production feature.
- actual production admin PUT/readback.
- actual production presentation object existence/content.
- AI backend consuming Returns public projection.
- end-to-end admin edit changing actual live customer widget.
- exact fresh AI service live revision/image on Sep-12.
- whether legacy AI presentation GCS currently contains meaningful config requiring migration.
- direct exact-Vendre tracking sample.
- globally uniform idempotency/max write cap across every typed admin action.
- naturally produced persistent learning lesson as a separately observed final live acceptance item.

---

## 21. OPEN BLOCKERS

### P0 — Returns production provenance drift

Expected:

single 100% positive revision `harmoniq-returns-api-apoll-b25bf74a-72`.

Actual:

preflight comparison failed; actual revision was not emitted before fail. Exact current revision = NOT PROVEN.

First known divergence:

`PROMOTION_PREFLIGHT_FAIL=old-live-revision`

Likely layer:

Cloud Run production traffic/provenance changed due another legitimate later gate/deploy or an un-reconciled route change.

Blocks:

- Returns Customer Admin LIVE PASS,
- downstream AI presentation-consumer gate,
- end-to-end presentation DONE.

### P1 — AI presentation dual ownership remains

Expected final:

Returns public projection is canonical admin-owned source; AI compiled defaults are fallback.

Actual now:

widget controller still reads AI backend legacy GCS store.

Likely layer:

AI widget presentation read path.

Blocks:

end-to-end Customer Admin effect on real widget.

This is intentionally NOT fixed before P0/Returns live.

### P2 — legacy presentation migration unknown

Expected final:

one owner, no required config lost.

Actual:

legacy AI presentation object contents/importance are NOT PROVEN.

Blocks:

safe final retirement of old AI presentation store/admin endpoint.

### P3 — fresh AI production provenance not captured

Expected before AI consumer deploy:

exact current AI live revision/image/config.

Actual:

only Sep-10 general positive revision is last proven.

Blocks:

future AI consumer candidate/live promotion, not immediate Returns reconciliation.

---

## 22. TEMPORARY / LEGACY INVENTORY

### CANONICAL

- `arman573/harmoniq-backend` / `feature/ai-arman-foundation-v1` / PR #18.
- `arman573/harmoniq-returns-module` / `refactor-admin-return-flow-cleanup`.
- AI compiled widget defaults/presentation contract.
- Returns Customer Admin bounded contract + GCS store + public projection.
- existing Returns candidate workflow `.github/workflows/deploy-unified-order-admin-candidate-20260815.yml`.
- existing Returns promotion workflow `.github/workflows/promote-admin-media-ui-live-20260815.yml` as deploy mechanism.
- Returns-owned typed business write boundary.

### TEMPORARY ACTIVE

- Customer Admin candidate tag `ai-customer-admin-test` / `acadm-bb693d1b-74` pending fresh recheck.
- promotion workflow currently hardcoded to stale old-live baseline `apoll-b25bf74a-72`; must be retargeted only after read-only reconciliation.
- AI backend legacy customer presentation GCS store/admin controller retained until migration/rollback is proven.
- PR #18 remains draft while project is incomplete.

### OBSOLETE

- first failed Customer Admin candidate `harmoniq-returns-api-acadm-76ebe3f4-73` as release target.
- assumption that `apoll-b25bf74a-72` is current Returns live truth. It is historical baseline only now.
- local `data/moduleSettings.json` as canonical Customer Admin presentation storage.
- claim that current Returns admin copy already changes live AI widget.
- any idea that AI backend should receive Returns admin token to read presentation.

### UNKNOWN / REQUIRE INVENTORY BEFORE DELETE

- legacy AI presentation GCS object/data.
- old AI customer-presentation admin endpoint runtime usage.
- historical candidate tags/revisions that may be safe to remove later.
- some one-shot diagnostic workflow artifacts; retain until final cleanup unless clearly obsolete and noncanonical.

---

## 23. DO NOT DO

Nästa chat får INTE:

- anta att gamla handoffens production revision fortfarande är live.
- köra Customer Admin promotion innan fresh Returns Gate 0 är PASS.
- gissa aktuell live revision/image.
- skapa ny branch för att komma runt drift.
- skapa ny deployworkflow/alternate deploy path för att komma runt befintlig preflight.
- flytta traffic till stale candidate utan exact parity/provenance.
- rollbacka blint till `apoll-b25bf74a-72` om en ny legitim liveversion redan ersatt den.
- börja AI-backend presentation integration innan Returns-side live gate är stängd.
- skicka Returns admin token till customer-widget consumer.
- göra presentationen till full arbitrary widget config.
- låta admin ändra assistant name/avatar/actions/categories/status/business authority i v1.
- återinföra lokal Cloud Run-fil som durable presentation source.
- återuppliva gamla AI GCS presentation path som canonical owner.
- radera legacy store innan migration/rollback-behov är kartlagt.
- använda kundens text eller historiska mail som verifierad affärsfakta.
- låta model skapa fri internal write URL/payload.
- skicka kundmeddelande, göra Vendre/nShift write eller presentation PUT i read-only Gate 0/probe.
- bredda IAM/SA bara för att skapa ett testbevis.
- göra unrelated dependency/bundle cleanup mitt i denna Level 3 gate.

---

## 24. CURRENT CHANGE BUDGET

### För EXACT NEXT ACTION

**READ-ONLY.**

Tillåtna operationer:

- läsa GitHub repo/branch/PR/workflows/logs,
- läsa Cloud Run service/revision/IAM/traffic metadata via befintlig read access,
- jämföra immutable image/runtime metadata,
- läsa tag mapping,
- fastställa provenance via befintliga workflow/deploy-bevis.

Inte tillåtet i nästa action:

- source code change,
- workflow retarget/write,
- Cloud Run traffic write,
- env/IAM change,
- presentation PUT,
- customer send,
- Vendre/nShift/Gmail write.

När read-only reconciliation är PASS får nästa separata change budget begränsas till att retargeta den **befintliga** promotion workflowens expected current-live baseline om det verkligen behövs.

---

## 25. EXACT NEXT ACTION

### EN konkret nästa åtgärd

**Fresh read-only Returns production reconciliation för att identifiera vad som ersatt `harmoniq-returns-api-apoll-b25bf74a-72`.**

Ordning:

1. verifiera repo/default branch/active branch/current branch head igen.
2. läs `harmoniq-returns-api` service state i `harmoniq-210513/europe-north1`.
3. lista all traffic och fastställ exakt positive traffic revision(s)/percent/tag.
4. om single 100%: läs den revisionens immutable image, service account, timeout, concurrency, env/resource hash.
5. snapshot/read-only verifiera IAM.
6. verifiera `aoc-v10-3-20-menu` och `order-issue-media-test` tag mappings.
7. hitta canonical GitHub deployment/provenance för den faktiska positive revisionen; identifiera application/source SHA eller markera NOT PROVEN.
8. fresh-verifiera `ai-customer-admin-test` tag -> `harmoniq-returns-api-acadm-bb693d1b-74`, image `sha256:fdeb71c...`, 0% traffic.
9. jämför candidate runtime med den **verkliga aktuella live** basen.
10. skriv ingen kod/traffic/config under denna action.

### PASS-kriterium

PASS endast om:

- faktisk current live revision/traffic är entydigt bevisad,
- immutable live image är bevisad,
- live provenance är känd eller tillräckligt verifierad för safe promotion baseline,
- IAM/no-touch tags är kända,
- candidate är fortfarande exakt och 0%,
- ingen konflikt med en annan pågående gate finns.

### Om verkligheten avviker

Verkligheten vinner. Stoppa fail-closed. Uppdatera project state med faktisk revision/image/provenance. Om current live kommer från en senare legitim gate, gör den till ny baseline och bevara dess delta. Om provenance inte kan bevisas, fortsätt read-only genom befintliga GitHub Actions/deploybevis; skriv inte traffic/workflow för att forcera framåt.

---

## 26. WHAT COMES AFTER NEXT ACTION

Om read-only production reconciliation PASSAR:

1. retargeta endast befintlig Returns promotion workflow till exakt färsk live baseline om dess expected-old-live är stale,
2. rerun source/tests + runtime/IAM/tag/candidate preflight,
3. promotion till 100% endast om allt är grönt,
4. postpromotion verify + rollback guard,
5. markera Returns Customer Admin `PRODUCTION LIVE PASS`.

Först därefter öppnas separat AI-backend gate för public-projection consumption.

---

## 27. ROLLBACK / RECOVERY

### Current immediate recovery posture

Eftersom senaste Customer Admin promotion aldrig skrev traffic finns inget att rollbacka från den körningen. Bevara current live state tills den är identifierad.

### Historisk säker Returns baseline

`harmoniq-returns-api-apoll-b25bf74a-72`

image `sha256:1d98a2fd...`

är historiskt bevisad men får **inte** användas som blind rollback target efter drift. Fresh prepromotion live revision ska bli faktisk rollback target.

### Customer Admin candidate

0%-candidate kan lämnas orörd som testartifact medan reconciliation sker.

### Future AI consumer rollback

- compiled widget defaults ska vara funktionell fallback.
- consumer ska fail open till defaults vid projection failure.
- Cloud Run promotion ska ha exact previous-live rollback target.
- legacy AI presentation store bör inte raderas innan den nya livekedjan är bevisad och eventuell config migration är avgjord.

### Särskilda risker

- stale baseline kan rulla tillbaka legitim ny functionality från annan gate.
- dual presentation owner kan ge oväntad copy om båda läses samtidigt; final design ska ha en canonical read owner + defaults.
- config write-test i produktion måste vara kontrollerad och reversibel.

---

## 28. CLEANUP REMAINING

Innan DONE:

- reconcile och dokumentera faktisk Returns production lineage.
- uppdatera promotion workflow från stale expected live när verkligheten är bevisad.
- få Customer Admin live.
- implementera AI public-projection consumer.
- verifiera/hantera legacy AI presentation GCS data.
- pensionera gammal AI presentation admin/write path som owner.
- konsolidera naming/docs så Returns owner + AI fallback är tydligt.
- ta ställning till gamla 0%-candidate tags/revisions efter att rollbackbehov är borta.
- klassificera one-shot diagnostics/workflows och ta bort endast tydligt obsolete sådant.
- separat dependency-security remediation för befintliga npm audit findings; inte smygfixa inom current Level 3 gate.
- final canonical handoff efter DONE.

Known unrelated current audit findings från Customer Admin build:

- root: 8 vulnerabilities (1 low, 1 moderate, 6 high),
- server: 2 vulnerabilities (1 low, 1 moderate).

Dessa är inte current promotion blocker och ska hanteras separat med egen regression/riskbedömning.

---

## 29. DEFINITION OF DONE FOR THIS PROJECT

Projektet kan kallas DONE först när:

1. AI Arman customer widget, verified customer/order/returns/tracking facts och admin companion fungerar enligt authority-modellen.
2. Returns är ensam canonical owner för Customer Admin presentation writes/persistence.
3. Customer Admin är verifierat live på exakt immutable production revision/image.
4. AI backend är verifierat live med public read-only Returns presentation consumer.
5. endast allowlisted copy kan påverkas av admin projection.
6. assistant identity/avatar/actions/categories/status/business authority förblir låsta till compiled/backend-owned contracts.
7. projection outage/invalid data ger compiled defaults utan att widgeten faller.
8. inga Returns admin credentials behövs i customer presentation read path.
9. real approved admin config write/readback/public projection/live widget är bevisad end-to-end.
10. no-touch regressioner för Returns/Vendre/tracking/return interpretation/case latency/admin auth/IAM/tags är gröna.
11. admin writes/customer send sker fortsatt endast med typed action + explicit approval + Returns-side validation.
12. rollback till immediate previous production är verifierbar.
13. old dual presentation ownership är pensionerad eller uttryckligt isolerad med dokumenterad anledning.
14. current production source/artifact/runtime/traffic är dokumenterad och NOT PROVEN-fält för kritiska delar är stängda.
15. PR/repo state och final canonical handoff är uppdaterade så nästa maintainer inte behöver historikdump för att förstå systemet.

---

## 30. COMMAND SEMANTICS

När användaren skriver **`kör`**:

- fortsätt nästa logiska steg inom låst mål, current gate och current change budget,
- ta ett större sammanhängande arbetsblock när det är säkert,
- fråga inte om redan beslutade saker.

När användaren skriver **`kör nästa`**:

- verifiera föregående steg,
- fastställ fresh current gate,
- genomför och verifiera nästa säkra steg,
- om reality avviker från handoff: reality wins och handoff/project state korrigeras först.

För explicit live/write approval:

- godkännandet gäller endast den exakta gate/action som användaren just godkänt,
- återanvänd inte ett gammalt approval för senare unrelated promotion/write.

---

# CANONICAL STATE SNAPSHOT / QUICK CONTINUATION

**Current blocker:** Returns Customer Admin promotion är blockerad av production drift. Latest run `34695891753` stoppade med `PROMOTION_PREFLIGHT_FAIL=old-live-revision` innan traffic write.

**Do not do next:** börja inte AI consumer implementation och försök inte promotion med stale `apoll-b25bf74a-72` som antagen current live.

**Exact next action:** READ-ONLY reconcile actual `harmoniq-returns-api` positive revision/image/traffic/runtime/IAM/tags/provenance och fresh-verifiera Customer Admin 0%-candidate.

**If PASS:** retarget existing promotion workflow till den verkliga livebasen, full preflight, promote exact candidate, postverify/rollback guard.

**After Returns LIVE PASS:** separat AI backend gate: public projection -> schema validate -> allowed copy merge over compiled defaults -> fail-open defaults -> candidate -> live gate -> end-to-end config proof -> legacy cleanup.

**AI application/source baseline before this docs-only handoff:** `45be62ba9aaf062691ddf91e8e7439fbd204a71a`.

**Returns Customer Admin application/candidate source SHA:** `bb693d1b07ff1c522b4aba82fc5c4a118c586a83`.

**Returns Customer Admin candidate revision/image:** `harmoniq-returns-api-acadm-bb693d1b-74` / `sha256:fdeb71c71bd04396dfe977f9ea743797569dcf46b877da4417dc45a113bca247`.

**Current Returns positive live revision/image:** NOT PROVEN — must be first thing reconciled next chat.

**Customer Admin live:** NO.

**AI backend consumes Returns public presentation:** NO.

---

# HANDOFF QUALITY GATE

- Whole project purpose understandable from this file: PASS.
- Exact final product goal stated: PASS.
- Current state/candidate/live separated: PASS.
- Canonical architecture and owners stated: PASS.
- Current gate and first divergence stated: PASS.
- Proven vs not proven separated: PASS.
- Roadmap NOW -> DONE stated: PASS.
- Obsolete/legacy paths classified: PASS.
- Do-not-reintroduce rules explicit: PASS.
- Exact next action singular and testable: PASS.
- What follows after next action stated: PASS.
- New chat can continue without old chats/handoffs: PASS.
