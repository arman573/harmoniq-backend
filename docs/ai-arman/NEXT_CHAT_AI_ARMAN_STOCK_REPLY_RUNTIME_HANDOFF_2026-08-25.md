# NEXT CHAT HANDOFF — AI Arman stock-aware admin reply runtime

**Datum:** 2026-08-25  
**Arbetssätt:** HARMONIQ STANDARDARBETSSÄTT + HARMONIQ ADVANCED MODULE BUILD CONTRACT v2  
**Riskklass:** **Level 3 — critical/advanced**  
**Syfte med detta dokument:** state-transfer för nästa chat. Det är inte en vanlig sammanfattning. Nästa chat ska fortsätta från verifierad current state nedan och får inte återuppliva redan stängda sidospår.

---

## 1. Exakt slutmål

AI Arman i Returns-admin ska kunna öppna ett riktigt ärende och på ett kontrollerat sätt:

1. läsa verkligt case och verklig order,
2. läsa **aktuellt lager från Vendre product API som auktoritativ källa**,
3. härleda beställt antal kontra aktuellt lager/fulfillable/shortfall,
4. skapa ett korrekt AI-svarsförslag utan att hitta på ETA, leveransmöjlighet, lager eller annan verifierbar fakta,
5. visa förslaget i den redan integrerade AI Arman-panelen i admin,
6. hålla draft/prepare helt read-only,
7. kräva uttryckligt mänskligt godkännande för riktiga writes/send,
8. efter ett faktiskt godkänt och lyckat kundsvar endast lära generell hantering/stil — aldrig återanvända tidigare lager-/orderdata som aktuell fakta,
9. aldrig läcka intern learning rationale till kund,
10. behålla separata explicit-approval gates för kundmeddelande, order/case, Vendre, Gmail och nShift.

Customer Admin presentation/GCS är en parallell del av samma adminupplevelse, men får aldrig kringgå stock-/resolver-/write-säkerheten.

---

## 2. Risknivå och processdjup

**Level 3.** Skäl: kunddata, orderdata, aktuellt lager, privat Cloud Run-auth, AI-actions, Returns gateway och senare potentiella riktiga kund/Vendre/Gmail/nShift-writes.

Konsekvens:

- fail closed vid saknad eller obekräftad fakta,
- inga produktionswrites som bieffekt av validering,
- inga trafikflyttar före separat promotion-gate,
- exakta SHAs/revisioner/runtime måste verifieras före varje kandidat/promotion,
- verklig verifierad runtime-state vinner över äldre handoff/dokumentation.

---

## 3. CURRENT GATE

**CURRENT GATE: AI-side reply credential establishment for the current stock/presentation application source.**

Senaste read-only runtime-verifieringen är **BLOCKED**, inte för att source/UI/stock saknas utan för att den nuvarande 0%-kandidatparets reply-runtimekonfiguration inte är komplett.

Senaste verifierade status:

```text
overall=blocked
inspected_at=2026-08-25T15:02:50Z
ai_candidate_revision=harmoniq-ai-arman-beta0-cpgcs-352e37b7-20
ai_candidate_traffic=0
returns_candidate_revision=harmoniq-returns-api-aistock-53
returns_candidate_traffic=0
returns_positive_revision_expected=harmoniq-returns-api-trk2494077-1
snapshot_pass=true
iam_verify_pass=true
ai_reply_enabled=true
ai_reply_token_present=false
returns_reply_enabled=unknown
returns_reply_token_present=false
reply_token_parity=false
reply_base_target_pass=false
reply_audience_target_pass=false
synthetic_ai_draft_http=skipped
synthetic_ai_draft_pass=false
real_case_id=HQR-2493528
real_returns_draft_http=skipped
real_returns_draft_pass=false
sends_customer_message=false
executes_writes=false
iam_write_executed=false
presentation_write_executed=false
order_or_case_write=false
vendre_write=false
gmail_write=false
nshift_write=false
traffic_unchanged=true
production_traffic_cutover=false
```

Detta är första kända runtime-divergence som nu ska lösas.

---

## 4. Repo / branch / PR / SHAs

### AI backend — primärt repo för NEXT ACTION

