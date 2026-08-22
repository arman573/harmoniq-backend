# NEXT CHAT HANDOFF — AI ARMAN RESOLVER / ADMIN

**Datum:** 2026-08-22

**Repo:** `arman573/harmoniq-backend`

**Risknivå:** LEVEL 3 — KRITISK / AVANCERAD

**Stående arbetsregel:** `HARMONIQ ADVANCED MODULE BUILD CONTRACT v2`

Den generella Harmoniq-handoff som Arman klistrar in före kontraktet gäller fullt ut här. Nästa chat ska läsa hela kontraktet innan den fortsätter. Detta dokument är den projektspecifika AI Arman-handoff som kompletterar kontraktet.

---

# MÅL

Få AI Arman i riktiga Returns-admin att säkert och snabbt göra:

`verifierat ärende -> förstå senaste kundbehov -> föreslå lösning + kundsvar -> admin granskar -> admin godkänner -> exakt godkänd action får verkställas`

Stage 1 är målet nu: **approval required**.

Stage 2 / autonomt kundutskick är **inte aktiverat** och ska inte aktiveras i detta arbete.

AI Arman får aldrig hitta på pris, lager, INCI, orderstatus, tracking, returutfall eller andra verifierbara fakta. Backend/systemintegrationer är auktoritet. AI:n tolkar och formulerar.

Kundtonen ska vara varm, personlig och Arman-lik, inte corporate. Mailmotorn äger hälsning/signatur; AI-brödtexten ska därför inte innehålla `Hej`, `Mvh`, `Vänliga hälsningar`, `HARMONIQ Kundservice` etc.

---

# CURRENT GATE

**GATE: Architecture restoration + exakt post-deploy divergence i backend-candidaten.**

Skapa **inte** en ny `v5`, ny deploybranch eller ny workaround-workflow.

Den senaste v4-körningen kom långt nog för att bevisa att source, test, build, WIF, image push och Cloud Run-deploy fungerar. Den föll **efter** att Cloud Run redan skapat 0%-candidaten, i samma steg som kontrollerar candidate metadata/config parity.

Nästa chat ska därför använda den redan existerande v4-vägen som tillfällig felsökningsyta, identifiera **första exakta divergence**, fixa roten och sedan konsolidera till ett canonical deployspår.

---

# BEVISAT

## Source / implementation

Resolver-source ligger på:

`ops/ai-arman-resolver-candidate-20260820`

Senaste verifierade implementation+test-SHA:

`8ad1c47e31dfb82aef879f9cc63837fe1befe21a`

Viktiga commits precis före denna SHA:

- `ce4c739e969372e3efed26925be9001fff22bcc0` — senaste kundmeddelandet prioriteras deterministiskt; resolved-case guard.
- `7bcc7138a34760ae3e845116ac644c5d15a9b50c` — regressionstest för HQR-2494077-scenariot.
- `88f5555ae9ca96d7b18b09a411d9b368e2bc2b94` — korrigerade resolved-case-testet så historik får nämna gammalt behov utan att behovet återöppnas.
- `8ad1c47e31dfb82aef879f9cc63837fe1befe21a` — gamla reply-draft-testet anpassades till mail-body-kontraktet utan `Hej`.

## Test/build

GitHub Actions run:

`32570376514`

Job:

`97024895041`

På exakt source-SHA `8ad1c47e31dfb82aef879f9cc63837fe1befe21a`:

- **107/107 test suites PASS**
- **646/646 tests PASS**
- `npm run build` PASS
- Docker build PASS
- npm audit i körningen: 0 vulnerabilities

Detta betyder att de två tidigare röda testerna inte längre är ett blockerande problem.

## WIF / GCP-auth

I samma run:

- `google-github-actions/auth@v3` PASS
- `setup-gcloud` PASS
- snapshot av privat stable resolver PASS
- stable safety flags verifierades:
  - resolver enabled = true
  - Returns admin gateway enabled = true
  - Returns admin write enabled = true
  - admin assistant enabled = true
  - model interpretation enabled = true
  - model promotion enabled = false

