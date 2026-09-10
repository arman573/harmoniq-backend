# AI Arman – canonical project handoff

Status: aktiv canonical continuation state
Datum: 2026-09-10
Primärt repo: `arman573/harmoniq-backend`
Default branch: `main`
Aktiv branch: `feature/ai-arman-foundation-v1`
Relevant draft-PR: `#18`

## 1. SOURCE OF TRUTH OCH ARBETSSÄTT

Den här filen är senaste canonical continuation state för AI Arman-delen av HARMONIQ Retur & reklamationsmodul.

Vid nästa fortsättning gäller:

1. verifierad verklig repo/runtime-state vinner alltid över denna handoff om något har ändrats efter handoffens commit,
2. börja inte om från projektets historik,
3. återupptäck inte redan bevisade saker utan konkret anledning,
4. skapa inte nya branches, workflows, diagnostics, v2/v3/v4/v5/v6-spår eller parallella deployvägar för att komma runt ett problem,
5. fortsätt från CURRENT GATE + EXACT NEXT ACTION + CURRENT CHANGE BUDGET,
6. produktion, orderdata, Vendre, nShift, kundmeddelanden och andra externa writes får inte ändras som bieffekt av en read-only gate,
7. tracking eller shipment får aldrig gissas.

Primär teknisk princip:

```text
AI tolkar.
Backend beslutar.
Backend äger fakta.
Backend validerar verktygsval.
Backend utför endast uttryckligen tillåtna åtgärder.
```

## 2. EXACT FINAL GOAL

Det övergripande målet är en kundsynlig svensk AI Arman på Harmoniq.se som kan förstå naturlig fritext före och efter köp och använda verifierade backendfakta.

AI Arman ska på sikt kunna:

- förstå kundens avsikt och konversation,
- ge verifierade produktrekommendationer,
- svara om köpta produkter och användning utifrån auktoritativ produktdata,
- läsa verifierad orderstatus och tracking,
- förstå retur- och reklamationsfrågor,
- länka eller lämna över till rätt befintligt flöde,
- lämna över till mänsklig kundservice med kontext när det behövs.

Språkmodellen får aldrig hitta på produktfakta, pris, lager, orderstatus, tracking, returstatus eller reklamationsbeslut.

### Current exact tracking goal

För order- och trackingfrågor är canonical ordning nu:

```text
verifierad kund/order
→ exakt Vendre-order
→ Vendre orderstatus
→ tracking/parcel från samma Vendre-order
→ endast om Vendre saknar verifierad tracking: befintlig customer-tracking/nShift-fallback
```

Om Vendre-order exempelvis har status `Skickad` och redan innehåller parcel-/trackingnummer eller en verifierbar tracking-URL ska detta användas direkt. AI Arman ska då inte försöka välja eller gissa en nShift-shipment.

## 3. PROJECT SCOPE

Current scope omfattar AI Armans verifierade read-only order/tracking-kedja och dess integration mot befintliga HARMONIQ-källor.

In-scope i current gate:

- exakt Vendre-orderläsning,
- namngiven Vendre-orderstatus,
- trackingnummer, tracking-URL och shipment status från Vendre,
- säkra trackingaliases och nested Vendre-strukturer,
- verifierad kund-/orderbinding innan order eller tracking läses,
- customer-tracking/nShift som fallback först efter Vendre,
- source tests/build/container-smoke,
- zero-traffic runtime proof mot verklig order `2491750`.

Out-of-scope för current gate:

- Vendre-writes,
- orderändringar,
- retursedelsskapande,
- nShift-writes,
- refund/replacement/goodwill,
- kundmeddelanden,
- OTP-utskick,
- produktionstrafikcutover,
- nya deployarkitekturer,
- unrelated Returns UI-förändringar.

## 4. ACCEPTANCE CRITERIA – CURRENT TRACKING SLICE

Current tracking slice är DONE först när följande är bevisat:

1. Exakt Vendre-order läses efter verifierad kund/order-access.
2. Namngiven orderstatus kan projiceras från Vendre, inklusive `status_name`, `orders_status_name`, `status` och relevant fallback.
3. Vendre tracking projiceras säkert från godkända fält.
4. Direkta trackingaliases stöds, bland annat `trackingNumber`, `tracking_number`, `parcelNo`, `parcel_no`, `parcelNumber`, `parcel_number`, `consignmentNumber`, `consignment_number` och `waybill`.
5. Tracking kan läsas från relevanta nested objekt under `shipment`, `shipping`, `delivery`, `info` och deras `tracking`-objekt.
6. HTTPS tracking-URL kan användas och känt trackingnummer kan extraheras från kända query-parametrar när explicit nummer saknas.
7. Explicit trackingnummer vinner över URL-deriverat nummer.
8. Osäkra tracking-URL:er exponeras inte.
9. Om Vendre har tracking ska customer-tracking/nShift inte anropas.
10. Om Vendre saknar tracking eller Vendre-read är otillgänglig får den etablerade tracking-fallbacken användas.
11. Ingen fallback får välja en shipment på osäker korrelation.
12. Source unit tests, TypeScript build och isolerade containersmokes ska vara gröna.
13. En zero-traffic/current-runtime kandidat ska därefter bevisa beteendet mot verklig order `2491750` read-only.
14. Produktion ska vara orörd fram till separat godkänd promotion gate.

## 5. NO-TOUCH BEHAVIOR

Följande ska förbli orört i current gate:

- ingen positiv production traffic flyttas,
- ingen stable-tag retargetas som bieffekt av en kandidatkontroll,
- inga Vendre-writes,
- inga orderstatusändringar,
- inga nShift-writes eller shipment-skapanden,
- inga kundmeddelanden eller OTP,
- inga refunds, replacements eller goodwill-beslut,
- inga nya branches,
- inga nya workflows,
- inga nya diagnostics eller parallella deployspår,
- inga unrelated Returns-module changes,
- inga gissade trackingnummer eller shipments.

## 6. VERIFIED REPO STATE – 2026-09-10

### AI Arman

Repo:
`arman573/harmoniq-backend`

Default branch:
`main`

Aktiv canonical branch:
`feature/ai-arman-foundation-v1`

Relevant PR:
`#18`, open draft.

### Current application/source SHA

Senaste verifierade application SHA för tracking-fixen är:

```text
45f14285b503a4651864c82cfba8bc99e90ec3c7
```

Detta är application/source SHA och ska skiljas från senare docs-only handoff commit SHA.

## 7. ROOT CAUSE SOM ÄR BEVISAD

Tidigare tracking-intent gick efter verifiering direkt till `VerifiedTrackingReadService`, som i sin tur gick direkt mot den separata `TrackingReadClient` / customer-tracking-källan.

Samtidigt användes Vendre separat för orderstatus via `VerifiedOrderReadService` och `VendreOrderReadClient`.

Det gav fel precedence för slutmålet:

```text
tracking-fråga → customer-tracking/nShift först
```

Canonical precedence ska vara:

```text
tracking-fråga
→ verifierad identity/order binding
→ exakt Vendre getOrder(orderId)
→ Vendre tracking om den finns
→ annars befintlig tracking fallback
```

Detta är nu implementerat i source.

## 8. IMPLEMENTATION SOM NU FINNS I SOURCE

### `src/ai-arman/integrations/vendre-order-read.types.ts`

`SafeVendreOrderRead` bär nu även:

- `trackingNumber`
- `trackingUrl`
- `shipmentStatus`

### `src/ai-arman/integrations/vendre-order-status.projection.ts`

Vendre-projektionen normaliserar nu status och tracking med bounded whitelist.

Status läses från bland annat:

- `status_name`
- `orders_status_name`
- `status`
- `status_text`

Trackingkällor omfattar root-order samt relevanta nested strukturer:

- `shipment`
- `shipping`
- `delivery`
- `info`
- respektive `.tracking`
- direkt `order.tracking`

Trackingnummeraliases omfattar:

- `trackingNumber`
- `tracking_number`
- `parcelNo`
- `parcel_no`
- `parcelNumber`
- `parcel_number`
- `consignmentNumber`
- `consignment_number`
- `waybill`

Tracking-URL aliases omfattar bland annat:

- `trackingUrl`
- `tracking_url`
- `trackingURL`
- `parcelUrl`
- `parcel_url`

Generiskt `url` accepteras endast i ett tracking-subobjekt.

Shipment status aliases omfattar bland annat:

- `shipmentStatus`
- `shipment_status`
- `deliveryStatus`
- `delivery_status`
- `trackingStatus`
- `tracking_status`

Trackingnummer kan dessutom extraheras ur kända URL-queryparametrar, bland annat:

- `refNumber`
- `trackingNumber`
- `tracking_number`
- `parcelNo`
- `parcel_no`
- `consignmentNumber`
- `consignment_number`
- `shipmentId`
- `shipment_id`

Endast HTTPS-URL utan credentials exponeras. Explicit trackingnummer har precedence framför URL-deriverat nummer.

### `src/ai-arman/integrations/verified-tracking-read.service.ts`

Efter befintlig conversation/customer/order-verifiering gör tjänsten nu:

```text
VendreOrderReadClient.getOrder(orderId)
→ om Vendre ger tracking: returnera denna
→ annars TrackingReadClient.getTracking(orderId)
```

Detta centraliserar precedence utan att duplicera identitetsverifieringen i chat-orchestratorn.

### Regressionstester

Tester täcker nu bland annat:

- Vendre trackingnummer stoppar fallback-anrop,
- Vendre utan tracking använder fallback,
- Vendre read unavailable använder etablerad fallback,
- verifieringsfel stoppar både Vendre och fallback före externa reads,
- nested tracking aliases,
- `orders_status_name: Skickad`,
- explicit parcelnummer framför URL-derived,
- blockerad osäker URL,
- befintlig dispatch classification.

## 9. SOURCE CI – GREEN

För application SHA:

```text
45f14285b503a4651864c82cfba8bc99e90ec3c7
```

Canonical Foundation CI:

```text
GitHub Actions run: 34477571628
status: completed
conclusion: success
```

Bevisat PASS i samma run:

- checkout source,
- dependency install,
- unit tests,
- TypeScript build,
- build AI Arman isolated container,
- smoke AI Arman container,
- build customer gateway isolated container,
- smoke customer gateway container.

En tidigare run på SHA `1d2eb2479c74e8007032b519d13ce179b49b4bfd` föll därför att `vendre-order-read.client.spec.ts` fortfarande förväntade gamla projection shape. Testkontraktet uppdaterades; senaste application SHA ovan är green source of truth.

## 10. RELEVANT RETURNS-MODULE PROVENANCE

Rätt Returns-repo är:

`arman573/harmoniq-returns-module`

Ingen Returns-kod ändrades i denna gate.

Historisk verifierad relevant kod visar:

### `server/src/services/adminOrderContextEnricher.js`

Den läser exakt Vendre-order med `client.getOrder(orderId)`, normaliserar ordern och exponerar bland annat `orderStatus`.

### `server/src/services/vendreOrderMapper.js`

Den namngivna Vendre-statusen normaliserades som:

```text
status_name → orders_status_name → status
```

Detta är provenance för att den Vendre-status som användaren ser, exempelvis `Skickad`, kan komma från exakt Vendre-orderdata.

Samma äldre mapper bar inte igenom tracking, vilket var en del av problemet.

### Historical fallback

Äldre `customerTrackingLookupService.js` på `refactor/cluster-architecture-foundation` läste den separata customer-tracking-tjänsten med retry/cache och parcel/tracking-normalisering.

Denna väg är relevant som etablerad fallback, inte som primär trackingkälla.

