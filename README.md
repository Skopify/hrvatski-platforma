# Hrvatski — leerplatform

Een persoonlijk platform om Kroatisch te leren, gebouwd op de content van
*Hrvatski za početnike 1* (Croaticum, Filozofski fakultet Zagreb, 2006).

Het uitgangspunt is het tegenovergestelde van een woordjes-app: elke les combineert
context, grammatica en herhaling, oefeningen zijn getypt in plaats van aangetikt, en
de spaced repetition plant per **naamvalsvorm** in plaats van per woord.

## Draaien

Dubbelklik **`start.command`** in Finder. Dat is alles.

Het script zoekt zelf een werkende node, installeert de pakketten als ze ontbreken,
zet de leerstof klaar als er nog geen database is, start de server en opent de
browser. Stoppen doe je met ctrl-C of door het venster te sluiten.

Liever met de hand, of vanaf een andere machine:

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

Daarna staat het platform op <http://localhost:3000>.

**Ook op je telefoon.** De dev-server luistert ook op je lokale netwerk — Next print
bij het starten een tweede adres (`Network: http://192.168.x.x:3000`). Zit je telefoon
op dezelfde wifi, dan werkt dat adres gewoon in Safari. De layout is daarop
voorbereid: de zijbalk wordt een bovenbalk. Je Mac moet dan wel aan staan.

> **Let op — Node.js.** De Homebrew-node op deze machine (`/opt/homebrew/bin/node`,
> v21.6.2) is defect: hij linkt tegen `icu4c 73`, terwijl er `icu4c@78` staat. Dat is
> een bestaand probleem sinds de icu4c-upgrade, los van dit project. Omdat hij vooraan
> in het PATH staat, valt een kale `npm run dev` om met een dyld-fout — vandaar
> `start.command`, dat om het probleem heen werkt door `/usr/local/bin/node` (v20.11.1)
> te kiezen.
>
> Wil je het bij de wortel aanpakken, dan is `brew upgrade node` de ingreep. Dat tilt
> node van 21 naar de huidige versie en repareert de koppeling. Het raakt je hele
> omgeving, dus die keuze is aan jou; `start.command` blijft daarna gewoon werken.

### Overige commando's

| Commando | Wat het doet |
|---|---|
| `npm run seed` | Zet `content/` om in leerbare items in de database (idempotent, raakt voortgang niet aan) |
| `npm run check` | Zelfcontrole van de beoordelingsladder — laat zien hoe antwoorden door exact/diakritisch/tikfout/fout vallen |
| `npm run check:content` | Valideert de content: dubbele id's, oefeningen zonder antwoord, targets die nergens naar wijzen, vreemde tekens, en de afgeleide naamvalsvormen |
| `npm run db:reset` | Gooit de database weg en seedt opnieuw. **Wist alle voortgang.** |
| `npm run build` | Productiebuild. Mag gerust terwijl de dev-server draait: die schrijft in `.next/`, de build in `.next-build/` |

### Als de pagina raar doet

**Start het platform maar één keer tegelijk.** Twee dev-servers op hetzelfde project
compileren allebei in `.next/` en overschrijven elkaars brokken; het gevolg is een
pagina die zijn opmaak kwijtraakt zodra je navigeert. Verraderlijk is dat Next bij een
bezette poort gewoon de volgende kiest, dus je ziet twee werkende adressen en niet
meteen dat er iets mis is. `start.command` weigert daarom een tweede server te starten.


Zie je **"missing required error components, refreshing…"**, of laadt de opmaak niet
terwijl de tekst er wel staat, dan is `.next/` in de war geraakt — bijvoorbeeld doordat
de server halverwege het compileren is afgebroken. Het is geen fout in de code en je
voortgang staat er los van. Stop de server en gooi de map weg:

```bash
rm -rf .next
```

Bij de volgende start bouwt hij zichzelf opnieuw op.

## Architectuur