- Repo: `arman573/harmoniq-backend`
- Default branch: `main`
- Aktiv branch: `feature/ai-arman-foundation-v1`
- Relevant PR: **#18 — `AI Arman foundation v1`**
- PR-state: **open, draft, unmerged**
- Branch head före denna handoff-commit: `3e3056db7e09162fdd3fe0c0453ebda11fdf51ac`
- **Application/candidate source SHA:** `352e37b7be158cccb889e556fc7e02760939b00e`
- Application source message: `Test trusted stock learning detection and spoof resistance`
- Exact-head CI för application source: run `32753508535` — PASS
- Viktigt: workflow/status/handoff-commits efter `352e37…` är **inte** ny application source.

### Returns

- Repo: `arman573/harmoniq-returns-module`
- Default branch: `main`
- Aktiv branch: `feature/unified-order-case-inbox`
- Current branch head vid handoff-verifieringen: `bf0ad895c0777ce8ca269fa10faf08546bc5569b`
- Relevant PR: **#118**
- PR-state: **closed, unmerged**
- Historiskt PR-head i GitHub metadata: `a628c3ddfa694dcd849f95a87bc83eefbf4ca776`
- Branch har avancerat efter att PR:n stängdes.
- **PR #118 får inte återöppnas.**

### Infra/account identity

- Repo: `arman573/harmoniq-account-identity-bridge`
- Canonical infra branch: `main`
- Använd endast befintlig presentation-foundation workflow när infra behöver verifieras; skapa inte nytt infra-spår.

---

## 5. Bevisad LIVE state

### Returns — verifierad produktion

- GCP project: `harmoniq-210513`
- Region: `europe-north1`
- Cloud Run service: `harmoniq-returns-api`
- Canonical URL: `https://harmoniq-returns-api-cw6q5ekseq-lz.a.run.app`
- Runtime service account: `222024985388-compute@developer.gserviceaccount.com`
- **100% positive live revision:** `harmoniq-returns-api-trk2494077-1`
- Live tag: `tracking-hotfix-2494077`
- Live image digest: `sha256:d489f23c9ce5daae20bf8fa0efca896118b1ec9eba83ac4a36f12d29429968fc`
- Proven live source archive:
  `gs://run-sources-harmoniq-210513-europe-north1/services/harmoniq-returns-api/1787243267.34274-b2f5f35ae4734bfd8ed514c446d4d859.zip#1787243268425221`
- Tracking overlay blob: `f5e19881e9b0b8530c0d55208f560626b5911735`

**Canonical rule:** deploy aldrig Returns feature-branch wholesale. Nya kandidater måste rekonstruera exakt live archive/lineage och lägga endast explicit låsta overlays ovanpå.

### AI — verifierad stable produktion

- Cloud Run service: `harmoniq-ai-arman-beta0`
- Service är privat
- Runtime service account: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- Stable resolver revision: `harmoniq-ai-arman-beta0-resv4-07aacf15-15`
- Stable tag: `resolver-ready-3298af83`
- Stable source SHA: `07aacf157281c205aa3898b7c073cfe2444e1936`
- Stable image digest: `sha256:db42496f6f2448c165f98940e86141c1f62b0d06648bdff6c5c89cc7bd2c8101`
- Canonical stable deploy workflow: `.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Ingen ny production state ska antas utifrån branch-head eller kandidatstatus. Ovanstående är senaste bevisade live-state.

---

## 6. Current 0%-candidates / artifact / runtime

### AI current stock + presentation candidate

- Application source: `352e37b7be158cccb889e556fc7e02760939b00e`
- Revision: `harmoniq-ai-arman-beta0-cpgcs-352e37b7-20`
- Tag: `cpgcs-352e37b7`
- URL: `https://cpgcs-352e37b7---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`
- Image digest: `sha256:21a5d003f9cf8ed1eb80277df82c3c53f30ba52188310ce162dea67e6915c342`
- Traffic: **0%**
- Runtime SA: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- GCS presentation config: PASS
- Problem: reply-draft är enabled men **dedicated reply token saknas på denna revision**.

### Returns current stock + presentation bridge candidate

