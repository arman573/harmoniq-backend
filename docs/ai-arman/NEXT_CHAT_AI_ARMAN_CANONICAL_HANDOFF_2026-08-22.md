# NEXT CHAT HANDOFF — AI ARMAN CUSTOMER FRONTEND -> CUSTOMER ADMIN

**Updated:** 2026-08-23 21:49 Europe/Stockholm

**Arbetssätt:** HARMONIQ STANDARDARBETSSÄTT + HARMONIQ ADVANCED MODULE BUILD CONTRACT v2

Detta är en state-transfer handoff, inte en vanlig sammanfattning. Nästa chat ska börja från verifierad state nedan, göra GATE 0 read-only och fortsätta från EXACT NEXT ACTION. Återupptäck inte redan bevisade saker utan konkret anledning och återuppliva inte gamla sidospår.

---

# 1. PROJEKTETS EXAKTA SLUTMÅL

AI Arman ska vara Harmoniqs svenska AI-assistent före och efter köp, med en kundwidget på `harmoniq.se` och ett kontrollerat adminlager bakom den.

Slutmålet är:

1. Kunden kan öppna en Harmoniq-native AI Arman-widget på `harmoniq.se`.
2. AI Arman kan hjälpa över hela Harmoniqs sortiment: **Hår, Hud, Doft, Makeup, Naglar och Man**.
3. AI Arman kan svara på produktfrågor och ge rekommendationer med verifierade produktfakta.
4. Identitetskänsliga frågor om order, leverans, retur/reklamation och köphistorik kräver verifierad kundsession.
5. Kunden får aldrig interna adminnoteringar, interna lärmotiveringar, privata systemdetaljer eller obehörig data.
6. Admin ska kunna styra den kundnära presentationen genom en **kund-adminmodul** utan att presentation/configuration kan ge ny kunddata- eller write-authority.
7. Admin resolver fortsätter arbeta enligt `prepare -> explicit approval -> named execute`, där Returns äger verkliga writes.
8. Godkända adminsvar kan bli privata handling/style-exempel, men gamla lär-exempel får aldrig bli source of truth för aktuella fakta.
9. En enda canonical source/deploy/execution path ska användas; inga parallella widgetar, kundadmins, resolver-varianter eller deployspår.

Grundprincipen är fortfarande:

`AI tolkar -> backend bestämmer -> verifierade system levererar fakta -> AI formulerar`

AI får aldrig hitta på pris, lager, INCI, produktfakta, orderstatus, tracking eller returinformation.

---

# 2. RISKNIVÅ

**LEVEL 3 — KRITISK / AVANCERAD.**

Skäl:

- kundidentitet och kunddata,
- order/tracking/returdata,
- Gmail OTP,
- Vendre customer/order access,
- AI-actions,
- Returns write-capable admin,
- learning-store med intern rationale,
- framtida kund-admin som kan påverka live presentation/configuration.

Själva visual/presentation-konfigurationen är låg-risk, men modulen ligger bredvid Level-3 authority. Därför måste presentation och authority fortsätta vara separerade.

---

# 3. CURRENT GATE

**CURRENT GATE: CUSTOMER FRONTEND SOURCE LOCKED + TESTED; CUSTOMER-ADMIN OWNERSHIP/HOST NOT YET LOCKED.**

Customer Widget Frontend v1 är nu:

- **IMPLEMENTED** på canonical source branch,
- **TESTED** via canonical foundation CI,
- **NOT DEPLOYED** som den nya harmoniserade widgetversionen,
- **NOT LIVE VERIFIED** på `harmoniq.se`.

Nästa modul är kund-adminmodulen, men dess canonical host/auth/route får inte gissas. Därför är nästa gate en read-only ownership lock innan någon admin-kod skapas.

---

# 4. REPO / DEFAULT BRANCH / AKTIV BRANCH / PR

## Primary repo

`arman573/harmoniq-backend`

## Default branch

`main`

Verifierat via GitHub repo metadata 2026-08-23.

**Viktigt:** `main` är inte samma sak som current canonical AI Arman working/deploy source.

## Aktiv canonical source + deploy branch

`feature/ai-arman-foundation-v1`

## Relevant PR

PR #18 — `AI Arman foundation v1`

Verifierat state före denna handoff-docscommit:

- state: **open**
- draft: **true**
- merged: **false**
- mergeable: **true**
- base: `main`
- head: `feature/ai-arman-foundation-v1`
- application head före handoff: `a90d29b8f8d240e74c3cab27b645011b9ccaf1de`

**Merge policy:** PR #18 ska fortsätta vara draft. Mergea inte till `main` bara för att enskilda capabilities är testade/deployade.

## Resolver source consolidation

Tidigare resolver-source PR #21 är **merged/closed**.

Squash/merge commit in i foundation:

`2d45f5c15fa507e528a6f2a0b17ac5f95c1809bc`

PR #21 ska inte återupplivas som parallell source-of-truth.

---

# 5. APPLICATION / CANDIDATE / HANDOFF SHA — BLANDA INTE IHOP DEM

## Current application/source SHA

Det senaste funktionella application-SHA:t för customer frontend är:

`a90d29b8f8d240e74c3cab27b645011b9ccaf1de`

Commit message:

`Harmonize AI Arman customer widget with Harmoniq`

Detta SHA innehåller den fastställda/harmoniserade kundwidgeten och är **IMPLEMENTED + TESTED**, men inte bevisat deployat/live.

## Previous customer frontend source

`16c27c2653ce8ed8b6b7fc9e9d55c5dacdae5481`

Det var första Customer Frontend v1 innan den slutliga Harmoniq-harmoniseringen.

## Handoff commit SHA

Committen som innehåller denna handoff är en **docs-only handoff commit** och rapporteras separat av chatten efter skrivning/läsback.

**Handoff commit SHA är inte application SHA.**

När branch-head efter denna handoff pekar på docs-commiten ska app-state fortfarande anges som `a90d29...`.

---

# 6. BEVISAD DEPLOYED / LIVE AI RESOLVER — FROZEN RUNTIME

Den senaste bevisade AI resolver-runtimen är INTE `a90d29...`.

Canonical deployment checkpoint:

`docs/ai-arman/AI_ARMAN_FOUNDATION_TRUSTED_LIVE_V4_20260822.md`

Canonical run:

`32580717752`

Verified source SHA:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Image digest:

`sha256:db42496f6f2448c165f98940e86141c1f62b0d06648bdff6c5c89cc7bd2c8101`

Cloud Run service:

`harmoniq-ai-arman-beta0`

Region:

`europe-north1`

Runtime service account:

`ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`

Stable resolver tag:

`resolver-ready-3298af83`

Current proven stable resolver revision:

`harmoniq-ai-arman-beta0-resv4-07aacf15-15`

Previous proven stable revision:

`harmoniq-ai-arman-beta0-resv4-07aacf15-9`

Stable resolver URL:

`https://resolver-ready-3298af83---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

Stable resolver är avsiktligt en **0%-normal-traffic tagged revision**. Positive production traffic var oförändrad i verifieringen.

V4 evidence:

- HQR-2494077 read-only prepare PASS,
- execute utan approval blocked,
- real write executed = false,
- customer message sent = false,
- learning bucket configured = true.

Senast lästa checkpoint-tider:

- candidate first prepare `10.803305s`
- candidate warm prepare `5.982790s`
- stable tagged prepare `6.327266s`

---

# 7. CANONICAL AI DEPLOYVÄG

Canonical AI resolver deploy workflow:

`.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Canonical chain:

`feature/ai-arman-foundation-v1`
-> exact locked SOURCE_SHA
-> canonical tests/build
-> WIF auth
-> immutable Artifact Registry image
-> private Cloud Run 0%-candidate
-> real read-only prepare / denied-write checks
-> stable resolver retag only after PASS
-> positive production traffic preserved

Workflow gate:

`if: github.event.head_commit.message == 'Deploy AI Arman foundation trusted live v4'`

**Critical current fact:** workflowens `SOURCE_SHA` är fortfarande:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Det betyder att dagens customer frontend application SHA `a90d29...` **inte** har deployats genom v4. Ändra inte `SOURCE_SHA` eller kör deploy bara för att göra branch-head och runtime lika; sådan promotion kräver egen gate/provenance.

Skapa inte v5/v6 eller ett parallellt deployworkflow för att komma runt detta.

---

# 8. CUSTOMER FRONTEND — IMPLEMENTERAD CANONICAL EXECUTION PATH

Canonical customer path i source:

`harmoniq.se`
-> `GET /ai-arman/customer/widget.js`
-> `AiArmanCustomerWidgetService`
-> identity start/verify
-> verified session token
-> `POST /ai-arman/customer/chat/messages`
-> `ChatRequestParser`
-> verified customer chat/orchestrator/backend facts
-> `AiArmanCustomerResponseService`
-> customer-safe blocks
-> widget render via `textContent`

Widgeten är INTE admin-authority och får inte ärva admin-resolverns write-behörigheter.

## Component/file ownership

### Customer gateway bootstrap

`src/main-ai-arman-customer-gateway.ts`

Äger:

- Nest bootstrap,
- global request boundary,
- security headers,
- `evaluateCustomerGatewayBoundary()`,
- validation pipe.

### Customer gateway module

`src/ai-arman-customer-gateway.module.ts`

Äger wiring för:

- customer controllers,
- identity/session,
- response/widget services,
- Gmail OTP sender,
- Vendre customer directory verification provider.

### Customer public route boundary

`src/ai-arman/widget/customer/ai-arman-customer-gateway-boundary.ts`

Exponerar bara:

- `GET /health`
- `GET /ai-arman/customer/widget.js`
- `POST /ai-arman/customer/identity/start`
- `POST /ai-arman/customer/identity/verify`
- `POST /ai-arman/customer/chat/messages`

För non-GET tillåts origins endast:

- `https://harmoniq.se`
- `https://www.harmoniq.se`

Övrigt fail-closed med 404/403/405.

### Customer controller

`src/ai-arman/widget/customer/ai-arman-customer.controller.ts`

Äger:

- feature-gated `widget.js`,
- identity start,
- identity verify,
- Bearer session verification,
- `web_widget` channel guard,
- chat dispatch till backend,
- response formulation.

### Widget presentation contract

`src/ai-arman/widget/customer/ai-arman-customer-widget.presentation.ts`

