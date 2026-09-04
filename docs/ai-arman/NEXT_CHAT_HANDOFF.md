# AI Arman – komplett nästa-chat-handoff

Status: planering och genomförandeunderlag
Datum: 2026-08-06
Primärt repo: `arman573/harmoniq-backend`
Primär gren: `feature/ai-arman-foundation-v1`
Primär draft-PR: `#18`

## 1. Läs detta först i nästa chatt

Läs filerna i denna ordning innan någon ändring görs:

1. `docs/ai-arman/NEXT_CHAT_HANDOFF.md`
2. `docs/ai-arman/PRODUCT_VISION.md`
3. `docs/ai-arman/RECOMMENDATION_CONTRACT.md`
4. `docs/ai-arman/PRODUCT_INTELLIGENCE_CONTRACT_V1.md`
5. `docs/ai-arman/PERMISSION_MATRIX.md`
6. `docs/ai-arman/TOOL_REGISTRY.md`

Läs därefter relevant kod i `harmoniq-backend` och den separata Product Intelligence-grenen innan implementation.

Viktiga externa källor inom samma projekt:

- `arman573/harmoniq-backend` PR `#12` – sammanslagen kundchattkärna.
- `arman573/harmoniq-backend` PR `#18` – öppen draft för AI Arman foundation.
- `arman573/harmoniq-product-data-pipeline` PR `#25` – öppen draft för read-only Product Intelligence v1.

## 2. Absolut arbetssätt

Arman ska inte agera kodklistrare.

Allt som är tekniskt möjligt ska utföras av ChatGPT direkt i GitHub:

- läsa befintlig kod och dokumentation;
- skapa och uppdatera filer;
- göra små kontrollerade kodändringar;
- skriva tester;
- köra GitHub Actions;
- läsa testresultat och loggar;
- rätta fel;
- uppdatera PR-beskrivningar och dokumentation;
- verifiera att branch, commit och diff är korrekta.

Ge endast en uppgift till Arman när den är helt omöjlig att utföra med tillgängliga verktyg och åtkomster. Exempel kan vara:

- visuell kontroll i en inloggad Vendre-admin som inte kan nås via verktyg;
- manuell inställning som kräver ägarbehörighet i ett externt konto;
- uttryckligt säkerhetsgodkännande inför en produktionsåtgärd;
- en faktisk kundupplevelsekontroll på en privat testsida som inte kan öppnas av verktygen.

När Arman måste göra något ska uppgiften vara liten, exakt och förklarad. Han ska aldrig få stora kodblock att klistra in manuellt.

## 3. Tydligt slutmål

Slutmålet är en riktig kundsynlig svensk fritextbot på Harmoniq.se.

Kunden ska kunna skriva naturligt, exempelvis:

- `Jag har tunt och färgat hår som blir fett snabbt men torra längder. Vilket schampo passar?`
- `Jag köpte Olaplex No.4. Kan jag använda det varje dag?`
- `Varför har mitt paket inte kommit?`
- `Jag fick fel produkt. Vad gör jag?`

AI Arman ska:

1. förstå kundens avsikt och sammanhang;
2. komma ihåg tidigare svar i samma konversation;
3. ställa relevanta följdfrågor;
4. välja rätt backendverktyg;
5. hämta verifierade produkt-, order-, tracking- eller ärendefakta;
6. svara naturligt och tydligt på svenska;
7. visa strukturerade produkt-, order- eller supportkort;
8. lämna över till mänsklig kundservice med bevarad kontext när det behövs.

Grundprincipen är fortsatt:

```text
AI tolkar.
Backend beslutar.
Backend äger fakta.
Backend validerar verktygsval.
Backend utför endast uttryckligen tillåtna åtgärder.
```

Språkmodellen får aldrig själv hitta på produktfakta, INCI, pris, lager, orderstatus, tracking, returstatus eller reklamationsbeslut.

## 4. Lanseringsstrategi

Hela slutprodukten behöver inte bli färdig före första lansering.

AI Arman ska lanseras del för del:

1. intern fritextprototyp;
2. begränsad privat beta;
3. liten publik Beta 1;
4. fler kategorier och fler read-only-funktioner;
5. kontrollerade skrivfunktioner först efter separat säkerhetsmodell och godkännande.