- Revision: `harmoniq-returns-api-aistock-53`
- Tag: `ai-arman-stock-bridge`
- URL: `https://ai-arman-stock-bridge---harmoniq-returns-api-cw6q5ekseq-lz.a.run.app`
- Image: `europe-north1-docker.pkg.dev/harmoniq-210513/cloud-run-source-deploy/harmoniq-returns-api@sha256:e36ace2573b854bcb2b6febb784158ed744793baf2adc1acff9c3eac5b3be2c1`
- Traffic: **0%**
- Runtime SA: `222024985388-compute@developer.gserviceaccount.com`
- Full-chain presentation GET: PASS
- Live Vendre stock read: PASS
- Problem: reply enable/token/base/audience är inte konfigurerade till dagens AI-kandidat.

---

## 7. Canonical deploy- och verifieringsvägar

### AI

- Current source/candidate deploy reuse: `.github/workflows/ai-arman-beta0-candidate-deploy.yml`
- Stable production deploy: `.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`
- Current-state/read-only GCP verifier: `.github/workflows/ai-arman-beta0-gcp-preflight.yml`
  - OBS: denna fil är just nu temporärt specialiserad för reply-token parity-verifiering och ska städas/återställas till slutlig canonical form innan DONE.

### Returns

- Zero-traffic canonical reconstruction workflow: `.github/workflows/deploy-ai-arman-admin-zero-traffic-candidate-once.yml`
- Måste fortsätta bygga från exakt proven live archive + låsta overlays; aldrig full feature-branch snapshot.

### Infra

- `.github/workflows/provision-ai-arman-customer-presentation-foundation-once.yml`
- Återanvänd, skapa inte ny IAM/provisioning-workflow.

---

## 8. Canonical execution path och ägarskap

### A. Admin reply draft — read-only path

1. `src/features/admin/AdminCases.jsx`
   - äger adminärendevyn och renderar kommunikationsdelen.
2. `src/features/admin/OrderCaseCommunication.jsx`
   - är det redan befintliga integrationsankaret och renderar AI Arman-panelen.
3. `src/features/admin/AiArmanReplyDraftPanel.jsx`
   - UI för att begära/visa AI-svarsförslag och kräva mänsklig granskning före separat send.
4. `src/services/adminAiArmanService.js`
   - browser/API-service för admin-AI-anrop.
5. Returns `server/src/routes/adminAiArmanReplyDraft.js`
   - endpoint: `/api/admin/cases/:caseId/ai-arman/reply-draft`
   - kräver admin-auth + `AI_ARMAN_ADMIN_REPLY_ENABLED=true`
   - laddar case server-side, bygger bounded/redacted context, accepterar inte browser/model som authority för order/stock.
6. Samma Returns route mintar Cloud Run identity token och anropar fast upstream:
   - `${AI_ARMAN_ADMIN_REPLY_BASE_URL}/ai-arman/internal/admin/reply-draft`
   - audience `AI_ARMAN_ADMIN_REPLY_AUDIENCE`
   - app credential `AI_ARMAN_ADMIN_REPLY_ACCESS_TOKEN`
   - header `X-AI-Arman-Admin-Token`
7. AI private reply-draft controller/service
   - kräver `AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED=true`
   - kräver separat `AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN`
   - producerar endast draft; kontraktet kräver `sendsCustomerMessage=false` och `executesWrites=false`.

### B. Stock-aware resolver path

`admin intent -> deterministic policy/resolver -> named typed action -> ReturnsAdminGatewayClient -> private Returns full-admin gateway -> existing Returns admin route/domain logic -> authoritative reread`

- Vendre product API via Returns äger current-stock-fakta.
- AI får resonera över server-verifierad stock men får aldrig skapa egen stockfakta.
- `prepare` är read-only.
- `execute` är separat, named/allowlisted och kräver explicit admin approval.

### C. Customer Admin presentation path

1. Returns route `server/src/routes/adminAiArmanCustomerPresentationRoute.js`
2. Returns client `server/src/services/aiArmanCustomerPresentationClient.js`
3. Private AI `/ai-arman/internal/customer-presentation`
4. AI controller `src/ai-arman/admin/admin-customer-widget-presentation.controller.ts`
5. Store `src/ai-arman/widget/customer/ai-arman-customer-widget-presentation.store.ts`
6. GCS object `ai-arman/customer-presentation-v1.json`