Contract:

`ai-arman-customer-ui-v1`

Äger bounded presentation values som nästa kund-adminmodul senare kan få styra, utan att få authority.

Current default content inkluderar:

- `AI Arman`
- `Din personliga skönhetsassistent`
- `Säker kundchatt` / `Verifierad kundchatt`
- `Fråga AI Arman`
- action cards: `Sortiment`, `Orderstatus`, `Returhjälp`, `Fråga Arman`
- customer support link `/i/kundservice.html`
- huvudkategorier Hår/Hud/Doft/Makeup/Naglar/Man.

Canonical category links:

- Hår -> `/c/har/`
- Hud -> `/c/hud/`
- Doft -> `/c/doft/`
- Makeup -> `/c/makeup/`
- Naglar -> `/c/naglar/`
- Man -> `/c/man/`

### Widget rendering/UI

`src/ai-arman/widget/customer/ai-arman-customer-widget.service.ts`

Äger:

- fixed avatar launcher bottom-right,
- desktop/mobile panel,
- Shadow DOM isolation,
- Harmoniq-native neutral visual tokens,
- status/header,
- action cards,
- assortment category navigation,
- email/OTP flow,
- quick prompts,
- verified chat state,
- typing/error/session-expiry UI,
- keyboard/accessibility,
- safe-area/reduced motion,
- assistant avatar next to replies,
- safe `textContent` rendering.

### Embedded avatar

`src/ai-arman/widget/customer/ai-arman-customer-widget.avatar.ts`

Äger optimerad WebP/data-URI-version av den av användaren godkända AI Arman-bilden.

Dela/skriv inte ut rå base64 i logs eller handoff.

### Feature/config boundary

`src/ai-arman/widget/customer/ai-arman-customer-widget.config.ts`

Viktiga env gates:

- `AI_ARMAN_CUSTOMER_WIDGET_ENABLED`
- `AI_ARMAN_CUSTOMER_IDENTITY_ENABLED`
- `AI_ARMAN_CUSTOMER_SESSION_SECRET`
- OTP/session TTL/attempt config.

### Session/identity

- `src/ai-arman/widget/customer/ai-arman-customer-session.service.ts`
- `src/ai-arman/widget/customer/ai-arman-customer-identity.service.ts`
- `src/ai-arman/widget/customer/ai-arman-customer-identity.store.ts`
- `src/ai-arman/widget/customer/ai-arman-customer-otp-rate-limiter.ts`
- `src/ai-arman/widget/customer/gmail-customer-email-otp.sender.ts`
- `src/ai-arman/widget/customer/vendre-customer-directory-verification.provider.ts`

Session material ligger i browser `sessionStorage`, inte `localStorage`.

### Customer response formulation

`src/ai-arman/widget/customer/ai-arman-customer-response.service.ts`

Äger customer-safe response blocks. Widgeten ska inte rendera model/customer HTML direkt.

### Customer gateway container

`Dockerfile.ai-arman-customer-gateway`

Detta bygger gateway-containern, men senaste customer UI SHA har endast byggts i CI; ingen pushed/live image för `a90d29...` är bevisad.

---

# 9. FASTSTÄLLD CUSTOMER FRONTEND DESIGN BASELINE

Den tidigare mockup-riktningen med generisk beige chatbot-känsla är INTE canonical brand truth.

Fastställd implementation i `a90d29...` använder:

- neutral svart/vit/grå Harmoniq-native bas,
- page font inheritance snarare än påhittat separat fontsystem,
- varm ton sparsamt,
- user-approved AI Arman portrait/avatar,
- full sortimentscoverage,
- inga påståenden om att gissade beige hexvärden är Harmoniqs officiella tokens.

Viktigt designbeslut från användaren:

**Återinför inte `Hud & hår` som den enda beauty-rådgivningskategorin.** Sortimentet måste omfatta Hår, Hud, Doft, Makeup, Naglar och Man.

Documentation:

`docs/ai-arman/CUSTOMER_WIDGET_FRONTEND_V1.md`

---

# 10. CANONICAL ADMIN RESOLVER EXECUTION PATH

Admin path som fortfarande gäller:

`admin intent`
-> deterministic policy/resolver
-> named typed action
-> `ReturnsAdminGatewayClient`
-> private Returns full-admin gateway
-> existing Returns admin route/domain logic
-> real system integration
-> read-back/verified result

Backend owner files inkluderar:

- `src/ai-arman/admin/admin-case-resolver.service.ts`
- `src/ai-arman/admin/admin-case-resolver.controller.ts`
- `src/ai-arman/admin/admin-command-planner.service.ts`
- `src/ai-arman/admin/admin-return-resolution-actions.service.ts`
- `src/ai-arman/integrations/returns-admin-gateway.client.ts`
- `src/ai-arman/integrations/returns-admin-gateway.config.ts`

Typed actions:

- `case.read`
- `case.order_context.read`
- `case.customer_message.send`
- `case.pause`
- `case.complete`
- `case.return_status.set`
- `case.product_decision.set`
- `case.return_label.create`

Stage 1 = **explicit admin approval required**.

Stage 2 autonomous customer sending är INTE aktiverat.

---