Ett äldre workflow för order `2494077` bevisade historiskt att Returns `/api/admin/cases/:caseId/order-context` kunde ge exakt parcelnummer från trackingkedjan. Detta är endast provenance och ska inte behandlas som current runtime state.

## 11. ORDER 2491750 – PROVEN / UNPROVEN

För order `2491750` gäller fortfarande:

### Proven

- exact Vendre-order-read är den korrekta primära arkitekturvägen,
- source kan nu bära namngiven status och Vendre tracking,
- source-precedence Vendre-first är implementerad och testad,
- source CI är grön.

### Unproven

Följande är ännu inte runtime-bevisat för `2491750` på den nya application SHA:n:

- exakt aktuell Vendre-status,
- om raw Vendre-order faktiskt innehåller trackingnummer,
- vilket Vendre-fält/nested path som i så fall innehåller numret,
- om Vendre endast innehåller tracking-URL,
- om URL-derived tracking krävs,
- om Vendre saknar tracking och fallback därför måste användas,
- exakt kandidatbeteende i current runtime.

Därför får inget trackingnummer eller shipment anges som fakta för `2491750` förrän runtime-read bevisat det.

## 12. PRODUCTION / RUNTIME STATE

Ingen produktion ändrades i denna 2026-09-10 tracking-gate.

Det har inte gjorts:

- production traffic cutover,
- stable-tag retarget,
- Vendre write,
- nShift write,
- customer message,
- OTP,
- order/case mutation.

Current application SHA `45f14285...` är source-green men är ännu inte bevisad som zero-traffic runtime candidate mot `2491750`.

Senaste exakta Cloud Run live revision/image/positive-traffic för Sep-10 har inte färskbevisats i denna gate via en säker current-runtime inspection och ska därför inte ersättas med gamla snapshots. Historiska revisions- eller deployfiler är provenance, inte current truth.

## 13. DEPLOYMENT PATH STATE

Befintliga workflows har inspekterats read-only.

### `ai-arman-beta0-candidate-deploy.yml`

Finns, men är pinned till en äldre deploy-SHA och exact commit-message-trigger. Den är därför inte direkt en verifierad current-SHA kandidatväg utan modifiering.

### `ai-arman-foundation-trusted-live-v4-20260822.yml`

Finns, men är pinned till en äldre `SOURCE_SHA` och utför dessutom stable resolver retag efter PASS.

Den får därför inte användas för att kringgå current gate, eftersom current gate kräver zero-traffic/read-only runtime proof utan att stable/positive traffic ändras.

Ingen ny workflow skapades för att komma runt detta.

## 14. CURRENT GATE

```text
RUNTIME PROVENANCE / ZERO-TRAFFIC VENDRE-FIRST TRACKING PROOF FOR ORDER 2491750
```

Source implementation gate är GREEN.

Current gate är nu runtime/deploy provenance, inte mer featurekod.

## 15. CURRENT BLOCKER

Vi har ännu inte verifierat en befintlig canonical deploymentmekanism som kan köra application SHA:

```text
45f14285b503a4651864c82cfba8bc99e90ec3c7
```

som en ren zero-traffic kandidat utan att:

- ändra positive production traffic,
- retargeta stable tag,
- skapa ny workflow,
- skapa ny branch,
- eller ta en parallell deployväg.

Dessutom finns ingen direkt Vendre API-connector i chatverktygen som kan användas istället för runtimekedjan.

Detta är ett deployment-path/provenance-blocker, inte ett skäl att gissa tracking eller börja om arkitekturen.

## 16. EXACT NEXT ACTION

Nästa chat ska börja här:

1. Read-only verifiera att repo/branch/PR fortfarande är samma och att application SHA `45f14285...` fortfarande är den senaste green tracking-source SHA:n, bortsett från docs-only handoff commit.
2. Read-only verifiera current Cloud Run service state för AI Arman och relevant Returns runtime genom den etablerade GCP/WIF-vägen om den kan nås utan ny diagnostic/workflow.
3. Kontrollera om någon redan etablerad canonical workflow/deploymekanism kan deploya exakt `45f14285...` som zero-traffic current candidate utan stable-tag eller positive-traffic mutation.
4. Om en sådan befintlig väg finns: använd den och bevisa kandidaten read-only.
5. Om ingen sådan väg finns: ändra endast den redan canonical deploymekanismen inom en minimal change budget så att den kan targeta current application SHA utan promotion/stable retag. Skapa inte en ny workflow. Gör inte detta som workaround om det kräver bredare deployarkitektur.
6. När kandidaten finns: verifiera config/identity/order binding och kör read-only runtime proof för order `2491750`.
7. Logga endast safe projected facts: Vendre status, tracking presence, tracking source class och om fallback användes. Exponera inte känslig rå orderdata i docs/loggar.
8. Om Vendre har tracking: bevisa att fallback inte anropas.
9. Om Vendre saknar tracking: tillåt befintlig fallback, men acceptera endast tracking som kan bindas säkert till exakt order. Gissa aldrig en nShift-shipment.
10. Först när detta är PASS får nästa promotion/production gate övervägas som en separat explicit gate.

## 17. CURRENT CHANGE BUDGET

Source featureändringen är nu färdig och green.

Tillåten nästa change budget:

- read-only runtime/deploy provenance,
- vid konkret blocker: minimal ändring i redan etablerad canonical deploymekanism för current SHA + zero-traffic only,
- runtime probe mot `2491750`,
- test-/docsjustering endast om runtime bevisar ett konkret fel i nuvarande implementation.

Inte tillåtet inom current budget:

- nya workflows,
- nya branches,
- parallell deployarkitektur,
- bred refactor,
- nya featureområden,
- production promotion innan current gate är PASS.

## 18. ROADMAP FRÅN CURRENT STATE TILL DONE

### Gate A – Source Vendre-first tracking

Status: **PASS**.

Bevis:
- implementation finns,
- precedence testad,
- source CI run `34477571628` är green.

### Gate B – Current runtime provenance / zero-traffic 2491750

Status: **CURRENT**.

Mål:
- current application SHA i zero-traffic candidate,
- Vendre status/tracking bevisad på verklig order,
- fallback precedence bevisad i runtime,
- produktion helt oförändrad.

### Gate C – Promotion decision

Status: **NOT STARTED**.

Endast efter Gate B PASS.

Kräver separat kontroll av:
- candidate/live diff,
- auth/safety invariants,
- traffic state,
- rollbackväg,
- no-touch områden,
- explicit promotionbeslut.

### Gate D – Broader Beta 1 continuation

Efter stabil order/tracking slice fortsätter bredare AI Arman-roadmap med verifierad produktintelligens, köpt-produkt-användning, retur/reklamation support, widget och mänsklig handoff enligt samma backend-authority-princip.

## 19. CLEANUP / CURRENT DONE STATUS

Gjort i denna gate:

- root cause identifierad,
- Vendre-first precedence implementerad,
- Vendre trackingprojection implementerad,
- nested aliases och URL-extraction implementerad,
- tests uppdaterade,
- stale testkontrakt fixat,
- senaste application SHA source-green,
- inga nya branches skapade,
- inga nya workflows skapade,
- inga production writes utförda,
- inga trackingnummer gissade.

Återstår innan tracking-slicen är DONE:

- current runtime/candidate proof mot `2491750`,
- därefter separat promotionbeslut om allt är grönt.

## 20. IMPORTANT SHA SEPARATION

Application/source SHA för den green trackingimplementationen:

```text
45f14285b503a4651864c82cfba8bc99e90ec3c7
```

Handoff commit SHA är den docs-only commit som skapas när denna fil sparas och ska rapporteras separat.

En senare docs-only handoff commit får inte felaktigt kallas application/candidate SHA.