GET är read-only. PUT kräver `approved=true` + numeric `expectedGeneration` och använder GCS generation-CAS.

### D. Approved customer send + learning

- Customer send är **inte** reply-draft-pathen.
- Riktig send måste gå genom separat explicit approval/write path.
- Learning får ske först efter framgångsrikt granskat kundsvar.
- Approved reply får endast bli precedent för handling/style, aldrig source of truth för stock/order/product/current facts.
- Learning-save failure efter lyckad send får aldrig orsaka duplicate send.
- Intern learning rationale måste hållas privat och bortfiltreras från framtida kundkontext.

---

## 9. Viktiga arkitekturbeslut som fortfarande gäller

- Vendre **product API** är auktoritativ current-stock owner; rå orderpayload är inte current-stock source.
- Trusted stockfält: `quantity` och `products_quantity`.
- Alias som `stockQuantity`, `stock_quantity`, `stock_qty` är explicit avvisade.
- Missing/unproven stock => fail closed.
- AI Arman-panelen är redan integrerad i admin. Bygg inte en andra panel eller ny parallell UI-path.
- Reply draft och resolver execute är separata säkerhetsnivåer.
- Reply-draft ska använda en separat dedicated credential, inte Customer Admin presentation-token och inte ett annat gammalt resolver-token av bekvämlighet.
- AI service förblir privat; service-to-service använder Cloud Run identity token + app token.
- Returns productionslineage rekonstrueras exakt; feature branch får inte wholesale-deployas.
- Customer Admin presentation använder separat GCS-bucket från learning.
- Presentation Secret Manager-resurs är inte på critical path och ska inte skapas bara för att “städa upp”.
- Inga arbitrary internal URLs/methods/payloads får konstrueras av model/browser.
- Historiska candidates är evidens, inte nya canonical targets.

---

## 10. ACCEPTANCE CRITERIA

Innan production promotion får betraktas som redo ska samtliga följande vara bevisade samtidigt på kompletta 0%-candidates:

- application source är exakt låst,
- riktig HQR-case kan läsas,
- current stock reread sker från Vendre product API,
- ordered/current/fulfillable/shortfall är korrekt härledda,
- shortage påverkar draft korrekt,
- ingen full-shipment- eller ETA-utfästelse när stock är otillräcklig och ETA saknas,
- Returns reply route använder privat fast AI-endpoint,
- AI och Returns har matchande separat reply credential,
- Returns base URL pekar på aktuell AI candidate-tag URL,
- Returns audience pekar på canonical AI service URL,
- synthetic private AI draft PASS,
- real-case Returns draft PASS,
- draft response innehåller `sendsCustomerMessage=false` och `executesWrites=false`,
- UI använder redan befintlig panelintegration,
- presentation GET/PUT generation-semantik är bevisad,
- stale generation conflict är bevisad,
- bucket/IAM/service IAM är least-privilege och AI fortsatt privat,
- båda kandidaterna ligger 0% tills separat promotion-gate,
- inga kund/order/Vendre/Gmail/nShift-writes sker i candidate validation,
- production promotion sker först efter uttryckligt godkännande,
- live read-only smoke körs efter promotion,
- cleanup och canonical docs uppdateras före DONE.

---

## 11. NO-TOUCH BEHAVIOR

Nästa chat får **inte**:

- skapa ny branch,
- skapa ny workflow om befintlig canonical workflow kan användas,
- återöppna Returns PR #118,
- deploya Returns feature branch wholesale,
- flytta positiv AI/Returns-trafik innan separat explicit promotion approval,
- göra AI service publik,
- ändra eller ersätta proven stable AI resolver bara för att lösa kandidatkonfiguration,
- ändra proven Returns live revision för att lösa kandidatproblem,
- göra kundsend, order/case-write, Vendre-write, Gmail-write eller nShift-write i read-only/candidate gates,
- använda customer-authored stock JSON som authority,
- återanvända historisk stock som “current stock”,
- återintroducera `stockQuantity`/`stock_quantity`/`stock_qty` som trusted source,
- återbygga/duplicera AI Arman UI-panelen,
- återuppliva `adminfixed-*`, `stklearn-*` eller andra gamla candidates som canonical target,
- använda default compute SA som IAM-provisioning workaround,
- skapa Customer Admin Secret Manager-resurs utan nytt konkret krav,
- sänka token/identity/auth checks för att få grönt test,
- logga eller persist:a app-token i docs/status/artifacts,
- tolka workflow/status/handoff commit som application source.