```
content/            Leerstof als JSON — de enige plek waar content leeft
  syllabus.json     Alle 21 eenheden, bronmetadata, naamvalvolgorde
  SCHEMA.md         Het contentmodel
  lessons/          Eén bestand per les
  stories/          Eén bestand per verhaal (tekst, glossarium, vragen)
  case-usage.json   Zinnen voor de naamvalkeuze-drill, met contrastuitleg
src/
  app/              Next.js App Router — pagina's en server actions
    oefenen/        Hub met herhaling (/herhalen) en de drills (/drill/<soort>)
    verhalen/       Verhalenindex, lezer, begrijpend lezen en taaloefeningen
    woorden/        Doorzoekbaar woordenboek met geheugenstand
    fouten/         Foutenbank uit je eigen antwoorden
  components/       UI, inclusief handgeschreven SVG-grafieken en de verhaallezer
  lib/
    content.ts      Laden en typeren van de content-JSON
    story.ts        Verhaaltypes en glossleutels (fs-vrij, ook voor de client)
    grading.ts      De beoordelingsladder (exact / diakritisch / tikfout / fout)
    srs.ts          FSRS-planning en het reviewlogboek
    planner.ts      Sessie-opbouw: geblokte introductie, interleaved herhaling
    drills.ts       De zeven drillsoorten (gedeeld met de client)
    coverage.ts     Lexicale dekking en ontmoetingen in context
    numbers.ts      Kroatische telwoorden 0-100
    milestones.ts   Mijlpalen, berekend uit de echte tellers
    stats.ts        Alle dashboardquery's
    present.ts      Wat de browser mag zien (antwoorden blijven op de server)
    tts.ts          Kroatische spraak: Azure als die er is, anders de systeemstem
    speech/azure.ts Neurale stemmen van Azure, met schijfcache in data/audio/
data/hrvatski.db    SQLite — je volledige voortgang, één bestand
scripts/            seed en zelfcontrole
public/fonts/       Zelf gehoste letters: Fraunces, Plus Jakarta Sans, Literata
start.command       Dubbelklikken om te starten (zoekt zelf een werkende node)
.env.local.example  Sjabloon voor de optionele Azure-sleutel
```

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind 4 · SQLite (better-sqlite3 +
Drizzle) · ts-fsrs · Web Speech API. Alles draait lokaal. De enige uitzondering is
optioneel: zet je een Azure-sleutel in, dan gaat de tekst van luisteroefeningen naar
Microsoft om er een opname van te maken — zie Audio.

## De ontwerpkeuzes, kort

**FSRS in plaats van SM-2.** FSRS haalt dezelfde retentie met 20–30% minder
herhalingen en kent SM-2's ease-factor-spiraal niet, waarin een moeilijk item voor
altijd blijft terugkomen. Het volledige reviewlogboek wordt bewaard, zodat de
parameters later op jouw eigen historie geoptimaliseerd kunnen worden.

**Geblokte introductie, interleaved herhaling.** Nieuwe stof komt geblokt binnen;
pas de herhaling wordt gemengd. Dat volgt het onderzoek preciezer dan "meng altijd
alles": geblokt oefenen geeft hógere accuratesse tijdens het leren, interleaving wint
op de uitgestelde toets.

**Per vorm plannen, niet per woord.** Een `form`-item is één lemma × naamval × getal.
Daardoor kan het dashboard zeggen "je accusatief zit, je locatief lekt" in plaats van
"80% van je woorden".

**De verbuigingsmotor** (`src/lib/morphology.ts`) maakt die belofte pas waar. Lang
gold de regel "genereer geen vorm die de brondata niet geeft", met als prijs dat vijf
van de zeven naamvallen nul vormkaarten hadden. De motor houdt zich aan dat principe
maar leest de stam af uit velden die er wél staan: `gen_sg` geeft de enkelvoudsstam
(en daarmee de vluchtige a en de stamwissel), `nom_pl` het meervoud, `present_1sg` de
presensstam. Waar het onzeker is, zwijgt hij: onregelmatige werkwoorden, woorden
zonder genitief, en de genitief meervoud van vrouwelijke woorden (žena → žena, maar
sestra → sestara). Een aparte controle vangt woorden die de genitieftoets doorstaan
maar tóch een onvoorspelbaar meervoud hebben — brat → braća, dijete → djeca — en slaat
daar het hele meervoud over. Resultaat: alle zeven naamvallen hebben vormkaarten, plus
de vervoegingen, en de drill **Naamvalsvormen** laat je ze produceren.