Vi ska inte vänta på full personalisering, alla kategorier, automatisk returhantering eller full kundserviceautomation innan en första användbar version testas.

## 5. Målbild för Beta 1

Beta 1 ska vara en verklig bot, inte ett formulär med förklädda knappar.

Fritextfältet ska alltid fungera. Snabbval får finnas som hjälp men ska inte vara ett krav.

Widgetens start kan erbjuda tre genvägar:

1. `Hjälp mig välja produkt`
2. `Var är min beställning?`
3. `Hjälp med en produkt jag köpt`

Kunden ska även kunna ignorera genvägarna och skriva direkt.

### 5.1 Före köp i Beta 1

Första rekommendationsområdet bör vara hårvård:

- schampo;
- balsam;
- hårinpackning;
- leave-in.

Flödet ska:

1. tolka kundens fritext till en validerad behovsprofil;
2. ställa högst nödvändiga följdfrågor;
3. hämta produktkandidater;
4. skicka kandidaterna till Product Intelligence;
5. blockera produkter som saknar data eller inte klarar kvalitetsgrindarna;
6. visa högst tre verkligt godkända alternativ;
7. visa färre eller inga produkter om kvaliteten inte räcker.

Varje produktkort ska kunna visa:

- produktbild;
- produktnamn;
- varför produkten passar;
- relevanta INCI-signaler;
- behov produkten adresserar;
- begränsningar och kompromisser;
- verifierad användning;
- pris och lager först när de hämtats från auktoritativ källa;
- länk till produktsidan.

Beta 1 behöver inte lägga produkter direkt i varukorgen.

### 5.2 Efter köp i Beta 1

Efterköp är en huvuddel, inte en senare sidofunktion.

Beta 1 ska stegvis kunna:

- förstå order-, leverans-, retur-, reklamations- och produktanvändningsfrågor;
- läsa order och tracking read-only efter säker identifiering;
- visa produkter från en verifierad order;
- svara om användning och kombination av en köpt produkt utifrån verifierad produktdata;
- upptäcka reaktions- och säkerhetsfrågor;
- länka till rätt befintligt retur- eller reklamationsflöde;
- lämna över till kundservice med konversationens sammanhang.

Beta 1 ska inte:

- ändra order;
- byta adress;
- avbryta order;
- godkänna reklamation;
- skapa återbetalning;
- göra pris- eller lagerändringar;
- skriva fritt till Vendre;
- ge medicinsk diagnos.

## 6. Widgetens målbild

Widgeten ska kännas som en kunnig Harmoniq-rådgivare, inte som en generisk AI-demo.

### 6.1 Stängd widget

Tydlig knapp nere till höger:

```text
Fråga AI Arman
```

Inte endast en anonym pratbubbla.

### 6.2 Öppen desktop-widget

Ungefär 390–420 px bred och 650–700 px hög.

Den ska innehålla:

- rubrik `AI Arman`;
- text `Produkt- och orderhjälp`;
- liten Beta-markering;
- konversationsyta;
- fritextfält fast längst ned;
- frivilliga snabbval;
- tydlig möjlighet att börja om, gå tillbaka och få mänsklig hjälp.

### 6.3 Mobil

På mobil ska widgeten öppnas nära helskärm med:

- fast rubrik;
- meddelanden i mitten;
- fast skrivfält längst ned;
- tydlig stäng- och bakåtknapp;
- produktkort som fungerar utan horisontell layoutskada.

### 6.4 Strukturerade svarsblock

Backend bör kunna returnera bland annat:

```text
message
question
quick_replies
product_cards
order_status_card
tracking_card
purchased_product_card
safety_notice
support_handoff
error_notice
```

Widgeten ska rendera dessa typer. Den ska inte behöva tolka fri HTML från modellen.

## 7. Vad som redan fungerar

### 7.1 Product Intelligence

Repo: `arman573/harmoniq-product-data-pipeline`
Gren: `sync/ai-arman-product-intelligence-v1`
Draft-PR: `#25`
Aktuellt dokumenterat head vid denna handoff:

```text
d274a47cab5ad5d63d16cb2fd5fb27c15da8e4cb
```