---

## 12. IMPLEMENTED

### Stock

- `server/src/services/vendreProductStockService.js` hardened till Vendre product API authority.
- Trusted `quantity`/`products_quantity` only.
- Fail-closed, duplicate caching och alias rejection implementerat.
- Stock kontext injiceras server-side till AI/resolver.

### AI resolver / learning

- Read-only prepare och separat explicit-approved execute.
- Stock-aware shortage reasoning.
- No-invented-ETA guard.
- Reviewed-reply learning finns med privata rationale-gränser.
- Approved learning är style/handling precedent, inte fakta-ägarväg.

### Admin UI / reply

- `AdminCases.jsx` → `OrderCaseCommunication.jsx` → `AiArmanReplyDraftPanel.jsx` är redan inkopplat.
- Returns `adminAiArmanReplyDraft.js` finns och är registrerad i full-admin source-lineage.
- Fixed private AI reply endpoint + Cloud Run identity token + separate app-token contract finns i koden.

### Customer Admin presentation

- Returns presentation bridge GET/PUT.
- Private AI presentation controller.
- GCS store med generation-CAS.
- Dedicated bucket + least-privilege object access.

---

## 13. TESTED

- Stock unit/integration tests gröna inklusive:
  - ordered 3 / stock 1 => fulfillable 1 / shortfall 2,
  - fail closed,
  - duplicate caching,
  - aliases rejected.
- AI application source `352e37…` exact-head CI: PASS.
- Current-source stock E2E run `32756448819`: PASS.
  - prepare_pass=true
  - stock_reasoning_pass=true
  - eta_guard_pass=true
- Presentation GCS candidate tests/build: PASS.
- Presentation controlled PUT/reread/stale-CAS: PASS.
- Full-chain Returns→AI→GCS presentation GET: PASS.
- Latest reply-token parity **read-only** verifier: BLOCKED på runtime config, men:
  - snapshots PASS,
  - IAM verify PASS,
  - traffic unchanged true,
  - inga writes skedde.

---

## 14. DEPLOYED

### AI candidates

- `harmoniq-ai-arman-beta0-stke2e-352e37b7-14` — historical stock E2E, 0%.
- `harmoniq-ai-arman-beta0-cpgcs-352e37b7-20` — current stock/presentation candidate, 0%.
- Historical `harmoniq-ai-arman-beta0-adminfixed-2b22ccc6-1` — old reply evidence only, 0%; inte current target.

### Returns candidates

- `harmoniq-returns-api-aistock-52` — historical first stock+bridge candidate, 0%.
- `harmoniq-returns-api-aistock-53` — current stock+presentation full-chain candidate, 0%.

Ingen av ovanstående är positiv produktionstrafik.

---

## 15. LIVE VERIFIED

Följande är live-verifierat, inte bara testat i source:

- Returns production är fortfarande exakt `harmoniq-returns-api-trk2494077-1` på 100%.
- AI service är privat och proven stable resolver revision finns kvar.
- Returns runtime SA har exact `roles/run.invoker` mot AI service.
- Presentation bucket är private/UBLA/PAP-enforced och AI runtime har bucket-scoped `roles/storage.objectUser`.
- HQR-2493528 live Vendre product stock lästes som:
  - ordered = 3
  - current verified stock = 0
  - fulfillable = 0
  - shortfall = 3
  - can fulfill ordered quantity now = false
- Current-source AI stock E2E resonerade rätt och hittade inte på ETA.
- Presentation GCS object skapades via explicit approved write och reread:
  - current generation `1787596107881229`
  - stale generation 0 reject = HTTP 409.
- Returns `aistock-53` läser samma GCS generation genom hela privata bridge-kedjan.
- Positive production traffic var oförändrad under dessa gates.

---

## 16. Canonical check / senaste testresultat

### Senaste canonical check