Alltså: tidigare WIF-problemet är löst på `feature/ai-arman-foundation-v1`.

## Image artifact

Image byggdes och pushades framgångsrikt.

Digest:

`sha256:b8b9d3d4b88c2bdc536937d3bc30522bfc86be3d7c5827e6d147cecc6c1a49e1`

## Cloud Run candidate

Cloud Run skapade faktiskt denna nya revision:

`harmoniq-ai-arman-beta0-resv4-8ad1c47e-2`

Direkt taggad candidate-URL:

`https://resolver-v4-8ad1c47e---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

Cloud Run rapporterade uttryckligen:

`serving 0 percent of traffic`

Alltså: en riktig 0%-candidate finns och koden hann deployas.

## Säkerhetsgräns i v4

Workflowen hann **inte** till real HQR-2494077 prepare, denied-write-test eller stable retag eftersom post-deploy-steget föll först.

Ingen kundmessage skickades.

Ingen godkänd real write kördes av denna verifieringskedja.

Stage 2/autonomt utskick är fortfarande av.

---

# INTE BEVISAT

Följande får nästa chat **inte** anta:

1. Att stable resolver-taggen nu pekar på `8ad1c47...`.
2. Att den nya candidaten har korrekt env/config parity mot proven stable revision.
3. Att HQR-2494077 ger rätt real output i candidaten.
4. Att warm prepare är <= 12 sekunder.
5. Att live Vendre-admin faktiskt använder den nya AI-revisionen.
6. Att Cloudflare Pages senaste prefetch-kod är publicerad.
7. Att `main` är source of truth.
8. Att någon av de många historiska workflowfilerna är canonical bara för att den finns.

Stable retag-steget i run `32570376514` var **skipped**.

---

# DEN EXAKTA SENASTE DIVERGENCEN

Run `32570376514` klarade:

`tests -> build -> WIF -> stable snapshot -> image build/push -> gcloud run deploy`

Sedan föll steg:

`Deploy private zero-traffic candidate`

Cloud Run-deployen själv lyckades och skapade revisionen. Felet inträffade alltså i de efterföljande assertions i samma shell-block.

Blocket gör i denna ordning:

1. läser service JSON,
2. hittar revision via tag `resolver-v4-8ad1c47e`,
3. hittar tag URL,
4. kräver non-empty revision + URL,
5. kräver summerad positive traffic för revisionen = 0,
6. beskriver revisionen,
7. jämför candidate env med stable env för följande variabler:
   - `AI_ARMAN_ADMIN_RESOLVER_ENABLED`
   - `AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN`
   - `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED`
   - `AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL`
   - `AI_ARMAN_RETURNS_ADMIN_GATEWAY_AUDIENCE`
   - `AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN`
   - `AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED`
   - `AI_ARMAN_ADMIN_ASSISTANT_ENABLED`
   - `AI_ARMAN_MODEL_INTERPRETATION_ENABLED`
   - `AI_ARMAN_OPENAI_MODEL`
   - `AI_ARMAN_MODEL_PROMOTION_ENABLED`

Workflowen använder tysta `test`-assertions, så loggen visar inte vilken av dessa som divergerade.

**Stark hypotes men INTE bevis:** config/env parity är den sannolika stoppunkten, eftersom Cloud Run uttryckligen rapporterade 0% och tag-URL skapades. Nästa chat måste mäta, inte anta.

---

# ÄNDRAT I FUNKTIONEN

## Latest-customer-state guard

`src/ai-arman/admin/admin-case-assistant-fast.service.ts`

Senaste kundmeddelandet exponeras separat och väger tyngst för aktuellt behov.

När kunden tydligt själv bekräftar att ett tidigare problem är löst och inte ställer en ny fråga:

- gamla behov får inte återöppnas,
- `customerNeed` blir att ingen ny åtgärd efterfrågas,
- actions blir varm bekräftelse/avslutning,
- replyDraft får inte börja fråga om gammal tracking/sändnings-ID/öppettider igen.

Det finns dessutom en deterministisk backend-guard; detta är inte bara promptinstruktion.

## HQR-2494077 regression

Testet simulerar medvetet en modell som försöker ge det gamla dåliga svaret om sändnings-ID och öppettider.

Backend ska ändå ge ungefär:

`Åh vad skönt vännen att det löste sig 🤍 Du behöver verkligen inte be om ursäkt, jag fattar att det blev stressigt. Ha en superfin resa! 🫶`

Historisk sammanfattning får fortfarande säga att kunden **tidigare** efterfrågade sändnings-ID; det viktiga är att nuvarande need/action/reply inte återöppnar det.

## Mail wrapper

AI body ska inte äga greeting/signature. Regressionstestet för gamla `Hej!`-förväntningen är nu korrigerat.

Ändra inte Returns sender/Gmail-konfiguration i detta arbete. Returns-modulen äger mailtransporten.

---

# DEPLOY / RUNTIME-BILD SOM ÄR KÄND

Backend service:

`harmoniq-ai-arman-beta0`

Region:

`europe-north1`

Stable resolver tag som Returns-candidaten historiskt använder:

`resolver-ready-3298af83`

Den stable taggen ska bara flyttas efter full read-only PASS.

Returns-adminarkitekturen som byggts är:

`live admin UI -> resolver-specific Returns candidate -> private AI Arman stable tagged resolver`

Hela Returns write-ready candidate ska **inte** flyttas till 100% produktion bara för detta.

Normal positiv production traffic för AI-service ska förbli oförändrad vid resolver-retag.

---

# WORKFLOW-SPRAWL / ARCHITECTURE DEBT

Detta repo visar exakt problemet som `HARMONIQ ADVANCED MODULE BUILD CONTRACT v2` ska stoppa.

På foundation-branchen finns många historiska deploy/diagnostic workflows. Bland de senaste tillfälliga spåren finns:

- `.github/workflows/ai-arman-foundation-trusted-live-v3-20260822.yml`
- `.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