De motor kent vier soorten uitzondering die met een kale regel misgingen:

- **Adjectivische woorden.** Landnamen als *Hrvatska* en de maand *studeni* buigen als
  een bijvoeglijk naamwoord: *u Hrvatskoj*, niet \*u Hrvatsci. Ze dragen
  `"declension": "adjectival"` in de content en krijgen een eigen tak.
- **Sibilarisatie die uitblijft.** Niet elke k wordt een c vóór -i. Na een cluster
  (*mačka → mački*, *igračka → igrački*) en bij vrouwelijke persoonsnamen op -ka
  (*Talijanka → Talijanki*) gebeurt het niet — daar zou *Talijanci* bovendien de
  mánnelijke meervoudsvorm zijn.
- **De genitief meervoud.** Woorden met een vluchtige a krijgen die terug
  (*sastanak → sastanaka*, *pas → pasa*), en woorden met een eindcluster schuiven er
  een a tussen (*student → studenata*, *bicikl → bicikala*) — behalve na st, št, zd
  en žd (*turist → turista*).
- **De vocatief.** Alleen voor levende wezens. De vocatief van *oblak* of *ručak* is
  theorie, en de regel maakte er door de vluchtige a onuitspreekbare vormen van.

`npm run check:content` bewaakt dit met een lijst spot-checks en een fonotactische
zeef: elke afgeleide vorm met čč, šš, sč of een andere onmogelijke reeks slaat alarm.
`npm run seed` ruimt bovendien vormen op die de motor niet meer maakt — zonder dat
bleven afgekeurde vormen gewoon in de database staan.

**Productie weegt zwaarder.** Getypte productie levert 10 XP basis tegen 4 voor
herkennen, en telt zwaarder in de planning. Geen woordtegels: het aantikken van
kant-en-klare woorden is precies waar herkenning doorgroeit terwijl productie
stilvalt.

**Diakritische fouten worden apart geteld.** Een antwoord dat alleen č/ć/š/ž/đ mist,
wordt goed gerekend maar aangemerkt, krijgt minder XP en de FSRS-rating *Hard*. Het
is dé structurele fout van een Nederlandstalige; in een gemiddelde zou hij onzichtbaar
blijven.

**Vrije productie wordt niet automatisch nagekeken.** Je krijgt het modelantwoord met
criteria en beoordeelt jezelf. Dat oordeel voedt de SRS net zo hard — eerlijker dan
doen alsof een reguliere expressie Kroatisch kan beoordelen.

**Drills naast herhaling.** De spaced repetition bepaalt wannéér iets terugkomt, dus
als de planning leeg is, is er niets te herhalen. Daarnaast staan zes drills die altijd
kunnen: geslacht, genitief, meervoud, de ja-vorm van werkwoorden, getallen en een
dictee. Ze verzinnen niets — elke vraag komt uit een veld dat de brondata expliciet
geeft (`gender`, `gen_sg`, `nom_pl`, `present_1sg`), behalve de getallen, die
regelmatig genoeg zijn om te genereren. Ze gebruiken alleen woorden uit lessen die je
al kunt openen, en elk antwoord voedt de FSRS-kaart van dat woord. Drills leveren 60%
van de XP van een lesoefening: korter en kaler werk hoort niet de goedkoopste weg naar
een hoog totaal te zijn.

**Woorddekking per verhaal.** Hu & Nation: je moet ±95% van de lopende woorden in
een tekst kennen om er vlot doorheen te komen, en 98% om onbekende woorden uit de
context te kunnen raden. Dat is normaal niet te meten, want geen app weet welke
woorden jíj kent. Dit platform weet dat wel — elk woord heeft een FSRS-kaart met een
geschatte retentie. Elk verhaal toont daarom zijn dekking, met de 95%-grens als
streepje in de balk. Eigennamen en functiewoorden tellen als bekend; een expliciete
lijst functiewoorden zorgt dat een tekst niet zwaarder lijkt omdat hij toevallig veel
«u» en «i» bevat. De meting valideert de verhaalindeling zelf: elk verhaal passeert de
95%-grens precies op het lesniveau waarvoor het geschreven is.