Read-only reply-token parity verifier körde mot:

- AI candidate `cpgcs-352e37b7-20` @ 0%
- Returns candidate `aistock-53` @ 0%
- Returns positive expected `trk2494077-1`

Resultat: **BLOCKED endast på reply runtime config.**

### Expected vs actual

**Expected:**

- AI: `AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED=true`
- AI: `AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN` finns, längd >=32
- Returns: `AI_ARMAN_ADMIN_REPLY_ENABLED=true`
- Returns: matching `AI_ARMAN_ADMIN_REPLY_ACCESS_TOKEN`
- Returns: `AI_ARMAN_ADMIN_REPLY_BASE_URL` = current cpgcs tag URL
- Returns: `AI_ARMAN_ADMIN_REPLY_AUDIENCE` = canonical AI service URL
- synthetic private AI draft HTTP 200
- real HQR-2493528 Returns draft HTTP 200
- no send/no write

**Actual:**

- AI reply enabled = true
- AI dedicated reply token = **missing**
- Returns reply enabled = **absent/unknown**
- Returns reply token = **missing**
- reply token parity = false
- base target = false
- audience target = false
- synthetic draft = skipped
- real-case draft = skipped
- traffic unchanged = true
- all write flags = false

### Första kända divergence

**Runtime configuration, inte source code.**

Source/UI/reply route är redan bevisade i full-admin lineage. Den nuvarande `cpgcs`/`aistock` kandidatduon saknar ett gemensamt dedicated reply credential och rätt Returns target config. Återöppna inte source/UI-arkitekturen.

---

## 17. Vad som är BEVISAT

- Current stock kommer inte från rå orderpayload.
- Vendre product API är current-stock authority.
- Trusted stockfält är låsta.
- Stock shortage arithmetic fungerar.
- Real HQR-2493528 current stock är 0 i senaste verifiering.
- Current AI source `352e37…` kan göra correct shortage reasoning.
- No-invented-ETA guard fungerar.
- Full admin UI/reply source finns i live-base lineage.
- AI Arman-panelen är redan inkopplad i admin source.
- AI service är privat.
- Returns runtime kan invoke AI genom exact service IAM.
- Presentation GCS och generation locking fungerar.
- Approved presentation write + authoritative reread fungerar.
- Stale presentation write nekas med 409.
- Returns full-chain GET når current AI/GCS presentation.
- Latest parity-gate gjorde inga writes och ändrade ingen produktionstrafik.

---

## 18. Vad som INTE ÄR BEVISAT

- Att en **current-source** AI candidate med stock/presentation samtidigt har korrekt dedicated reply-draft-token.
- Att en current Returns 0%-candidate har matching reply token + rätt base URL + rätt audience.
- Att ett real-case `HQR-2493528` reply-draft fungerar genom hela current Returns→AI reply path.
- Att det real-case draftet samtidigt behåller shortage/no-ETA-säkerheten i exakt den kompletta kandidatduon.
- Production promotion av den kompletta lösningen.
- Live admin smoke efter sådan promotion.
- En naturligt producerad learning record efter ett verkligt godkänt kundsvar; skapa inte ett syntetiskt kundmeddelande bara för att bevisa detta.

---

## 19. Open blockers

**Enda blocker i current gate:** current AI stock/presentation candidate saknar `AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN`, vilket gör att Returns inte kan konfigureras korrekt mot den utan att först etablera AI-side credential på en ny 0%-AI candidate.

Det är inte ett IAM-blocker, source-blocker, UI-blocker, stock-blocker eller GCS-blocker.

---

## 20. Externa system och write-status

### Vendre

- Read: aktivt och bevisat via product API.
- Current HQR stock: 0.
- Writes i current/latest gate: **inga**.

### GCS — Customer Admin presentation

- Bucket: `harmoniq-210513-ai-arman-customer-presentation`
- Location: `EUROPE-NORTH1`
- Storage class: STANDARD
- Uniform bucket-level access: true
- Public access prevention: enforced
- Current object: `ai-arman/customer-presentation-v1.json`
- Current generation: `1787596107881229`
- En tidigare explicitly approved controlled presentation write har skett.
- Latest parity gate: **ingen GCS write**.

### GCS — learning

