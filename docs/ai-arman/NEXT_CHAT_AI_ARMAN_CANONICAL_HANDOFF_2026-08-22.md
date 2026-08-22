# NEXT CHAT HANDOFF — AI ARMAN RESOLVER / ADMIN

**Datum:** 2026-08-22

**Repo:** `arman573/harmoniq-backend`

**Risknivå:** LEVEL 3 — KRITISK / AVANCERAD

**Stående arbetsregel:** `HARMONIQ ADVANCED MODULE BUILD CONTRACT v2` + Harmoniq Development Operating System.

Detta dokument beskriver NUVARANDE verifierade läge. Skapa inte v5/v6, ny deploybranch eller parallell deployväg för resolver-arbetet.

---

# MÅL

AI Arman ska i Returns-admin arbeta enligt:

`verifierat ärende -> förstå senaste kundbehov -> föreslå lösning + kundsvar -> admin granskar -> admin godkänner -> exakt godkänd allowlistad action får verkställas`

Stage 1 är **approval required**. Stage 2/autonomt kundutskick är inte aktiverat och ska inte aktiveras i detta arbete.

Backend/systemintegrationer äger verifierbara fakta, policy, behörighet, execution plan och writes. AI får tolka och formulera men aldrig vara source of truth för pris, lager, INCI, orderstatus, tracking, returutfall eller behörighet.

---

# CURRENT GATE

**Architecture restoration / resolver deploy-gaten är PASS och stable resolver är live-verifierad.**

Nästa gate är **canonical consolidation / cleanup av äldre deploy- och diagnostic-spår**, utan att störa den verifierade runtimekedjan.

Ingen ny resolver-candidate behövs nu.

---

# IMPLEMENTERAT

Verifierad resolver-source:

`8ad1c47e31dfb82aef879f9cc63837fe1befe21a`

Viktiga skydd i implementationen:

- senaste kundmeddelandet väger tyngst för aktuellt behov,
- ett resolved case får inte återöppna gammalt tracking-/sändnings-ID-/öppettidsbehov,
- AI-brödtexten äger inte `Hej`/signatur; mailmotorn gör det,
- resolver `prepare` är read-only,
- `execute` kräver en namngiven allowlistad action och explicit `approved:true`,
- verifierad backend/Returns äger real writes,
- browser/model-fakta får inte ersätta auktoritativa case-/orderfakta.

Canonical admin path enligt PR #18:

`admin intent -> deterministic policy/resolver -> named typed action -> ReturnsAdminGatewayClient -> private Returns full-admin gateway -> existing Returns admin route/domain logic -> read-back`

---

# ROOT CAUSE SOM HITTADES

Första exakta divergence mellan tidigare proven stable revision och 0%-candidaten var ENDAST:

`AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN`

Read-only diagnosrun:

`32573429767`

Den visade:

- stable revision: `harmoniq-ai-arman-beta0-resolverready-3298af83-1`
- failed candidate: `harmoniq-ai-arman-beta0-resv4-8ad1c47e-2`
- candidate positive traffic: `0`
- secret values loggades inte
- alla andra jämförda resolver/gateway/model-envs hade parity

Root-cause-klassen var **runtime/config inheritance**, inte domain/app code.

Minsta patch gjordes i SAMMA canonical v4-workflow: candidate-deployen kopierar den verifierade stable resolver-tokenen via `--update-env-vars`, efter att värdet hämtats från stable revision, maskerats och validerats non-empty. Parity-gaten loggar endast variabelnamn vid framtida mismatch, aldrig secret-värden.

Root-cause/deploy-trigger commit på `feature/ai-arman-foundation-v1`:

`5fb92211b33f11870d53a4629e1dc9c9e41878c4`

---

# TESTAT

Canonical deploy/verify run:

`32573522384`

Job:

`97032398154`

På exakt source `8ad1c47e31dfb82aef879f9cc63837fe1befe21a`:

- **107/107 test suites PASS**
- **646/646 tests PASS**
- `npm run build` PASS
- candidate Docker build PASS
- npm audit: 0 vulnerabilities
- WIF auth PASS
- stable snapshot/safety checks PASS
- candidate config parity PASS
- HQR-2494077 read-only prepare PASS
- `approved:false` execute blockerades
- ingen real approved write kördes
- inget kundmail skickades

Latens:

- candidate cold prepare: `7.598709s`
- candidate warm prepare: `4.427432s`
- stable tagged prepare: `5.730802s`

---

# DEPLOYAT / ARTIFACT PROVENANCE

Verifierad kedja:

`source 8ad1c47e31dfb82aef879f9cc63837fe1befe21a`

-> Artifact Registry image digest

`sha256:c30f9fff998c81a5e23844b3ea19a63b1cb5fa48f5bdc83700f6373ec6c70f56`

-> Cloud Run revision

`harmoniq-ai-arman-beta0-resv4-8ad1c47e-5`

-> stable resolver tag

`resolver-ready-3298af83`

Canonical service:

`harmoniq-ai-arman-beta0`

Region:

`europe-north1`

Stable resolver URL:

`https://resolver-ready-3298af83---harmoniq-ai-arman-beta0-cw6q5ekseq-lz.a.run.app`