**Ontmoetingen in context.** Een woord dat je acht tot tien keer in betekenisvolle
tekst tegenkomt, blijft hangen zonder dat je het studeert. Dat is iets anders dan een
SRS-herhaling, dus wordt het apart geteld: elke keer dat je een verhaal uitleest,
krijgt elk inhoudswoord erin één ontmoeting.

**Naamvalkeuze in plaats van naamvalsuitgangen.** Bij Russische naamvalsmorfologie
scoorde usage-based instructie 90% tegen 66% voor regelgerichte instructie. De drill
**Naamvalkeuze** volgt dat: je krijgt een échte zin met één woord gemarkeerd en kiest
welke naamval de context vraagt — niet welke uitgang erbij hoort. De uitleg achteraf
zet er telkens een contrastzin naast («Idem u Zagreb» tegenover «Živim u Zagrebu»),
want de keuze tussen twee naamvallen is het eigenlijke leerpunt. De keuzelijst groeit
mee met je niveau in plaats van meteen zeven opties te tonen.

**Uren naast XP.** Een CEFR-niveau kost volgens de gangbare richtlijn 100 tot 200
begeleide lesuren. Onder **Voortgang** staan je werkelijke uren tegenover die
richtlijn per niveau. XP meet wat je hier gedaan hebt; uren meten wat een niveau
werkelijk kost — en geen enkele app levert die uren in zijn eentje.

**Een foutenbank uit je eigen antwoorden.** Elk antwoord staat al in de database.
**Fouten** haalt eruit wat misging, met de vraag erbij, wat jij typte en wat het moest
zijn. Bijna-goede antwoorden staan apart, want een gemiste č is een ander soort fout
dan het antwoord niet weten.

Bovenaan die pagina staan **patronen** in plaats van losse fouten: één keer «srednji»
antwoorden waar «ženski» hoort is een vergissing, het tien keer doen is een diagnose.
Het platform herkent er vijf — diakritische tekens weglaten, de verkeerde naamval
kiezen (met de vaakst verwarde combinatie erbij), de juiste naamval met de verkeerde
uitgang, het geslacht niet vastzitten, en de vervoeging — elk met wat eraan te doen is
en een link naar de drill die het traint. En je kunt je foute lesoefeningen in één
sessie overdoen; drillfouten niet, want die komen vanzelf terug.

**Mijlpalen die iets meten.** Geen "log tien dagen in", maar dingen als *vijftig
dictees zonder een diakritisch teken te missen* — precies de fout waar een
Nederlandstalige jaren in blijft hangen. Elke mijlpaal is een teller met een doel en
staat altijd zichtbaar, ook als je er nog ver vanaf bent.

**Verhalen met een grammaticaal glossarium.** Onder **Verhalen** staat een doorlopende
reeks, geschreven binnen de grammatica van een lespunt: verhaal 1 is puur nominatief,
verhaal 3 staat volledig in de perfekt, verhaal 5 is B1 met betrekkelijke bijzinnen.
Elk woord is aantikbaar en toont niet alleen de vertaling maar ook de vórm —
"accusatief enkelvoud van kava" — omdat het woord in een Kroatische tekst zelden het
woord uit het woordenboek is. Opgezochte woorden zet je met één tik in de herhaling;
eerste keer uitlezen levert 20 XP op.