# 11. REVIEWED-REPLY LEARNING — CANONICAL BOUNDARY

UI-fält:

`Intern lärnotering till AI Arman`

Det är inte samma fält som produktbeslutets `Adminnotering`.

Canonical owner:

`src/ai-arman/admin/admin-learning.store.ts`

Viktiga invariants:

1. Intern rationale får aldrig skickas till kund.
2. Customer transport får bara godkänt kundsubject/message.
3. Approved reply kan sparas som handling/style-precedent efter lyckad explicit approved send.
4. Learning-save failure efter send får aldrig orsaka dubbel customer send.
5. Raw `internalRationale` strippas innan framtida customer-reply model context.
6. `approvedReplyExample` är style/handling precedent, inte faktakälla.
7. Fresh verified facts vinner alltid.
8. Learning kan ske även om extra intern note är tom.

Private learning storage:

- bucket: `gs://harmoniq-210513-ai-arman-learning`
- object: `ai-arman/support-learning-v1.json`
- region: `EUROPE-NORTH1`
- storage class: `STANDARD`
- uniform bucket-level access: true
- public access prevention: enforced
- public principal: false
- runtime role: `roles/storage.objectUser` på bucket scope
- runtime project roles: `[]`.

Permanent sanitized infra evidence:

`arman573/harmoniq-account-identity-bridge/docs/automation-status/ai-arman-learning-bucket-provision-20260822.json`

---

# 12. RETURNS MODULE — BEVISAD RESOLVER RUNTIME

Repo:

`arman573/harmoniq-returns-module`

Default branch:

`main`

Resolver source branch:

`feature/ai-arman-case-resolver-ui`

Canonical Returns resolver deployment workflow:

`.github/workflows/deploy-ai-arman-resolver-returns-write-ready-once.yml`

Checkpoint:

`docs/AI_ARMAN_RESOLVER_RETURNS_WRITE_READY_CANDIDATE.md`

Run:

`32581393936`

Verified source SHA:

`7c915d6f12711e60fd920ba3a5ecc09c5cc4bb2f`

Image digest:

`sha256:8612870f529854648efbda0fff02725f277bd147ba8504b17c26ca034dfa6469`

Stable resolver revision:

`harmoniq-returns-api-airesolver-7c915d6f-26`

Stable URL:

`https://resolver-ready-431fc50f---harmoniq-returns-api-cw6q5ekseq-lz.a.run.app`

Traffic:

**0% normal traffic**

Positive production Returns traffic:

**unchanged during verification**

Evidence:

- focused resolver tests/build/Docker PASS,
- real prepare PASS,
- approved=false blocked,
- unsupported approved action blocked,
- supported real write during verification = false,
- customer message during verification = false.

Returns owns real GCS/Vendre/Gmail/nShift/tracking writes.

---

# 13. RETURNS ADMIN — BEVISAD LIVE FRONTEND

För Returns/Vendre-admin finns separat bevisad live frontend state.

Canonical frontend production source branch:

`refactor-admin-return-flow-cleanup`

Bevisad application/live SHA:

`0bfaf85f2aa59555468d8602bf9cba5d96bfe7d7`

Parent med AI Arman private learning UI:

`31e84781d8381d20951e55ac246451df48c58bc3`

Cloudflare Pages project:

`harmoniq-returns-module`

Production deployment ID:

`b4004a2e-62a0-465d-a7a5-6462b4316198`

Production deployment URL:

`https://b4004a2e.harmoniq-returns-module.pages.dev`

Bevisad bundle:

`assets/index-BVxWUVss.js`

Markers:

- modern + AI learning = `5/5`
- learning marker = `yes`
- old 240-character cap marker = `no`.

Custom frontend domain:

`https://retur.harmoniq.se`

Admin route:

`https://retur.harmoniq.se/admin/cases`

Vendre host page:

`https://harmoniq.se/Admin/returer-reklamationer/`

User-facing browser verification från den workstreamen var att det fungerade.

Recovery pointer:

`lock/returns-admin-live-0bfaf85-20260822`

Den branch-pointern ska behandlas som immutable recovery baseline.

---

# 14. CUSTOMER FRONTEND — CANONICAL CHECK OCH SENASTE TESTRESULTAT

Canonical source-quality check:

Workflow:

`AI Arman foundation CI`

Application SHA:

`a90d29b8f8d240e74c3cab27b645011b9ccaf1de`

Run ID:

`32662161892`

Run number:

`1523`

Result:

**SUCCESS**

Job:

`Test and build`

Job ID:

`97249880583`

Verified steps:

- dependencies PASS
- unit tests PASS
- TypeScript build PASS
- isolated AI candidate container build PASS
- isolated candidate smoke PASS
- isolated customer gateway container build PASS
- customer gateway boundary smoke PASS.

Exact test totals from logs:

- **108 / 108 test suites PASS**
- **653 / 653 tests PASS**
- snapshots 0
- npm audit in CI: 0 vulnerabilities.

Widget-specific tests PASS, including:

`src/ai-arman/widget/customer/ai-arman-customer-widget.service.spec.ts`

Customer gateway boundary tests PASS.

CI-local image digests:

- candidate local CI image: `sha256:0b3de3021d52f4cac643d96a28a6da174991a4b8de30658163c75aed979225ef`
- customer-gateway local CI image: `sha256:52d2e361525daef8f7b9c667341061a0ec9275734eb85feeee198349cf656f3b`

**Dessa är CI-local Docker image digests, inte pushed/live Artifact Registry images.**

Customer gateway smoke verifierar bland annat:

- `productionActionsEnabled == false`
- widget disabled -> `widget.js` 404
- no Origin POST -> 403
- Harmoniq origin allowed through boundary
- identity disabled -> fail-closed `identity_unavailable`
- internal/non-customer routes are not exposed
- no localhost/Postgres startup attempt.

---

# 15. ACCEPTANSKRITERIER

## Customer frontend v1

För att source-baseline ska anses godkänd gäller:

- en och endast en canonical customer widget,
- user-approved AI Arman avatar används,
- Harmoniqs hela huvudsortiment representeras,
- category navigation pekar på riktiga Harmoniq category paths,
- desktop + mobile fungerar,
- Shadow DOM isolerar från storefront CSS,
- session/identity-gates bevaras,
- inga customer/model strings renderas med unsafe HTML,
- `sessionStorage`, inte `localStorage`, för customer session,
- widget har ingen admin authority,
- non-customer gateway routes exponeras inte,
- canonical CI är grön.

Dessa source-kriterier är uppfyllda på `a90d29...`.

## För live customer activation senare

Följande måste dessutom bevisas innan widgeten får kallas LIVE VERIFIED:

- exakt pushed customer-gateway artifact/image med provenance,
- exakt deployed Cloud Run revision/source,
- feature flags/config verifierade,
- widget script injection/serving på riktig `harmoniq.se`,
- launcher synlig i riktiga browsers/enheter,
- origin/CORS/boundary korrekt i live path,
- real OTP start/verify mot riktiga system utan att logga kod/kundhemligheter,
- verified customer session fungerar,
- real customer chat read-only/useful flow fungerar,
- no admin/private data leakage,
- rollback path bevisad.

Detta är ännu inte gjort för `a90d29...`.

## Customer-admin module

Innan implementation ska nästa chat bevisa:

- vilken befintlig admin-app som är canonical host,
- exakt auth boundary,
- exakt route/location,
- exakt presentation-config owner/storage,
- att config writes inte kan eskalera customer/admin authority,
- att ingen andra standalone admin byggs.

---

# 16. NO-TOUCH BEHAVIOR

Nästa chat får INTE som sidoeffekt:

1. aktivera customer widget live,
2. skicka OTP-mail till riktiga kunder,
3. skicka customer messages,
4. köra supported Returns writes,
5. ändra order/retur/status/tracking/Vendre/nShift,
6. slå på Stage 2 autonomous send,
7. mergea PR #18 till main,
8. ändra positive Cloud Run traffic,
9. flytta stable resolver tag,
10. ändra learning bucket/IAM,
11. läsa/logga raw internal learning rationale,
12. bredda customer gateway route exposure,
13. ge customer widget admin authority,
14. skapa ny admin-app innan canonical host är bevisad,
15. skapa v5/v6 eller parallellt deployworkflow,
16. återinföra gammal `Hud & hår`-only design,
17. behandla gissade beige mockup-färger som officiella Harmoniq design tokens,
18. återanvända gamla verification branches som working source.

---

# 17. IMPLEMENTED

## Customer frontend

**YES — application SHA `a90d29...`**

Implemented:

- Harmoniserad Customer Widget v1
- avatar launcher
- supplied AI Arman portrait embedded as optimized WebP
- header/status
- Sortimentskort
- Orderstatus
- Returhjälp
- Fråga Arman
- category navigation Hår/Hud/Doft/Makeup/Naglar/Man
- human support link
- responsive desktop/mobile
- Shadow DOM
- accessibility/keyboard
- quick prompts
- email OTP UI
- verified session UI
- assistant typing/error/session-expiry UI
- safe text rendering
- presentation contract for future customer-admin.

## Resolver / reviewed reply learning

**YES**

- prepare/execute boundary
- typed actions
- explicit approval
- private learning rationale boundary
- approved reply learning
- duplicate-send protection.

---

# 18. TESTED

## Customer frontend application SHA `a90d29...`

**YES**

Canonical CI `32662161892`:

- 108/108 suites PASS
- 653/653 tests PASS
- TypeScript PASS
- candidate Docker PASS
- customer gateway Docker PASS
- both smoke gates PASS.

## Deployed resolver source `07aacf...`

**YES** via canonical v4 run `32580717752`.

## Returns resolver `7c915d...`

**YES** via run `32581393936`.

---

# 19. DEPLOYED

## New harmonized customer widget `a90d29...`

**NO.**

Ingen pushed/live customer-gateway image eller Cloud Run revision för denna SHA är bevisad.

## AI resolver / learning source `07aacf...`

**YES** till tagged 0%-stable resolver revision `harmoniq-ai-arman-beta0-resv4-07aacf15-15`.

## Returns resolver `7c915d...`

**YES** till tagged 0%-resolver revision `harmoniq-returns-api-airesolver-7c915d6f-26`.

## Returns admin learning UI

**YES** i Cloudflare Pages production baseline `0bfaf85...`, med learning-parent `31e847...`.

