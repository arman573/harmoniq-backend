# NEXT CHAT HANDOFF — AI ARMAN RESOLVER / REVIEWED-REPLY LEARNING

**Datum:** 2026-08-22

**Primärt repo:** `arman573/harmoniq-backend`

**Resolver implementation source branch:** `ops/ai-arman-resolver-candidate-20260820`

**Canonical AI deploy branch:** `feature/ai-arman-foundation-v1`

**Returns repo:** `arman573/harmoniq-returns-module`

**Returns resolver branch:** `feature/ai-arman-case-resolver-ui`

**Risknivå:** LEVEL 3 — KRITISK / AVANCERAD

**Stående arbetsregel:** `HARMONIQ ADVANCED MODULE BUILD CONTRACT v2` + Harmoniq Development Operating System.

Detta dokument beskriver NUVARANDE verifierade läge. Skapa inte v5/v6, en ny resolver eller en parallell deployväg för att komma runt problem.

---

# MÅL

AI Arman ska i Returns-admin arbeta enligt:

`verifierat ärende -> förstå aktuellt kundbehov -> föreslå lösning + kundsvar -> admin granskar -> admin godkänner -> exakt allowlistad action får verkställas -> godkänt svar kan bli privat lär-exempel`

AI Arman får lära sig **hanteringsmönster, ton och ett faktiskt admin-godkänt kundsvar**. Gamla lär-exempel är aldrig source of truth för fakta. Backend/systemintegrationer äger alltid aktuellt pris, lager, orderstatus, tracking, returutfall, policy, behörighet och writes.

Stage 1 är fortfarande **approval required**. Autonomt kundutskick är inte aktiverat.

---

# CURRENT GATE

**Reviewed-reply learning + AI resolver + Returns resolver är IMPLEMENTERAT, TESTAT och DEPLOYAT till verifierade 0%-stable-tagged resolverrevisioner.**

Frontendfältet är också bevisat i Cloudflare production bundle.

Det enda som medvetet ännu inte kallas LIVE VERIFIERAT är en **första verklig persistent lesson-write från ett riktigt admin-godkänt kundsvar**. Vi skapade inte en syntetisk diagnostic write-route och förorenade inte learning-store bara för att ticka en ruta.

Nästa verkliga learning-write ska därför ske genom den normala adminprocessen när ett riktigt kundsvar granskas och skickas. Efter den första riktiga händelsen kan objektets uppdatering verifieras read-only utan att exponera intern text.

---

# REVIEWED-REPLY LEARNING — CANONICAL DESIGN

UI har ett separat fält:

`Intern lärnotering till AI Arman`

Det är **inte** samma fält som produktbeslutets `Adminnotering`.

Säkerhetsregler:

1. Intern lärnotering är endast intern och får aldrig skickas till kunden.
2. Kundtransporten får endast kundens godkända subject/message, aldrig `internalRationale`.
3. Efter lyckat, explicit godkänt kundutskick kan godkänt svar + intern motivering sparas i privat learning-store.
4. Om learning-save faller efter att kunden redan fått svaret får meddelandet aldrig skickas igen.
5. `internalRationale` lagras privat men strippas ur `listRelevant()` innan framtida kundsvarsmodell får kontext. Kundsvarsmodellen kan alltså inte läsa den råa hemliga motiveringen.
6. `approvedReplyExample` får användas som stil-/hanteringsprecedent, aldrig som faktakälla.
7. Aktuella verifierade case-/order-/produkt-/lagerfakta vinner alltid över tidigare lärdomar.
8. Ett admin-godkänt svar kan bli lär-exempel även om den extra interna lärnoteringen lämnas tom.

Detta stödjer t.ex. att admin internt beskriver den verkliga orsaken till en kundvänlig formulering utan att den interna orsaken läcker till kunden eller återanvänds som verifierad fakta i ett annat ärende.

---

# AI BACKEND — IMPLEMENTATION SOURCE

Verifierad resolver/learning source:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Viktiga filer/ansvar inkluderar:

- `src/ai-arman/admin/admin-learning.store.ts`
- resolver execute-boundaryn som skiljer kundtransport från privat learning-save
- admin assistant/reply path som läser godkända supportlärdomar utan rå `internalRationale`

Regressioner bevisar bland annat:

- intern motivering når inte kundtransport,
- learning-fel efter send orsakar inte dubbel-send,
- reviewed-reply learning-fält är bounded,
- learning-data går endast mot privata resolvervägen,
- denied/unsupported actions förblir fail-closed.

---

# AI BACKEND — TESTAT

Canonical AI-v4 run:

`32580717752`

På source:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Verifierat:

- **107/107 test suites PASS**
- **648/648 tests PASS**
- build PASS
- Docker PASS
- WIF PASS
- immutable image push PASS
- HQR-2494077 read-only prepare PASS
- `approved:false` execute blocked
- real write under verification = false
- customer message under verification = false

---

# AI BACKEND — ARTIFACT / RUNTIME PROVENANCE

Canonical workflow:

`.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Service:

`harmoniq-ai-arman-beta0`

Region:

`europe-north1`

Source:

`07aacf157281c205aa3898b7c073cfe2444e1936`

Image digest:

`sha256:db42496f6f2448c165f98940e86141c1f62b0d06648bdff6c5c89cc7bd2c8101`

Stable resolver revision:

`harmoniq-ai-arman-beta0-resv4-07aacf15-15`

Stable resolver tag:

`resolver-ready-3298af83`

Stable URL:

`https://resolver-ready-3298af83---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

Resolverrevisionen är avsiktligt en **taggad 0%-revision**. Normal positiv service-trafik ändrades inte.

Known previous AI stable revision för rollback:

`harmoniq-ai-arman-beta0-resv4-07aacf15-9`

---

# PRIVATE LEARNING STORAGE — VERIFIERAT

Bucket:

`gs://harmoniq-210513-ai-arman-learning`

Object path:

`ai-arman/support-learning-v1.json`

Verifierat state:

- location `EUROPE-NORTH1`
- storage class `STANDARD`
- uniform bucket-level access = true
- public access prevention = enforced
- public principal = false
- runtime identity = `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- runtime role = `roles/storage.objectUser` på **bucket scope**
- runtime project roles = `[]`

Sanerad permanent infra-evidens ligger i `arman573/harmoniq-account-identity-bridge`:

`docs/automation-status/ai-arman-learning-bucket-provision-20260822.json`

Tre temporära discovery/provision-verifieringsworkflows är borttagna efter verifiering. Två obsolete discovery-resultat är också bortstädade. Den slutliga verifierade bucket-evidensen behålls.

AI-deployern fick INTE någon bred Storage-roll. Learning-infra och AI-deploy är medvetet separerade ansvar.

---

# RETURNS RESOLVER — IMPLEMENTERAT / TESTAT / DEPLOYAT

Repo:

`arman573/harmoniq-returns-module`

Branch:

`feature/ai-arman-case-resolver-ui`

Canonical workflow:

`.github/workflows/deploy-ai-arman-resolver-returns-write-ready-once.yml`

Final canonical run:

`32581393936`

Final source SHA:

`7c915d6f12711e60fd920ba3a5ecc09c5cc4bb2f`

Image digest:

`sha256:8612870f529854648efbda0fff02725f277bd147ba8504b17c26ca034dfa6469`

Stable resolver revision:

`harmoniq-returns-api-airesolver-7c915d6f-26`

Stable resolver tag / URL:

`resolver-ready-431fc50f`

`https://resolver-ready-431fc50f---harmoniq-returns-api-cw6q5ekseq-lz.a.run.app`

Verifierat:

- frontend build PASS
- resolver-focused server tests PASS
- Docker PASS
- immutable Artifact Registry push PASS
- exact registry digest captured från successful push response
- AI stable learning config PASS
- 0%-candidate PASS
- config parity PASS
- positive production traffic unchanged
- real prepare PASS
- `approved:false` blocked
- unsupported approved action blocked
- stable resolver URL probe PASS
- supported real write during verification = false
- customer message during verification = false

Returns resolver stable revision är också avsiktligt **0% normal traffic**.

---

# ROOT CAUSES LÖSTA UNDER DENNA FAS

Följande divergence hittades och löstes i samma canonical spår:

1. AI stable/candidate token parity: `AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN`.
2. Learning bucket saknades helt; privat bucket provisionerades med least privilege.
3. AI deploy-identiteten saknade bucket-read och fick INTE onödigt bredare storage-IAM; infra-proof separerades från deployansvar.
4. Returns Artifact Registry push fungerade men extra `gcloud artifacts docker images describe` krävde onödig `containeranalysis.occurrences.list`; workflow använder nu digest från registry push response i stället för att bredda IAM.
5. Returns candidate traffic tag var för lång tillsammans med service name; endast taggen kortades till Cloud Run-säker längd.

Ingen v5/v6 eller parallell production path skapades för att lösa dessa problem.

---

# FRONTEND — LIVE VERIFIERAT

Production branch för Returns admin frontend:

`refactor-admin-return-flow-cleanup`

Learning-UI production commit:

`31e84781d8381d20951e55ac246451df48c58bc3`

Verifierad production bundle:

`assets/index-CuJT6P6R.js`

Runtime proof visade:

- modern markers: **5/5**
- `prod_learning_marker=yes`
- modern 240-cap beteende kvar

Frontend visar separat intern learning-notering och gör inte produktbeslutets adminnotering till learning-fält.

---

# SKILLNADEN MELLAN IMPLEMENTERAT / TESTAT / DEPLOYAT / LIVE VERIFIERAT

**IMPLEMENTERAT**

- reviewed reply learning
- privat internal rationale
- bounded forwarding
- post-send learning-save
- no-resend-on-learning-failure
- future approved reply examples
- hard stripping of raw internal rationale before customer-model context

**TESTAT**

- AI backend 107/107 suites, 648/648 tests
- Returns focused resolver contract tests
- builds/Docker
- denied/unsupported write gates

**DEPLOYAT**

- AI stable-tagged 0%-revision `harmoniq-ai-arman-beta0-resv4-07aacf15-15`
- Returns stable-tagged 0%-revision `harmoniq-returns-api-airesolver-7c915d6f-26`
- Cloudflare production frontend med learning-UI
- privat GCS learning storage + runtime IAM

**LIVE VERIFIERAT**

- UI finns i production bundle
- AI read-only prepare via stable URL
- Returns read-only prepare via stable URL
- learning env/config finns på AI revision
- bucket/IAM/säkerhetsstate verifierad
- write boundaries blockerar denied/unsupported actions

**ÄNNU INTE LIVE-OBSERVERAT**

- första riktiga persistent lesson-write efter ett faktiskt admin-granskat och skickat kundsvar.

Det är medvetet. Skapa inte syntetisk kundmessage eller artificiell learning-post bara för att verifiera detta.

---

# ROLLBACK / RECOVERY

AI resolver:

- current: `harmoniq-ai-arman-beta0-resv4-07aacf15-15`
- previous known good: `harmoniq-ai-arman-beta0-resv4-07aacf15-9`
- rollback ska ske genom samma stable-tag-mekanism och positive traffic ska verifieras oförändrad.

Returns resolver:

- current: `harmoniq-returns-api-airesolver-7c915d6f-26`
- stable tag: `resolver-ready-431fc50f`
- normal positive Returns traffic ändrades inte av releasegaten.
- vid verkligt fel: identifiera föregående stable resolver revision från Cloud Run/tag provenance före retag; gissa inte.

Learning storage:

- radera eller ändra inte bucket/IAM som rollback för en vanlig resolverbugg.
- learning-save kan faila utan att ett redan skickat kundsvar får skickas igen.

---

# CLEANUP STATUS

Klart:

- gamla v3 resolver deployspåret borttaget tidigare,
- temporary AI v4 parity diagnostic borttaget tidigare,
- temporary GCS admin discovery workflow borttaget,
- temporary bucket-IAM discovery workflow borttaget,
- temporary bucket provision/verification workflow borttaget,
- obsolete discovery JSON-filer borttagna,
- permanent slutlig bucket verification evidence behållen,
- inga nya v5/v6-spår skapade.

Rör inte fler gamla workflows enbart på namn. Resterande cleanup kräver read-only ansvarsklassning först.

---

# NÄSTA — EXAKT

1. Vänta på första riktiga admin-användningen av learning-funktionen.
2. När ett faktiskt granskat kundsvar med learning aktiverat har skickats: verifiera read-only att learning-objektets generation/timestamp ändrades utan att läsa eller logga intern kund-/admintext.
3. Verifiera därefter på ett naturligt liknande framtida case att ett godkänt svarsexempel kan påverka hanteringsstil utan att gamla fakta återanvänds.
4. Fortsätt därefter architecture cleanup read-only: klassificera resterande gamla AI Arman workflows/branches/PR:er efter verkligt ansvar innan något raderas eller mergas.
5. Om något faller: EXPECTED vs ACTUAL -> första divergence -> root cause. Ingen v5/v6.

---

# DEFINITION OF DONE — DENNA LEARNING-FAS

Den tekniska learning-infrastrukturen är nu implementerad, testad och deployad med verifierad privacy boundary och least-privilege storage. Frontend och båda resolverkedjorna är live-verifierade på read-only/blocked-write nivå.

Fasen blir **fullt live-observerad** först när första riktiga admin-godkända kundsvaret naturligt producerar en persistent lesson-write och den kan verifieras read-only. Fram till dess ska status uttryckas exakt så — inte som att en faktisk production lesson redan har skrivits.