**Begrijpend lezen, apart van de taaloefeningen.** Na elk verhaal staan twee sets
vragen, en dat onderscheid is opzettelijk. De *taaloefeningen* gaan over vormen en
voeden de spaced repetition. Het *begrijpend lezen* gaat over de tekst: hoofdgedachte,
verwijswoorden, tekstverband, afleiden en conclusies — met bij elke vraag het etiket
van de vaardigheid erbij, want een verwijswoordvraag los je anders op dan een
hoofdgedachtevraag, en dat verschil zien is het halve werk. De uitleg achteraf legt
daarom de *strategie* uit, niet alleen het feit. Deze vragen gaan bewust **niet** de
SRS in: ze horen bij één specifieke tekst, dus over drie weken zou je het antwoord
herinneren in plaats van de vaardigheid.

**Vormgeving.** Vlak en fris: wit en zonverbleekt kalksteen als grond, Adriatisch
blauw als enige accent, terracotta voor de reeks en goud voor XP — geen gradients,
geen textuur. Drie zelf gehoste letters met volledige Latin-Extended (č ć đ š ž):
Fraunces voor koppen en getallen, Plus Jakarta Sans voor de interface, Literata voor
de verhalen. Het enige ornament is een klein plat šahovnica-dambord als merkteken.

Twee dingen worden door de code afgedwongen in plaats van door herhaling: `PageHeader`
(šahovnica, bovenschrift, titel, inleiding) en `Page`, dat maar drie breedtes kent —
`wide` voor overzichtspagina's, `detail` voor naslag met tabellen, en `focus` voor
lezen, sessies en drills, smal gehouden omdat een regel van 60–75 tekens het prettigst
leest. Zonder die twee kroop elke pagina naar zijn eigen maat en sprong de inhoud
zichtbaar heen en weer bij het navigeren.

## Wat er klaarstaat

Alle eenentwintig eenheden zijn volledig uitgewerkt — 782 woorden, 97 grammaticapunten,
371 oefeningen en 60 uitlegmomenten, verdeeld over negen oefenvormen. Dat dekt de
hele A1-A2+ boog: alle zeven naamvallen, de verleden en toekomende tijd, alle
werkwoordsklassen, de imperatief en de vocatief.

Lessen worden pas vrijgegeven als de vorige af is: de accusatief in les 5 leunt op het
geslacht en de levendheid die in lessen 1 tot en met 4 zijn opgebouwd.

Eenheid 0 behandelt het alfabet en de uitspraak. Die leunt zwaar op luisteroefeningen
via de Kroatische TTS-stem — juist daar is het onderscheid tussen č en ć te trainen.

## Content uitbreiden

Een les toevoegen is één JSON-bestand in `content/lessons/` volgens
[SCHEMA.md](content/SCHEMA.md), gevolgd door `npm run seed`. Geen codewijziging.
Draai daarna `npm run check:content` — dat vangt dubbele id's, oefeningen zonder
antwoord en verwijzingen naar niet-bestaande items.

Een verhaal toevoegen werkt hetzelfde: één JSON-bestand in `content/stories/` met
tekst (per zin vertaald), een glossarium, een `comprehension`-lijst en `exercises`.
De validator eist dat élk woord in de tekst een gloss heeft — een onaantikbaar woord
is precies het woord waarop het lezen vastloopt — en meldt ongebruikte glossen en
kapotte item-verwijzingen. Voor begrijpend lezen eist hij bovendien een geldige
vaardigheid en een `explain_nl` bij élke vraag: zonder «waarom dit het antwoord is»
leert een leesvraag je niets.

Vormitems worden automatisch gegenereerd, maar alleen voor naamvallen die de syllabus
al heeft geïntroduceerd. De genitief van een woord uit les 1 wordt dus een les-14-item,
niet een les-1-item.

Elk item draagt een `source`-veld met de boekpagina. Wat is aangevuld — paradigma's,
Nederlandse vertalingen, uitleg — staat als `"source": "aangevuld"`, zodat brondata
en redactie gescheiden blijven.

## Bekende beperkingen van de brondata

- De tekstlaag van het udžbenik-PDF is beschadigd door compressie: **č, ć en đ komen
  er nul keer in voor**. De vježbenica is schoon en is daarom de primaire tekstbron;
  het udžbenik is per pagina visueel uitgelezen.