---

# 20. LIVE VERIFIED

## New harmonized customer widget `a90d29...`

**NO.**

Inte bevisad på live `harmoniq.se`.

## AI resolver stable URL

**YES — read-only behavior live verified** på den bevisade stable tagged revisionen.

## Returns resolver stable URL

**YES — read-only prepare + denied/unsupported boundaries live verified**.

## Returns admin frontend / learning UI

**YES** enligt Cloudflare production artifact + Vendre admin browser verification.

## First natural persistent reviewed-reply learning write

**NOT YET LIVE OBSERVED.**

Skapa inte ett syntetiskt kundutskick bara för att ticka denna ruta. När en riktig admin naturligt granskar/skickar ett svar kan learning object generation/timestamp verifieras read-only utan att läsa/logga intern text.

---

# 21. BEVISAT

Följande är bevisat:

- repo/default branch metadata,
- foundation branch är canonical AI source/deploy branch,
- PR #18 är open/draft,
- PR #21 är merged/closed och source är konsoliderad,
- current customer frontend application SHA är `a90d29...`,
- canonical CI på a90d är grön,
- 108/108 suites och 653/653 tests,
- customer gateway fail-closed route/origin behavior i CI,
- customer widget är feature-gated,
- current v4 deploy workflow är pinned till `07aacf...`,
- stable AI resolver revision/digest ovan,
- stable Returns resolver revision/digest ovan,
- private learning bucket/IAM state,
- Returns admin frontend live baseline/artifact,
- reviewed-reply privacy/duplicate-send boundaries.

---

# 22. INTE BEVISAT

Följande får nästa chat INTE anta:

- att `a90d29...` är production,
- att current branch head == deployed Cloud Run source,
- att den nya widgeten redan finns på `harmoniq.se`,
- att a90d customer gateway har en pushed Artifact Registry digest,
- att en a90d customer-gateway Cloud Run revision finns,
- att live widget feature flag är enabled,
- att real OTP/email/Vendre identity flow fungerar i storefront production för denna build,
- att real customer storefront chat fungerar med nya UI:n,
- att exact canonical customer-admin host är Returns admin,
- att customer-admin config storage redan finns,
- att första naturliga persistent reviewed-reply lesson har skrivits,
- att gamla branches/workflows är säkra att återanvända,
- att `main` representerar AI Arman production source.

---

# 23. OPEN BLOCKERS

För att börja kund-adminmodulen finns **en arkitekturblocker**:

**Canonical host/authority/storage ownership för kund-adminmodulen är ännu inte verifierad.**

Det är inte acceptabelt att lösa detta genom att spontant skapa en ny standalone admin, nytt repo eller nytt deployspår.

För senare customer widget live activation finns dessutom en release/provenance-gap eftersom current customer UI source inte är deployad.

Den release-gapen blockerar dock inte read-only design/ownership lock för kund-adminmodulen.

---

# 24. EXPECTED VS ACTUAL FÖR NUVARANDE GAP

## Expected

Efter fastställd Customer Widget v1 ska nästa utvecklingssteg kunna bygga en kund-adminmodul som styr bounded presentation/configuration i samma canonical arkitektur, utan ny authority eller parallell frontend.

För att kalla customer widget live ska samma exact application source dessutom ha immutable artifact provenance, deployed revision och verklig storefront-verifiering.

## Actual

- `a90d29...` innehåller den godkända/harmoniserade widgetkoden.
- canonical CI är helt grön.
- widgeten är fortfarande source-only för denna version.
- v4 deployworkflow är pinned till äldre deployed resolver source `07aacf...`.
- ingen live customer-widget deployment/injection för `a90d29...` är bevisad.
- exakt host/auth/storage för kund-adminmodulen är ännu inte låst.

Detta är ett **known source/runtime + ownership gap**, inte ett skäl att bygga ett nytt deploy- eller adminspår.

---

# 25. FÖRSTA KÄNDA DIVERGENCE

Den viktigaste första relevanta divergencen inför nästa chat är:

**Canonical source branch har avancerat bortom den bevisade deployed runtime-källan.**

- bevisad deployed AI resolver source: `07aacf157281c205aa3898b7c073cfe2444e1936`
- resolver source consolidation: `2d45f5c15fa507e528a6f2a0b17ac5f95c1809bc`
- customer frontend initial source: `16c27c2653ce8ed8b6b7fc9e9d55c5dacdae5481`
- customer frontend harmonized application source: `a90d29b8f8d240e74c3cab27b645011b9ccaf1de`

V4 deploy workflow är fortfarande låst på `07aacf...`.

Detta ska behandlas som explicit provenance state, inte som fel som ska patchas med ny workflow.

Designmässigt fanns också en tidigare divergence: första mockup/implementation tenderade mot generisk beige chatbot + `Hud & hår`. Användaren korrigerade detta. Canonical design täcker nu hela Harmoniq-sortimentet och använder neutral Harmoniq-native styling.

---

# 26. EXTERNA SYSTEM / WRITE-STATUS

## Vendre

- används för verifierad customer/order context där integration finns,
- customer widget får inte konstruera egna Vendre writes,
- real write = **inte aktiverad genom customer widget**.

## Gmail