På `main` skapades under felsökningen dessutom:

- `.github/workflows/ai-arman-trusted-pr-target-live-20260822.yml` — första versionen var felaktig/ogiltig och ska inte betraktas som canonical.
- `.github/workflows/ai-arman-trusted-live-v2-20260822.yml` — tillfälligt spår, inte canonical.

På resolver-branchen finns också senaste deployexperiment.

**Nästa chat får inte lägga en ny workflow ovanpå detta.**

Efter att current gate är löst ska den göra en read-only workflow-inventering, välja:

- 1 canonical quality gate,
- 1 canonical resolver deployväg,
- 1 verifierbar production artifact chain,

och därefter ta bort eller tydligt pensionera de workflows som bevisligen är engångsdiagnostik/obsolete.

Radera inte historiska workflows blint innan source/runtime/deploy-kedjan är kartlagd.

---

# RISK

Högsta riskerna just nu är inte den nya reply-logiken utan arkitektur/process:

1. **Workflow proliferation** — ännu en v5 skulle förvärra problemet.
2. **Cross-branch deploy** — resolver source ligger på ops-branchen medan WIF-godkänd deploy hittills körs från foundation-branchen med frozen source SHA.
3. **Config inheritance** — ny Cloud Run revision kan ha ärvt current service template som inte är identisk med den proven stable tagged revisionen.
4. **False live claim** — candidate-deploy är inte samma sak som stable/live.
5. **Customer safety** — inget automatiserat test får skicka riktig kundmessage eller köra approved write.

---

# NÄSTA — EXAKT ORDNING

## 1. GATE 0 / Architecture restoration, read-only

Fortsätt från redan existerande v4-data. Skapa inte nytt spår.

Bevisa:

`resolver source 8ad1c47 -> image digest b8b9... -> Cloud Run revision resv4-8ad1c47e-2 -> candidate config -> stable tag -> Returns proxy -> live admin`

För current blocker: jämför read-only candidate revision och proven stable revision och identifiera **första exakta mismatch**.

V4-workflowfilen är:

`.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Om workflowen måste ändras för bättre diagnostik: **ändra denna fil in place**, skapa inte v5. Logga mismatch på variabelnamn utan att exponera secret-värden.

## 2. Root-cause fix

När första divergence är bevisad:

`expected vs actual -> root cause -> minsta patch -> regression/guard`

Om felet är config inheritance ska deploymenten göras deterministisk mot proven stable resolver config, inte genom att lägga ännu en candidatevariant ovanpå.

## 3. Återkör samma canonical candidate gate

Krav före retag:

- 107/107 suites green
- 646/646 eller fler tests green
- build green
- WIF green
- candidate private
- new revision 0% positive production traffic
- config parity green
- HQR-2494077 real read-only prepare green
- current need = resolved/no new action
- reply body återöppnar inte tracking/sändnings-ID/öppettider
- inga greeting/signature wrappers
- `approved:false` write blockeras
- ingen real approved write
- ingen customer message skickas
- warm prepare <= 12 s

Först därefter får existing stable resolver tag flyttas till proven revision.

## 4. Bevisa stable/live chain

Efter retag:

- positive production traffic oförändrad
- stable tagged URL oförändrad
- stable tag pekar på nya revisionen
- read-only prepare via stable URL PASS
- Returns resolver candidate når rätt AI stable tag
- live admin visar rätt beteende

Ingen real kundmessage behövs för verifiering.

## 5. Cleanup innan projektet kallas klart

När canonical production chain är bevisad:

- inventera workflows,
- behåll bara de som har permanent ansvar,
- ta bort/pensionera tillfälliga v2/v3/v4/diagnostic-spår som inte längre behövs,
- dokumentera canonical source branch/commit policy,
- dokumentera canonical quality gate,
- dokumentera canonical deployväg,
- dokumentera runtime artifact identity.

Målet är att nästa ändring inte ska behöva börja med samma arkeologi igen.

---

# SÄKERHETSBOUNDARY

Arman har godkänt att Stage 1-resolvern får byggas/deployas/verifieras.

Tillåtet utan nytt case-specifikt godkännande:

- kodändringar,
- tester,
- build,
- read-only real prepare,
- 0%-traffic candidate,
- denied-write-test med `approved:false`,
- latency measurement,
- safe retag efter full gate PASS,
- frontend-publicering utan kundwrite.

Inte tillåtet utan uttryckligt admin-godkännande för exakt case/action:

- skicka riktig kundmessage,
- pausa/klarmarkera riktigt case,
- ändra returstatus,
- ändra produktbeslut,
- skapa riktig retursedel,
- annan supported write.

Stage 2/autonomous send är av.

---

# ARBETSSTIL FÖR NÄSTA CHAT

Arman vill inte vara kodklistrare eller terminaloperatör.

Använd GitHub/GitHub Actions/connectors själv där det går.

När Arman skriver `kör` eller `kör nästa` betyder det att nästa chat ska fortsätta det redan låsta arbetet, verifiera current gate och utföra nästa säkra steg utan att fråga om sådant som redan är beslutat.

Rapportera kompakt med:

**MÅL**

**CURRENT GATE**

**BEVISAT**

**INTE BEVISAT**

**ÄNDRAT**

**RISK**

**NÄSTA**

---

# SLUTMÅL

Inte fler nästan-lösningar.

Inte fler deployspår.

Inte fler workflow-versioner för varje nytt hinder.

Slutmålet är:

> **en begriplig, testad och verifierad AI Arman resolver med en canonical source, en canonical quality gate, en canonical deployväg och en bevisad production artifact chain — där admin fortfarande godkänner varje riktig kundåtgärd.**