---

# LIVE VERIFIERAT

PASS checkpoint:

`docs/ai-arman/AI_ARMAN_FOUNDATION_TRUSTED_LIVE_V4_20260822.md`

Checkpoint commit från workflow:

`6f749ec36741c80a421c688fdd4e1e570bf3025d`

Verifierat efter stable-retag:

- stable-taggen pekar på `harmoniq-ai-arman-beta0-resv4-8ad1c47e-5`,
- stable URL är oförändrad,
- read-only prepare via stable URL PASS,
- HQR-2494077 återöppnar inte gammalt trackingbehov,
- legacy greeting/signature i AI-body = false,
- execute utan godkännande = blocked,
- real write executed = false,
- customer message sent = false.

VIKTIGT: resolver-stable är avsiktligt en **taggad 0%-revision**. Vanlig positiv service-trafik ändrades inte av retaggen och ligger fortsatt 100% på:

`harmoniq-ai-arman-beta0-retadminv2-1`

Candidate/stable-tagged resolver = 0% normal traffic är alltså inte ett fel.

---

# CANONICAL DEPLOYVÄG NU

Aktiv workflowfil:

`.github/workflows/ai-arman-foundation-trusted-live-v4-20260822.yml`

Aktiv deploybranch för WIF/canonical resolver gate:

`feature/ai-arman-foundation-v1`

Workflowen verifierar i samma kedja:

`exact frozen source -> tests/build/container -> WIF -> stable snapshot -> immutable Artifact Registry image -> private zero-traffic candidate -> config parity -> HQR read-only probe -> denied write -> stable retag -> stable tagged probe -> PASS checkpoint`

Stable-taggen flyttas först efter read-only PASS. Positive production traffic jämförs före/efter och måste vara identisk.

Root-cause-fixen och parity-gaten ska behållas.

---

# CLEANUP SOM REDAN ÄR GJORD

Tillfällig read-only parity-diagnos användes endast för att hitta första divergence och är nu bortstädad ur current repo-state.

På `feature/ai-arman-foundation-v1`:

- commit `29dfa059e57b3d2669c1091277073db6f706c573` tog bort temporary diagnostic-jobbet ur v4-workflowet,
- commit `ba4906c1af068c6ff14fcb9289d355484893edb4` tog bort `docs/ai-arman/AI_ARMAN_FOUNDATION_V4_CONFIG_DIAG_20260822.md` ur branchens aktuella träd,
- permanent root-cause-fix och permanent config-parity-gate finns kvar,
- PASS-checkpointen är fortfarande intakt.

Skapa inte om diagnosjobbet om inte en ny, verklig mismatch kräver det.

---

# INTE BEVISAT / FÅR INTE ANTAS

Följande ligger utanför den resolver-live-verifiering som nu är klar:

- att `main` är production source of truth för AI Arman,
- att alla äldre AI Arman workflows är safe att radera,
- att PR #21 kan stängas eller mergas utan separat provenance/mergebedömning,
- att Returns/Vendre-admins hela UI-kedja ska flyttas till någon annan 100%-revision,
- att Cloudflare Pages senaste prefetch-kod är publicerad,
- att en approved real write behöver köras för resolververifieringen.

Gissa inte på dessa. Gör read-only inventering först.

---

# ROLLBACK / RECOVERY

Resolver-retaggen ändrade inte normal positiv service-trafik.

Känd previous stable revision är:

`harmoniq-ai-arman-beta0-resolverready-3298af83-1`

Om rollback blir nödvändig ska samma canonical traffic-tag-mekanism användas för att peka `resolver-ready-3298af83` tillbaka till den revisionen, och positive production traffic ska verifieras oförändrad före/efter. Kör inte rollback utan ett verkligt fel.

---

# NÄSTA — EXAKT ORDNING

1. Börja read-only med workflow-/branch-/PR-inventering.
2. Bevisa vilka äldre AI Arman deploy/diagnostic workflows som är engångsspår och vilka som fortfarande har permanent ansvar.
3. Konsolidera mot minsta robusta canonical uppsättning: en quality gate, en resolver deployväg, en verifierbar artifact/prod-kedja.
4. Radera/pensionera endast spår som är bevisligen obsolete. Rör inte den verifierade v4-gaten eller stable runtimekedjan medan detta görs.
5. Bedöm därefter PR #21 och branch `ops/ai-arman-resolver-candidate-20260820` mot PR #18 / `feature/ai-arman-foundation-v1`; merge/close först när source provenance och målbranch är tydliga.
6. Om något nytt fel hittas: EXPECTED vs ACTUAL -> första divergence -> root cause. Ingen v5/v6.

---

# DEFINITION OF DONE FÖR NÄSTA FAS

Resolver-funktionen är nu implementerad, testad, deployad och stable-tagged live-verifierad. Nästa fas är inte ny resolverfunktionalitet utan arkitekturstädning.

Den fasen är klar när current workflows/branches/PR:er speglar den verifierade canonical kedjan, obsolete diagnostik/deployspår är borta eller uttryckligen pensionerade, rollback är dokumenterad och ingen parallel deployväg behövs för normal fortsatt utveckling.