- används för customer OTP sender och Returns customer communication paths,
- customer frontend CI kör OTP email disabled,
- ingen real OTP skickades i senaste customer frontend verification.

## Returns Module

- äger real return/case/Gmail/nShift/tracking writes,
- AI resolver får endast named allowlisted action genom private gateway och explicit approval.

## nShift

- real label/write ägs av Returns,
- ingen real nShift write i senaste AI resolver/customer frontend verification.

## GCS learning store

- private bucket provisionerad och runtime-authorized,
- learning write kan ske efter riktig approved reviewed reply,
- första naturliga persistent lesson ännu inte live-observerad.

## OpenAI/model

- AI får tolka/formulera,
- backend owns facts/policy/writes,
- model promotion/autonomous customer send är inte en customer-admin shortcut.

## Cloudflare Pages

- bevisad för Returns admin frontend,
- inte bevisad som deploymekanism för den nya harmoniq.se customer widget.

## Google Cloud Run / Artifact Registry

- bevisad resolver deployment via v4,
- current a90d customer UI image endast local CI build, inte bevisad pushed/deployed.

---

# 27. TEMPORÄRA WORKFLOWS / DIAGNOSTICS / BRANCHES / CANDIDATES

## Backend branches som fortfarande finns

Canonical:

- `feature/ai-arman-foundation-v1`

Retired/temporary:

- `ops/ai-arman-resolver-candidate-20260820` — PR #21 merged; använd inte som source
- `trigger/ai-arman-tool-preflight-20260820`
- `verify/ai-arman-resolver-candidate-20260820`
- `verify/ai-arman-tool-preflight-20260820`
- accidental inert `noop` branch.

`noop` är verifierad som unprotected branch på:

`f0ac02b8baad10eec3d2ffdef32c350d27d4fb84`

Den har ingen unique runtime-roll. Återanvänd den inte.

## Open temporary verification PRs

PR #19:

`Verify AI Arman tool registry GCP access`

- temporary read-only preflight
- do not merge.

PR #20:

`Verify AI Arman resolver zero-traffic candidate`

- temporary read-only verification
- do not merge.

## Historical workflow debt on foundation

Det finns fortfarande många äldre `*-once.yml` / diagnostic / candidate workflows, inklusive äldre admin-reply och customer-gateway diagnostics.

Exempel:

- `ai-arman-admin-reply-provider-diagnostic-candidate-once.yml`
- `ai-arman-admin-reply-timeout-fixed-candidate-once.yml`
- `ai-arman-admin-reply-zero-traffic-candidate-once.yml`
- `ai-arman-admin-reply-zero-traffic-candidate-v2-once.yml`
- `ai-arman-beta0-candidate-deploy.yml`
- `ai-arman-beta0-gcp-preflight.yml`
- `ai-arman-customer-gateway-actions-diagnostic-once.yml`
- `ai-arman-customer-gateway-artifact-diagnostic-once.yml`
- `ai-arman-customer-gateway-private-candidate-diagnostic-once.yml`
- `ai-arman-customer-gateway-private-candidate-v2-once.yml`

Deras existens gör dem **inte canonical**.

Canonical AI resolver deployväg är v4-workflowen ovan.

Skapa inte ett nytt customer gateway deployworkflow innan deploy ownership är verifierad mot verklig state.

---

# 28. VAD NÄSTA CHAT INTE SKA ÅTERINFÖRA

Nästa chat ska uttryckligen undvika:

- separat customer widget repo,
- separat frontend stack,
- andra AI Arman-widgeten,
- standalone customer-admin utan ownership proof,
- v5/v6 deploy workflows,
- copy-pasted diagnostic workflows,
- generic execute endpoints,
- browser/model-authored internal URLs/payloads,
- admin authority i customer gateway,
- customer facts i presentation contract,
- raw internal learning rationale i model/customer context,
- old PR #21 source branch som canonical source,
- PR #19/#20 som deploy source,
- `noop` branch,
- `Hud & hår` som enda beauty scope,
- påhittade brand colors som officiella Harmoniq tokens,
- merge av PR #18 till main utan separat release/provenance gate,
- synthetic customer message bara för learning verification.

---

# 29. VIKTIGA ARKITEKTURBESLUT SOM FORTFARANDE GÄLLER

1. **En canonical source-of-truth:** foundation branch för AI Arman source.
2. **Production provenance > branch assumptions:** branch-head är inte automatiskt live.
3. **Customer authority separat från admin authority.**
4. **Presentation contract separat från data/permissions.**
5. **Verified backend facts always win.**
6. **Read-only first.**
7. **One protected write boundary.**
8. **Named typed actions, never arbitrary actions.**
9. **Explicit approval for Stage 1 writes.**
10. **Returns owns return/case/Gmail/nShift/tracking writes.**
11. **Learning can guide style/handling, never facts.**
12. **Raw internal rationale never reaches customer/model context.**
13. **Learning failure after send never retries send.**
14. **No branch/workflow/diagnostic sprawl to solve ownership uncertainty.**
15. **Customer widget uses same customer gateway, not direct private AI/admin endpoints.**
16. **Harmoniq customer design scope covers full assortment.**

---

# 30. CHANGE BUDGET FÖR NÄSTA STEG