- Separat bucket: `gs://harmoniq-210513-ai-arman-learning`
- Håll separerad från presentation.
- Ingen syntetisk kundsend för att forcera learning.

### Gmail

- Latest/current gate writes: **inga**.

### nShift

- Latest/current gate writes: **inga**.

### Customer/order/case

- Latest/current gate writes: **inga**.

### Cloud Run IAM

- AI remains private.
- Exact invoker:
  `serviceAccount:222024985388-compute@developer.gserviceaccount.com`
  → `roles/run.invoker` på `harmoniq-ai-arman-beta0`.
- Latest gate IAM write: **false**.

### Production traffic

- Latest gate traffic mutation: **false**.
- Returns production stays on `trk2494077-1`.
- Current AI/Returns candidates stay 0%.

---

## 21. Temporära workflows / diagnostics / branches / candidates

### Workflows

- `.github/workflows/ai-arman-beta0-gcp-preflight.yml`
  - temporärt specialiserad till reply-token parity current-state verifier.
  - senaste verifieringsprep commit: `55d1cdd7b6952489bf569c4f93c30566af174c59`
  - trigger commit: `f37bdb5ccacc9fb7086ac3e54b699ec02d71598f`
  - result bot commit före handoff: `3e3056db7e09162fdd3fe0c0453ebda11fdf51ac`
- Returns `.github/workflows/deploy-ai-arman-admin-zero-traffic-candidate-once.yml`
  - hade en temporär read-only composition-provenance modifiering/trigger som inte körde via push.
  - senare source/blob/workflow lineage-bevis stängde source-frågan ändå.

### Status/docs

- AI `.github/deploy-status/ai-arman-returns-invoker-readonly-latest.txt` innehåller latest blocked parity-resultat.
- Returns `docs/AI_ARMAN_STOCK_BRIDGE_ZERO_TRAFFIC_CANDIDATE_LATEST.md` har ett temporärt `Verification requested: pending`-stycke för composition-provenance. Det är inte längre source-blocker och ska städas före DONE.

### Candidates

Current useful:

- AI `cpgcs-352e37b7-20` — current evidence target, 0%.
- Returns `aistock-53` — current evidence target, 0%.

Historical evidence only:

- AI `stke2e-352e37b7-14`
- AI `stklearn-cae86ef8-8`
- AI `adminfixed-2b22ccc6-1`
- Returns `aistock-52`
- andra gamla diagnostic/candidate tags.

Radera/cleanup inte historiska candidates förrän final evidence är säkrat, men återanvänd dem inte som canonical target.

---

## 22. Vad nästa chat INTE ska återinföra

- ny UI wiring,
- ny stock authority,
- orderpayload som stock source,
- parallell AI reply implementation,
- ny arbitrary gateway,
- ny branch,
- ny deployment workflow,
- gammal `adminfixed-*` som lösning,
- Customer Admin-token som ersättning för dedicated reply token,
- generell Secret Manager-provisioning som workaround,
- wholesale Returns deploy,
- positiva trafiktester före gate,
- syntetisk kundsend för learning,
- gamla stocknummer i model context som current fact.

---

## 23. Change budget för nästa steg

**Minimal Level-3 change budget:** endast AI 0%-candidate runtime-konfiguration i befintlig canonical candidate workflow.

Tillåtet i NEXT ACTION:

- återanvänd application source `352e37…`,
- generera en ny stark candidate-only reply token,
- maska token i Actions,
- sätt `AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED=true` om inte redan exakt true,
- sätt `AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN=<generated>` på ny 0%-AI revision,
- behåll current stock/presentation/resolver/runtime/private config,
- syntetisk private draft verification,
- sanitized status utan tokenvärde.

Inte tillåtet i samma action:

- reconfigure Returns,
- production traffic,
- customer send,
- Vendre/Gmail/nShift/order/case write,
- source feature changes,
- ny branch/workflow,
- IAM expansion.

---

# 24. EXACT NEXT ACTION — ENDA NEXT ACTION