Det finns nu en fungerande read-only Product Intelligence-grund som kan:

- ta emot kundbehov och produkter;
- validera produktkatalogen;
- analysera produktbenämning;
- bevara och analysera original-INCI;
- bedöma kategori och taggar;
- skapa explicita blockerare;
- returnera strukturerad evidens, begränsningar, användning och confidence;
- faila stängt när produkt eller obligatorisk evidens saknas.

Endpointkontrakt:

```http
POST /v1/ai-arman/product-intelligence/evaluate-batch
```

Deterministisk katalogbyggare finns med stabil serialisering, SHA-256 och content-addressed objektnamn.

GitHub-validering på ovanstående head är grön för:

- CI;
- resurskontrakt;
- immutable candidate image;
- dependency audit;
- candidate resource details;
- GCP preflight;
- catalog artifact.

Allt detta är fortfarande draft och read-only. Ingen Cloud Run-tjänst har skapats, ingen katalog har laddats upp till GCS och ingen trafik har ändrats.

### 7.2 AI Arman foundation i `harmoniq-backend`

PR `#18` innehåller:

- NestJS-modul för AI Arman;
- deterministisk rekommendationsscoring;
- produktupptäckt via Search Brain-klient;
- klient mot Product Intelligence;
- timeout och kontraktskontroll;
- enrichment av produktkandidater;
- blockerare och fail-closed-beteende;
- chat-preview;
- grundstruktur för produktkort;
- kontrakt och säkerhetsdokumentation.

`ProductIntelligenceClient` är en särskilt användbar del och bör återanvändas. Den anropar rätt endpoint, begränsar antal produkter, har timeout och avvisar fel kontraktsversion.

### 7.3 Kundchattkärnan

PR `#12` i `harmoniq-backend` är sammanslagen till grenen `feature/auto-customer-facts`, inte direkt till `main`.

Den innehåller återanvändbara byggblock för:

- konversationer;
- meddelanden;
- historik;
- kund- och adminvyer;
- intentklassning;
- policy och säkerhetsgränser;
- frustration och eskalering;
- interna anteckningar;
- mänskliga svar;
- notifieringshakar och event;
- admininkorg;
- mätvärden;
- supportöverlämning.

Kod ska hämtas selektivt. Hela grenen eller PR:n ska inte mergas blint.

## 8. Vad som inte är färdigt eller inte fungerar som slutprodukt

### 8.1 Ingen verklig fritextbot ännu

Nuvarande `chat/preview` är inte den bot Arman vill lansera.

Den:

- kräver att produktkandidater redan skickas in;
- förväntar sig färdiga poäng och evidens;
- använder huvudsakligen deterministisk, mallad svarskomposition;
- håller inte en full naturlig dialog;
- extraherar inte robust behov från komplex svensk fritext;
- väljer inte automatiskt hela verktygskedjan.

Den är ett testverktyg och ska inte exponeras som publik slutpunkt.

### 8.2 Nuvarande intentklassning är begränsad

Kundchattens intentklassning är regel- och nyckelordsbaserad.

Det fungerar för tydliga fraser som order, retur, leverans och rekommendation men räcker inte för:

- komplex svenska;
- implicita behov;
- flera avsikter i samma mening;
- pronomen och hänvisningar till tidigare meddelanden;
- nyanserade följdfrågor;
- stabil konversationsförståelse.

Den kan behållas som säker fallback och kontrollsignal men inte som ensam språkförståelse.

### 8.3 Ingen språkmodellsintegration för verklig dialog

Det saknas ett kontrollerat språkmodellslager som:

- tolkar fritext till ett strikt schema;
- sammanför tidigare meddelanden;
- identifierar saknad information;
- föreslår nästa fråga;
- formulerar naturliga svenska svar från endast godkända fakta.

Språkmodellen måste vara schema- och verktygsbegränsad. Den får inte ha fria produktionscredentials eller skapa egna API-anrop.

### 8.4 Ingen publik widget

Det finns ingen färdig kundsynlig frontend-widget med:

- fritextfält;
- sessionshantering;
- mobil vy;
- desktopvy;
- produktkort;
- orderkort;
- laddning, fel och tomma lägen;
- tillgänglighet;
- mänsklig överlämning.