**Change budget: ZERO functional writes / ZERO new files / ZERO new branches / ZERO new workflows / ZERO deploys.**

Allowed next-step work:

- read-only GitHub inspection,
- read-only comparison of existing admin hosts/routes/auth/config ownership,
- document one canonical host decision in working notes/chat only until evidence is complete.

Not allowed in this gate:

- customer-admin implementation,
- schema/storage creation,
- API write endpoints,
- frontend route creation,
- deploy changes,
- feature flag changes,
- production traffic changes.

---

# 31. EXACTLY ONE NEXT ACTION

## NEXT ACTION — GATE 0: CUSTOMER-ADMIN OWNERSHIP LOCK (READ-ONLY)

Read-only verifiera vilken **befintlig admin-app** som ska vara canonical host för AI Arman Customer Admin.

Undersök endast befintlig state i:

1. `arman573/harmoniq-returns-module`, framför allt bevisad live admin source `refactor-admin-return-flow-cleanup`, dess admin routing/auth och befintliga AI Arman adminytor.
2. `arman573/harmoniq-backend` foundation, framför allt customer presentation contract, customer gateway och eventuell befintlig config/admin route ownership.

Målet är att låsa exakt:

- canonical host application,
- exact route/location där customer-admin hör hemma,
- existing admin auth boundary,
- exact owner component/file,
- exact backend API/service owner för bounded presentation config,
- var persisted config ska ägas om persistence redan finns,
- vilka presentationfält som får vara writable,
- vilka authority/datafält som uttryckligen aldrig får bli writable via denna modul.

**Om ownership inte kan bevisas entydigt: STOP. Skapa inte en ny admin-app som workaround.**

---

# 32. HUR NEXT ACTION SKA VERIFIERAS

GATE 0 är PASS först när nästa chat kan visa evidence för alla följande utan kodändring:

1. repo + branch + PR/state fortfarande matchar handoff eller korrigeras mot verkligheten,
2. en och endast en befintlig admin host är vald med konkret route/component/auth evidence,
3. presentation contract owner är identifierad,
4. data/write boundary är dokumenterad,
5. no-touch behavior är bevarat,
6. ingen parallell admin/route/workflow har skapats,
7. nästa implementation kan beskrivas som en minimal end-to-end path:

`admin UI -> bounded validated presentation model -> protected admin config boundary -> canonical config store -> customer widget read projection`

utan att admin config kan nå customer/order/Returns writes.

Efter PASS får nästa gate definiera implementationens change budget.

---

# 33. ROLLBACK / RECOVERY

## Customer frontend source rollback

Current tested source:

`a90d29b8f8d240e74c3cab27b645011b9ccaf1de`

Previous frontend v1 source:

`16c27c2653ce8ed8b6b7fc9e9d55c5dacdae5481`

Eftersom `a90d29...` inte är bevisat deployat/live ska en source-regression före deployment lösas genom att revert:a den funktionella customer-widget-commiten eller återställa widgetfiler till previous known source och köra canonical CI igen.

Rör inte live resolver traffic för en source-only widget regression.

## AI resolver runtime rollback

Current proven stable resolver:

`harmoniq-ai-arman-beta0-resv4-07aacf15-15`

Previous proven stable:

`harmoniq-ai-arman-beta0-resv4-07aacf15-9`

Stable-tag/traffic changes ska endast ske genom canonical guarded process.

## Returns admin frontend recovery

Immutable recovery pointer:

`lock/returns-admin-live-0bfaf85-20260822`

SHA:

`0bfaf85f2aa59555468d8602bf9cba5d96bfe7d7`

Använd inte recovery branchen som working branch.

## Returns resolver

Stable resolver är 0%-taggad; bevara positive production traffic.

---

# 34. CLEANUP SOM ÅTERSTÅR INNAN HELA PROJEKTET ÄR DONE

Cleanup är inte blockerande för nästa read-only ownership gate, men ska göras innan slutlig project DONE:

- pensionera/stäng temporary PR #19 och #20 när deras evidence inte längre behövs,
- ta bort retired trigger/verify branches när säker delete-ref-capable path finns,
- ta bort accidental `noop` branch,
- fortsätt file-by-file klassificering av historical `*-once.yml` och diagnostic workflows och radera endast de som bevisats superseded,
- behåll en canonical deploy path,
- verifiera första naturliga reviewed-reply persistent lesson write efter riktig adminanvändning,
- innan customer widget release: skapa/prova exact immutable customer-gateway artifact/deploy provenance utan parallell workflow-sprawl,
- live verifiera customer widget på riktiga `harmoniq.se` browsers/enheter,
- efter customer-admin implementation: verifiera att presentation writes är bounded/audited och inte kan eskalera authority,
- uppdatera canonical handoff när nästa gate är stängd.

---

# 35. STATUS I EN RAD

**AI resolver + reviewed-reply learning + Returns resolver/admin är tidigare verifierat på sina frozen runtimes; den nya Harmoniq-harmoniserade Customer Widget v1 på application SHA `a90d29...` är IMPLEMENTED + TESTED men NOT DEPLOYED / NOT LIVE VERIFIED; nästa och enda action är read-only GATE 0 för att låsa vilken befintlig admin host/auth/storage som ska äga Customer Admin.**