- Ontbrekend in de PDF's: boekpagina's 10–11 van het udžbenik (syllabustabel voor
  lessen 14–20), het glossarium HR–EN–ES (p. 299–355), het *Gramatički pregled* en
  *Glagolski dodatak* van de vježbenica (p. 101–128), de antwoordsleutel en de audio-cd.
- De grammatica voor lessen 14–20 in `syllabus.json` is afgeleid uit de oefeningen in
  de vježbenica en gemarkeerd met `$note`.
- Het lesboek dateert van vóór 2023 en rekent nog in **kuna**. Kroatië gebruikt sinds
  1 januari 2023 de euro, dus alle plekken die iets over Kroatië beweren — het
  landenkaartje in les 0, de landtekst in les 5, de winkeldialoog in les 9 en de
  prijzentekst in les 17 — zijn omgezet. In les 17 was de kuna óók het
  grammaticavoorbeeld (*jedna kuna, dvije kune, pet kuna*); die rol is overgenomen
  door *kava*, dat dezelfde drie vormen heeft en nog wel bestaat. Het woord `kuna`
  blijft in de woordenlijst staan, met het jaartal erbij.
- Les 17 noemde 4,5 miljoen inwoners; de volkstelling van 2021 kwam op 3,87 miljoen.
  Bijgesteld naar "oko četiri milijuna".

## Audio

Luisteroefeningen gebruiken standaard de Web Speech API met een `hr-HR`-stem van je
besturingssysteem. Op deze machine is dat **Lana (hr-HR)**, dus audio werkt zonder
installatie. Is er geen Kroatische stem, dan worden luisteroefeningen overgeslagen in
plaats van met een Engelse stem voorgelezen — dat laatste zou de uitspraak actief
bederven. **Voortgang → Audio** laat de status zien.

### Betere stemmen (optioneel, gratis)

De stem die macOS standaard installeert is de compacte versie: blikkerig, en met een
ondergrens waardoor traag afspelen nauwelijks werkt. Gemeten op deze machine duurt
dezelfde zin op rate 0.85 4111 ms en op rate 0.5 nog altijd 4911 ms — 19% verschil
terwijl je 40% vraagt. Daarom knipt het platform bij traag afspelen de zin in woorden
met stilte ertussen; dat levert wél +87% en +124% op.

Wil je het echt goed hebben, dan levert **Azure Speech** twee Kroatische neurale
stemmen: **Gabrijela** (vrouw) en **Srećko** (man). Dezelfde stemmen die Microsoft Edge
gebruikt, maar dan als opgeslagen bestand, zodat elke browser ze kan afspelen en de
uitspraak elke keer identiek is.

**Wat het kost.** De gratis laag (prijsklasse F0) is 500.000 tekens per maand. Alle
lesteksten, verhalen en oefeningen samen zijn ongeveer 60.000 tekens, en elke zin wordt
na de eerste keer van schijf gespeeld — een zin die je honderd keer herhaalt kost dus
één keer. Je komt er in de praktijk niet aan. Er is geen creditcard nodig voor F0, maar
Azure vraagt er wel om bij het aanmaken van een account.

**Instellen:**

1. Maak op <https://portal.azure.com> een *Speech Service* aan, prijsklasse **F0**
2. Ga naar **Keys and Endpoint** en kopieer **KEY 1** en de **Location/Region**
3. Kopieer `.env.local.example` naar `.env.local` en vul beide in
4. Herstart de server

Daarna staat op **Voortgang → Stemmen vergelijken** een testscherm waarin je dezelfde
zin door elke stem kunt laten uitspreken. De proefzinnen zijn gekozen op de klanken
waar het misgaat — č tegenover ć, en š, ž, đ, dž achter elkaar.

Zonder sleutel doet dit alles niets en gedraagt het platform zich precies zoals
hiervoor. De opnames belanden in `data/audio/` en blijven dus buiten versiebeheer.

### Gratis alternatief zonder sleutel

Open het platform in **Microsoft Edge**. Die brengt dezelfde neurale stemmen mee via de
browser, zonder account. Ze verschijnen vanzelf in de stemkeuze op Voortgang. Nadeel:
ze werken alleen met internet en alleen in Edge.