**Deploy one new private 0%-AI candidate from the exact frozen application source `352e37b7be158cccb889e556fc7e02760939b00e` using the existing `.github/workflows/ai-arman-beta0-candidate-deploy.yml`, adding only a freshly generated dedicated `AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN` while preserving current resolver, stock-learning, Customer Admin presentation GCS configuration, runtime service account, service privacy and zero traffic; then verify that AI reply-draft is enabled and a synthetic private `/ai-arman/internal/admin/reply-draft` call returns a valid draft with `sendsCustomerMessage=false` and `executesWrites=false`.**

**Gör inte Returns-reconfiguration i samma action.** När och endast när denna AI-side gate är grön blir följande framtida gate att skapa en ny Returns 0%-candidate med matching token/base/audience.

---

## 25. Hur EXACT NEXT ACTION ska verifieras

Gaten är endast GREEN om alla dessa är sanna:

- checkout/build source = exakt `352e37b7be158cccb889e556fc7e02760939b00e`,
- tests/build/docker gate PASS,
- befintlig AI positive traffic snapshot före/efter är identisk,
- ny candidate revision är non-empty och 0%,
- service är fortfarande private — ingen `allUsers`/`allAuthenticatedUsers`,
- runtime SA = `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`,
- `AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED=true`,
- dedicated reply token finns och är minst 32 tecken,
- token maskas och skrivs inte till docs/status,
- presentation bucket/object env är exakt oförändrade,
- resolver/stock-learning critical config är oförändrad jämfört med current proven candidate/stable requirements,
- synthetic private reply draft HTTP = 200,
- response `ok=true`,
- non-empty `draftText`,
- `sendsCustomerMessage=false`,
- `executesWrites=false`,
- ingen presentation GCS write,
- ingen customer/order/case/Vendre/Gmail/nShift write,
- ingen production cutover.

Vid minsta fail: **fail closed och rör inte Returns**.

---

## 26. Rollback / recovery

NEXT ACTION är 0%-candidate only, därför är rollback i första hand att **inte flytta trafik**.

Om ny AI candidate misslyckas:

- lämna revisionen på 0% eller ta bort dess tag senare under cleanup,
- ändra inte stable AI resolver revision,
- ändra inte Returns live revision,
- diagnostisera exakt env/revision/testfail,
- gör minimal fix i samma befintliga candidate workflow,
- redeploya från samma application source `352e37…`,
- sänk aldrig auth/token/private-service-krav för att få grönt.

Om workflowens temporära ändring introducerar unrelated diff:

- återställ endast workflowen till senast känd canonical variant,
- påverka inte application source.

---

## 27. Cleanup innan DONE

DONE betyder **inte** “0%-gates gröna”. Följande cleanup/finalisering återstår:

- AI-side reply token gate green,
- därefter separat Returns 0%-candidate med matching token/base/audience,
- full current real-case stock-aware reply-draft smoke green,
- separat explicit approval för production promotion,
- kontrollerad AI/Returns promotion enligt canonical lineage,
- live read-only smoke efter promotion,
- record exact live revisions/digests/traffic,
- återställ/finalisera generic syfte för `ai-arman-beta0-gcp-preflight.yml`,
- städa temporary Returns composition-provenance job/marker om den inte ska vara canonical,
- ta bort `Verification requested: pending` från Returns evidence när final provenance är dokumenterad,
- cleanup stale 0%-tags/revisions först efter att final evidence bevarats,
- uppdatera canonical AI Arman handoff/source-of-truth docs,
- PR #18 förblir draft/unmerged tills separat mergebeslut,
- PR #118 förblir closed,
- verifiera att inga tokenvärden finns i docs/status/history,
- låt naturlig approved-reply learning verifieras när ett riktigt kundärende senare faktiskt godkänns; skapa inte fake send för detta.

---

## 28. Snabb startinstruktion till nästa chat

Börja med GATE 0 read-only och verifiera att verkligheten fortfarande matchar:

- AI repo/branch/PR,
- application source `352e37…`,
- stable AI revision,
- Returns live `trk2494077-1`,
- current 0%-candidates,
- latest parity status.

Om state är oförändrad: **utför exakt NEXT ACTION i §24 direkt.**

Återupptäck inte stock source, UI wiring, GCS presentation architecture eller historical adminfixed-candidates utan konkret ny divergence. Verkligheten vinner om någon runtime-state har ändrats.