### 8.5 Order, tracking och returkoppling är placeholder

Supportintegrationen i kundchattkärnan definierar kapabiliteter som:

- `order_lookup`;
- `shipping_tracking`;
- `return_request`;
- `claim_wrong_product`;
- `claim_damaged_product`;
- `human_support_handoff`.

Men implementationen returnerar medvetet `not_configured` och får inte behandlas som att order- eller trackingdata faktiskt hämtas.

### 8.6 Product Intelligence är inte driftsatt

PR `#25` är draft och omergad. Följande är inte gjort:

- ingen katalogbucket;
- ingen dedikerad runtime service account;
- ingen kataloguppladdning;
- ingen Cloud Run-tjänst;
- ingen publik eller privat runtime;
- ingen trafikändring.

Det finns säkra bootstrap- och kandidatplaner men de får inte köras utan separat uttryckligt godkännande.

### 8.7 Chattkärnan finns inte säkert i aktuell main-produktionslinje

PR `#12` är mergad till en feature-gren. Nästa chatt måste kontrollera aktuell repohistorik innan kod flyttas. Anta inte att kundchattkärnan finns i `main` eller i någon live-tjänst.

## 9. Vad som tidigare blev fel eller inte ska upprepas

1. Projektet får inte beskrivas som endast en före-köp-produktguide. Efterköpsfrågor är en huvuddel av AI Arman.
2. Startknappar får inte ersätta fritextboten. De är genvägar, inte kärnan.
3. `chat/preview` får inte kallas färdig bot.
4. Placeholder-orderstatus får aldrig presenteras som verklig integration.
5. Search Brain-träffar får endast bli kandidater. Popularitet eller sökträff får inte ensam göra en produkt rekommenderbar.
6. Webbläsaren får inte skicka egna poäng och på så sätt påverka beslutet.
7. Äldre rekommendationskod får inte bli en konkurrerande auktoritet bredvid Product Intelligence.
8. Gamla feature-grenar ska inte mergas blint. Återanvänd små, verifierade delar.
9. Vi ska inte vänta på hela slutvisionen före lansering, men första versionen måste vara ärlig, säker och faktiskt användbar.
10. Inga påståenden om att något är live, driftsatt eller kopplat får göras utan verifiering.

## 10. Rekommenderad teknisk arkitektur

```text
Harmoniq.se
  -> AI Arman-widget
  -> harmoniq-backend / AI Arman Orchestrator
       -> conversation store
       -> identity and policy
       -> language interpretation
       -> tool validator
       -> Search Brain candidate discovery
       -> Product Intelligence suitability
       -> live product facts read-only
       -> order and tracking read-only
       -> purchased-product lookup
       -> Returns Module link or later confirmed action
       -> human support handoff
```

Webbläsaren ska inte prata direkt med Vendre, Product Intelligence, nShift, Gmail eller andra känsliga system.

## 11. Riktig fritextkedja som ska byggas

### 11.1 Meddelandeendpoint

Bygg ett riktigt endpointkontrakt, exempelvis:

```http
POST /ai-arman/chat/messages
```

Request ska minst innehålla:

- `conversationId` eller ny-session-signal;
- `message`;
- säker page context;
- serververifierad kundidentitet när sådan finns.

Response ska innehålla:

- kundsynligt meddelande;
- strukturerad response type;
- frivilliga quick replies;
- produkt-, order- eller supportkort;
- conversation ID;
- säkerhets- och handoffstatus.

### 11.2 Strukturerad språkförståelse

Fritext ska först bli ett validerat internt objekt, exempelvis:

```json
{
  "intent": "product_recommendation",
  "domain": "haircare",
  "requestedProductTypes": ["shampoo"],
  "needs": ["dry_lengths", "color_treated", "oily_scalp"],
  "avoidSignals": ["overly_strong_cleansing"],
  "missingInformation": ["scalp_sensitivity"],
  "confidence": 0.91
}
```

Backend ska validera schemat och kan avvisa eller begränsa resultatet.

### 11.3 Dialogstatus

Konversationen ska lagra strukturerade, verifierbara fakta från dialogen så att AI Arman:

- inte frågar samma sak igen;
- kan förstå korta svar som `ja`, `den andra` eller `varje dag`;
- kan skilja kundens preferenser från produktfakta;
- kan byta spår mellan produkt, order och support utan att tappa sammanhang.

### 11.4 Verktygsval

Språkmodellen får föreslå ett namngivet verktyg men backend avgör om verktyget är:

- registrerat;
- tillåtet för aktuell identitet;
- read-only eller skrivande;
- i behov av explicit bekräftelse;
- säkert att köra med aktuella data.

### 11.5 Naturligt svar

Språkmodellen får formulera sluttext endast från ett begränsat faktapaket som backend har godkänt.

Den får inte lägga till:

- ingredienser som saknas;
- kliniska effekter som inte är belagda;
- aktuellt pris eller lager från minnet;
- orderstatus som inte hämtats;
- löften om återbetalning eller reklamationsutfall.

## 12. Exakt rekommenderad arbetsordning

### Fas A – lås kontrakt före större kod

1. Kontrollera aktuell status för PR `#18`, PR `#12` och PR `#25`.
2. Dokumentera Beta 1:s exakta API-kontrakt.
3. Definiera strukturerat schema för fritexttolkning.
4. Definiera response-block för widgeten.
5. Definiera conversation state.
6. Definiera tillåtna verktyg för första releasen.
7. Skriv tester för kontrakten innan implementation.

### Fas B – bygg orchestratorn i `harmoniq-backend`

1. Skapa en ren implementationgren från verifierad bas.
2. Flytta in selektivt återanvändbara chat-core-delar.
3. Behåll konversationslagring, historik, event och mänsklig handoff.
4. Anslut Product Intelligence-klienten.
5. Ersätt klientstyrda kandidater och poäng med backendstyrd discovery.
6. Skapa riktiga chat message-endpointen.

### Fas C – bygg kontrollerad språkförståelse

1. Lägg till språkmodellsklient bakom interface.
2. Kräv strikt strukturerat outputschema.
3. Lägg timeout, kostnadsgräns, rate limit och felklassning.
4. Spara modell- och promptversion i audit.
5. Använd deterministisk fallback när modellen är otillgänglig.
6. Lägg regressionstester för svenska fritextfall.

### Fas D – slutför första rekommendationsresan

1. Tolka hårvårdsbehov.
2. Ställ följdfrågor.
3. Hämta kandidater.
4. Kontrollera kandidater med Product Intelligence.
5. Applicera blockerare och grindar.
6. Hämta livefakta read-only.
7. Returnera strukturerade produktkort.
8. Testa att ingen svag produkt fyller en tom plats.

### Fas E – bygg efterköp read-only

1. Säker kund- eller orderidentifiering.
2. `get_order` read-only.
3. `get_tracking_status` read-only.
4. Visa köpta produkter.
5. Besvara användningsfrågor med verifierad produktdata.
6. Länka till Returns Module.
7. Skapa mänsklig handoff med sammanfattning.

Skrivfunktioner som skapar retur eller reklamation skjuts till senare release och kräver explicit confirmation, idempotency och audit enligt `PERMISSION_MATRIX.md`.

### Fas F – bygg widgeten

1. Stängd launcher.
2. Startvy med frivilliga genvägar.
3. Fritextdialog.
4. Quick replies.
5. Produktkort.
6. Order- och trackingkort.
7. Köpt produkt-kort.
8. Säkerhetsmeddelande.
9. Mänsklig överlämning.
10. Fel, tomt läge och återförsök.
11. Mobil och desktop.
12. Tillgänglighet.

### Fas G – intern beta

1. Testkatalog och testorder.
2. Ingen skrivåtkomst.
3. Full loggning och audit.
4. Regressionstester i GitHub Actions.
5. Test av felaktig modelloutput.
6. Test av timeout och beroendefel.
7. Test av prompt injection och försök att få interna data.
8. Intern visuell testlänk.

### Fas H – begränsad publik Beta 1

Lansera först begränsat, exempelvis:

- endast på hårvårdssidor;
- på kundkonto och ordersidor;
- eller för en liten andel besökare.

Mät:

- öppningar;
- fritextfrågor;
- valda intent;
- följdfrågor;
- rekommendationer;
- produktklick;
- trackingklick;
- mänskliga handoffs;
- obesvarade frågor;
- kundens hjälpsamhetsbedömning.

## 13. Testkrav

Alla tester som går att automatisera ska köras av ChatGPT genom GitHub Actions.

Minimikrav före intern beta:

- unit tests för schema och policy;
- integrationstest för chat message-endpoint;
- kontraktstest mot Product Intelligence;
- konversationstest över flera turer;
- svenska språkfall;
- mixed-intent-test;
- safety- och medicinsk gräns;
- fail-closed vid saknad produktdata;
- fail-closed vid order/tracking-fel;
- kontroll att modellen inte kan ta bort blockerare;
- kontroll att klienten inte kan skicka egna produktpoäng;
- rate-limit-test;
- timeout-test;
- logg- och redaction-test;
- mobil- och desktopbygge;
- tillgänglighetskontroll där möjlig.

Visuell testning som verktygen inte kan utföra fullt ut ges till Arman sist och endast med en liten exakt checklista.

## 14. Säkerhetsgränser som inte får ändras

- Product Intelligence är deterministisk auktoritet för produktlämplighet.
- OpenAI eller annan språkmodell får inte ta bort blockerare.
- Search Brain får hitta kandidater men inte själv godkänna produkter.
- Personalisering får aldrig lyfta en sämre kvalitetsnivå över en bättre.
- Pris, lager och orderfakta måste vara aktuella och auktoritativa.
- Ingen modell får direkta Vendre-, Gmail-, nShift-, databas- eller GCP-credentials.
- Kund-ID från fri text får aldrig accepteras som identitet.
- Skrivverktyg kräver verifierad identitet, explicit confirmation, idempotency och audit.
- Direkt återbetalning, orderavbrott, adressändring och obegränsade API-anrop är förbjudna i första releasen.

## 15. Driftsättningsstatus och spärrar

Product Intelligence är ännu inte driftsatt.

Planerade exakta bekräftelsefraser i Product Intelligence-projektet är:

```text
BOOTSTRAP_AI_ARMAN_PRIVATE_0_PERCENT
DEPLOY_AI_ARMAN_0_PERCENT
```

Ingen bootstrap, deploy, resursuppbyggnad, IAM-ändring, kataloguppladdning, trafikändring, merge eller publicering får göras utan separat uttryckligt godkännande.

## 16. Definition of Done för första användbara fritextprototyp

Prototypen är klar när en testkund kan:

1. skriva ett komplext hårvårdsbehov i fri svensk text;
2. få en relevant följdfråga;
3. svara kort utan att upprepa hela sammanhanget;
4. få produkter hämtade av backend;
5. få kandidater kontrollerade av Product Intelligence;
6. få högst tre godkända produktkort;
7. få ett naturligt svar som endast använder verifierade fakta;
8. byta till en efterköpsfråga;
9. få read-only information eller korrekt säker handoff;
10. se konversationen sparad;
11. få ett ärligt felmeddelande när data eller tjänst saknas.

Prototypen är inte klar om:

- kunden måste välja formulärknappar i stället för att skriva;
- webbläsaren bestämmer produktpoäng;
- boten hittar på produkt- eller orderfakta;
- placeholderdata visas som verklig;
- konversationen glömmer tidigare svar;
- en blockerad produkt rekommenderas;
- mänsklig handoff tappar konversationens sammanhang.

## 17. Första uppgift i nästa chatt

Börja inte med deploy eller widgetdesignkod.

Gör följande i GitHub:

1. läs denna handoff och de sex grunddokumenten;
2. kontrollera aktuell PR-, branch- och commitstatus i båda reporna;
3. inspektera de faktiska implementationerna i PR `#12` och PR `#18`;
4. föreslå och dokumentera det exakta `POST /ai-arman/chat/messages`-kontraktet;
5. dokumentera det strikta fritexttolkningsschemat och conversation state;
6. lägg kontraktstester i GitHub;
7. kör testerna via GitHub Actions;
8. rätta eventuella fel;
9. rapportera vad som är verifierat innan nästa kodfas påbörjas.

Arman ska inte behöva klistra in kod eller köra lokala kommandon för denna fas.
