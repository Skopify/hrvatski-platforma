# Herbouwplan: Kroatisch-leerplatform

> Doel van dit document: een volledige, uitvoerbare specificatie die je aan Claude Code kunt geven om het bestaande programma om te bouwen van "overhoring met wat uitleg" naar een didactisch onderbouwd leersysteem met drie secties: **Grammatica**, **Verhalen** en **Woordenschat**.

---

## 0. Diagnose: waarom het nu niet werkt

Het huidige programma is een **toetsingsmachine**, geen **leermachine**. Dat is een klassieke fout, en het is goed dat je het opmerkt. Concreet:

| Probleem nu | Gevolg |
|---|---|
| Overhoren zonder voorafgaande instructie | Je test wat je nooit systematisch hebt geleerd → frustratie, geen opbouw |
| Uitleg is bijzaak ("tussendoor kleine tekst") | Geen mentaal model van het Kroatische systeem; je raadt patronen |
| Losse items zonder context | Woorden blijven losse feiten; geen betekenisvolle verankering |
| Geen leerpad | Geen idee wat "af" is, geen gevoel van voortgang |
| Geen gedeelde kennisstatus | Het systeem weet niet wat jij al kent, dus kan niets adaptief |

**De kern van de herbouw:** het systeem moet één centraal model bijhouden van *wat jij kent* (woorden, vormen, regels), en alle drie de secties moeten dat model zowel **voeden** als **gebruiken**. Niet drie losse modules naast elkaar.

---

## 1. Ontwerpprincipes (onderbouwd)

Deze principes zijn gebaseerd op onderzoek uit taalverwervings- en geheugenpsychologie. Ze zijn de "waarom" achter elke ontwerpkeuze verderop — geef ze mee aan Claude Code zodat het niet terugvalt op quiz-patronen.

### 1.1 Expliciete grammatica-instructie werkt — mits gevolgd door oefening
Meta-analyses (Norris & Ortega 2000; Spada & Tomita 2010; Goo et al. 2015) laten consistent zien dat expliciete instructie effectiever is dan puur impliciet leren, voor zowel simpele als complexe structuren, en dat het effect blijvend is. Kroatisch met 7 naamvallen is precies het type taal waar dit het meest oplevert.
→ **Dus:** een echte grammaticasectie met korte, heldere regels in het Nederlands is verdedigbaar. Maar regel-uitleg alleen is niet genoeg (zie 1.2).

### 1.2 Begrijpen vóór produceren (Processing Instruction)
VanPatten's *processing instruction*: laat de leerder eerst oefeningen doen waarin hij de vorm moet **interpreteren** om de betekenis te snappen, vóórdat hij hem moet produceren. Bijv.: "Vidim psa" vs "Vidi me pas" — wie ziet wie? Dat dwingt tot vorm-betekenis-koppeling zonder productiedruk.
→ **Dus:** elke grammaticaregel krijgt een *input-fase* met begripsvragen vóór de productie-oefeningen.

### 1.3 Eerst geblokt, dan gemengd (hybride practice)
Interleaving (door elkaar husselen) geeft betere langetermijnretentie — maar recent onderzoek (Hwang 2025, *Language Learning*) toont dat interleaving vanaf het begin schadelijk is voor leerders die de basiskoppeling nog niet hebben. De hybride vorm (eerst geblokt oefenen, dán interleaven) wint.
→ **Dus:** nieuw grammaticapunt = eerst 100% geblokte oefening, daarna mengen met eerder geleerde punten (bijv. akkusatief vs lokatief door elkaar).

### 1.4 Spreiding + ophaaloefening (FSRS, niet SM-2)
Gespreide herhaling met actief ophalen is het best gevalideerde geheugenmechanisme dat er is. Gebruik **FSRS** (Free Spaced Repetition Scheduler), niet het oude SM-2: FSRS modelleert per kaart *stability*, *difficulty* en *retrievability* en is getraind op honderden miljoenen reviews; het levert ~20–30% minder herhalingen bij gelijke retentie.
→ **Dus:** neem een bestaande FSRS-implementatie (`ts-fsrs` voor TypeScript, `fsrs-rs-python` / `py-fsrs` voor Python). **Zelf een algoritme schrijven is verspilling.**

### 1.5 Teksten op 95–98% bekende woorden
De comprehension-coverage-literatuur (Hu & Nation 2000; Laufer 2020; Schmitt et al. 2017) is eenduidig: 95% bekende woorden is het minimum voor begrip, 98% is optimaal voor incidenteel woordleren. Onder ~90% stort het begrip in en gaat alle aandacht naar decoderen in plaats van naar de grammatica.
→ **Dus:** verhalen worden *automatisch gefilterd/gegenereerd* tegen jouw bekende-lemma-set. Dit is meetbaar en moet in code zitten, niet op gevoel.

### 1.6 Een woord heeft ~8–12 betekenisvolle ontmoetingen nodig
Er is geen magisch getal, maar de consensus ligt rond 8–10+ ontmoetingen in informatieve context voor betrouwbare verwerving (Nation & Wang 1999; Pellicer-Sánchez & Schmitt 2010; Uchihara, Webb & Yanagisawa 2019, meta-analyse).
→ **Dus:** verhalen in **series** met terugkerende personages en thema's ("narrow reading"): dat produceert vanzelf herhaling van dezelfde woordenschat. Het systeem moet per doelwoord tellen hoe vaak het al is tegengekomen.

### 1.7 Kennis is niet één ding
Herkennen (HR→NL) ≠ produceren (NL→HR) ≠ de juiste vorm kiezen ≠ vlot toepassen. Dat zijn aparte vaardigheden en verdienen aparte kaarten en aparte voortgangsmeting.

---

## 2. Architectuur: één kennislaag, drie ingangen

```
                    ┌─────────────────────────────┐
                    │   KNOWLEDGE STATE (SRS)     │
                    │  lexemes · vormen · regels  │
                    │  · chunks · foutenlog       │
                    │      [FSRS scheduler]       │
                    └──────────┬──────────────────┘
                     leest ▲   │   ▼ schrijft
          ┌─────────────────┼───┼─────────────────┐
          │                 │   │                 │
   ┌──────┴──────┐   ┌──────┴───┴──────┐   ┌──────┴──────┐
   │ GRAMMATICA  │   │    VERHALEN     │   │ WOORDENSCHAT│
   │             │   │                 │   │             │
   │ regels →    │◄─►│ i+1 input,      │◄─►│ frequentie- │
   │ drills →    │   │ 95-98% coverage │   │ backbone +  │
   │ automatisme │   │ + mining        │   │ mining      │
   └─────────────┘   └─────────────────┘   └─────────────┘
```

**De koppelingen (dit is het belangrijkste deel van de herbouw):**

- **Grammatica → Verhalen:** het grammaticapunt dat je deze week leert, wordt *ingebouwd* in de verhalen van die week (input flooding: ≥10 voorkomens van de doelstructuur).
- **Verhalen → Woordenschat:** elk woord dat je in een verhaal aantikt/niet kent, wordt een SRS-kaart *mét de zin waarin je het tegenkwam*.
- **Woordenschat → Verhalen:** je bekende-lemma-set bepaalt welk verhaal je krijgt (coverage-check).
- **Verhalen → Grammatica:** na een verhaal komt een korte "focus on form"-ronde over de structuur die erin zat.
- **Foutenlog → alles:** faal je drie keer op de lokatief bij `na`, dan genereert het systeem gerichte drills én een verhaal met veel `na + lokatief`.

---

## 3. Datamodel

Sla content op als **data** (DB/JSON), nooit hardcoded in UI-code. Voorstel (SQLite is prima; Postgres als je later multi-user wilt):

```
lexeme
  id, lemma, pos, gender, translation_nl, ipa?, audio_url?
  -- Kroatisch-specifiek:
  gen_sg, nom_pl, gen_pl        (zelfstandig naamwoord: onvoorspelbare stammen)
  aspect (impf/perf), aspect_partner_id, pres_1sg, pres_3pl   (werkwoord)
  comparative                    (bijvoeglijk naamwoord)
  frequency_rank, cefr_level

form            -- concrete verbogen vorm, gekoppeld aan paradigmacel
  id, lexeme_id, surface, features (case/number/person/tense/gender)

grammar_point
  id, code (bv. "ACC-ANIM"), title_nl, level, prerequisites[],
  explanation_md, contrast_nl (wat is anders dan Nederlands),
  common_errors[], example_ids[]

chunk           -- collocaties & vaste combinaties (essentieel!)
  id, text, translation_nl, grammar_point_ids[], lexeme_ids[]

story
  id, series_id, chapter_no, title, level, text,
  target_grammar_point_ids[], target_lexeme_ids[],
  coverage_stats (json), audio_url?

sentence        -- verhaal opgeknipt; basis voor cloze-kaarten
  id, story_id, index, text, translation_nl, token_analysis (json)

srs_item        -- HET hart van het systeem
  id, kind (LEX_RECOG | LEX_PROD | FORM | GRAM | CHUNK | CLOZE | AUDIO)
  ref_id, source_context_sentence_id?
  fsrs_state (stability, difficulty, due, reps, lapses, state)

review_log
  id, srs_item_id, ts, rating, elapsed_ms, answer_given, was_correct

error_log       -- fijnmazig, per grammaticaal kenmerk
  id, ts, grammar_point_id, expected, given, error_type
```

**Waarom die Kroatisch-specifieke velden?** Bij een sterk verbogen taal is het lemma alleen onvoldoende. `pas` → `psa` (vluchtige a), `vojnik` → `vojnici` (sibilarisatie), `pisati` → `pišem` (onvoorspelbare presensstam). Als je die niet opslaat kun je geen correcte oefeningen genereren en geen goede feedback geven.

---

## 4. Sectie A — Grammatica

### 4.1 De vaste lesloop (elke grammaticamodule identiek)

Dit is de belangrijkste verandering t.o.v. nu. Elke module doorloopt zeven stappen:

| # | Fase | Wat gebeurt er | Waarom |
|---|---|---|---|
| 1 | **Noticing** | 6–10 voorbeeldzinnen met NL-vertaling, doelvorm gemarkeerd. Vraag: "wat valt je op?" | Aandacht sturen vóór regel |
| 2 | **Regel** | Max. ~150 woorden Nederlands + tabel. Expliciet contrast met NL: "waar het Nederlands 'in het huis' zegt, gebruikt Kroatisch een naamvalsuitgang" | Expliciete kennis is bewezen effectief |
| 3 | **Interpretatie** | Structured input: kies de betekenis, niet de vorm. "Idem **u kuću**" vs "Sam **u kući**" → beweging of locatie? | Processing instruction: vorm-betekenis koppelen zonder productiedruk |
| 4 | **Geblokte productie** | 10–15 items, allemaal hetzelfde punt: invullen, transformeren, uit losse woorden bouwen | Basiskoppeling automatiseren |
| 5 | **Interleaved productie** | Zelfde punt gemengd met 2–3 eerder geleerde punten (bijv. akkusatief ↔ lokatief ↔ genitief) | Discrimineren leren; contrastieve fouten voorkomen |
| 6 | **In context** | Mini-verhaal (60–120 woorden) volgestopt met de doelstructuur; begripsvragen + één vormvraag | Transfer naar echt taalgebruik |
| 7 | **Naar SRS** | Regel wordt GRAM-item; foute items komen extra vaak terug; paradigmacellen worden FORM-items | Consolidatie over weken |

**Feedbackregel (belangrijk):** bij een fout niet meteen het antwoord geven. Escaleer:
1. metalinguïstische hint ("welke naamval vraagt `s`?")
2. keuze uit 2–3 vormen
3. correct antwoord + waarom + link naar de regel
En log elke fout fijnmazig (`grammar_point_id` + `error_type`), want daarop draait de adaptiviteit.

### 4.2 Curriculumvolgorde voor het Kroatisch

Dit is de ruggengraat. Volgorde is gekozen op **frequentie × noodzaak voor communicatie × cognitieve last**, niet op de traditionele schoolvolgorde N-G-D-A-V-L-I (die is voor moedertaalsprekers en is voor leerders juist ongunstig).

**Fase 0 — Klank & schrift** (1 module)
- Alfabet, 1-op-1 klank-tekenrelatie (grote winst: Kroatisch schrijft wat het zegt)
- `č/ć`, `dž/đ`, `š`, `ž`, `lj`, `nj`, rollende `r`, vocalische `r` (`vrt`, `prst`)
- Klemtoonbasics (geen toonoefening; alleen: klemtoon nooit op laatste lettergreep)

**Fase 1 — Nominatief & het werkwoordskader** (A1)
- Geslacht (-a/-∅/-o/-e) en nominatief ev/mv
- `biti`: volledige vormen (`jesam`), clitische (`sam`), negatie (`nisam`) → apart aandacht: de clitic staat op **positie 2**
- Presens: drie klassen (`-am` / `-im` / `-em`) + de "grote vier": `imati, biti, ići, htjeti`
- Vraagwoorden, `da/ne`, `li`, negatie `ne + werkwoord`
- Persoonlijke voornaamwoorden (en waarom je ze meestal weglaat)

**Fase 2 — Akkusatief** (A1)
- Lijdend voorwerp
- **Animaatheid**: mannelijk levend = genitiefvorm (`vidim psa`), mannelijk levenloos = nominatiefvorm (`vidim stol`) ← klassieke struikelsteen, verdient eigen submodule
- Vrouwelijk `-u`, meervouden
- Akkusatief na `u/na` bij *beweging*

**Fase 3 — Lokatief** (A1/A2)
- **Onderwijs lokatief en datief samen als één vorm, twee functies** — ze zijn qua uitgang vrijwel identiek. Dit scheelt de helft van het leerwerk.
- `u/na/o/po/pri` + lokatief
- **Kerncontrast:** `u kuću` (waarheen, akk.) vs `u kući` (waar, lok.). Dit is dé plek voor interleaved oefening.

**Fase 4 — Genitief** (A2) — de zwaarste, daarom pas hier
- Bezit (`knjiga moje sestre`)
- Negatie van `imati`: `nemam vremena`
- Hoeveelheden: `čaša vode`, `puno ljudi`
- Getallen: `2/3/4 + gen. ev.` vs `5+ + gen. mv.` ← eigen submodule
- De grote prepositiegroep: `od, do, iz, kod, bez, poslije, prije, za vrijeme…`

**Fase 5 — Datief** (A2)
- Meewerkend voorwerp, `dati/reći/pomoći` + datief
- Datief-clitica: `mi, ti, mu, joj, nam, vam, im`
- `sviđa mi se`, `treba mi`, `hladno mi je` — datief-experiencer-constructies (heel frequent, voelt raar voor NL'ers)

**Fase 6 — Instrumentaal** (A2)
- Middel (`pišem olovkom`) vs gezelschap (`s prijateljem`)

**Fase 7 — Vocatief** (A2, licht)
- Alleen aanspreekvormen + palatalisatie (`Marko → Marko`, `junak → junače`)

**Dwarsdoorsnijdende modules (verweven, niet aan het eind!):**
- **Aspect (impf/perf)** — introduceer *receptief* al in fase 2 als woordenschatpaar (`čitati/pročitati`), systematisch bij de verleden tijd. Leer aspect **per werkwoordspaar**, nooit als abstracte regel.
- **Perfekt** (verleden tijd): `sam + l-participium`, congruentie in geslacht/getal (`radio sam` / `radila sam`)
- **Clitische woordvolgorde** — eigen module, komt na perfekt. Volgorde: `li` → `sam/si/smo/ste/su` → datief → akkusatief/genitief → `se` → `je`. Dit is een van de moeilijkste dingen van de taal en wordt in de meeste cursussen verwaarloosd. Bouw hier een aparte drilgenerator voor (zinsvolgorde-puzzels: sleep de clitica naar de juiste plek).
- **Futur I** (`ću/ćeš/će + infinitief`, en de samentrekking `raditi ću → radit ću`)
- **Imperatief**, **conditionaal** (`bih/bi/bismo`)
- **Bijvoeglijke congruentie** + bepaald/onbepaald (`nov` / `novi`)
- **Klankwisselingen**: palatalisatie (`k→č, g→ž, h→š`), sibilarisatie (`k→c, g→z, h→s`), vluchtige `a` (`pas→psa`), `ije/je`-wisseling. Presenteer als *herkenningspatronen*, niet als regels om uit het hoofd te leren.

> **Instructie voor Claude Code:** deze volgorde in een aparte `curriculum.json` zetten met per module: `code`, `title_nl`, `prerequisites[]`, `level`, `target_forms[]`, `common_errors[]`. Het programma leest die file; hij is dus aanpasbaar zonder codewijziging.

### 4.3 De curriculumlaag tegenover de 21 lessen (besloten 16-08-2026)

**De lessen blijven de bron en de volgorde.** De 21 eenheden van het leerboek gaan niet op de schop; er komt een curriculumlaag bovenop die grammaticapunten uit meerdere lessen kan bundelen.

Twee afwijkingen van de boekindeling zijn wél doorgevoerd:

- **Locatief en datief zijn één vormmodule met twee functies** (`LOCDAT-FORM`). Het boek splitst ze over les 10 en 12; de uitgangen zijn vrijwel identiek, en los onderwijzen verdubbelt het leerwerk zonder opbrengst.
- **`LOC-VS-ACC` is een expliciete contrastmodule** — `u kuću` tegenover `u kući` — bedoeld voor interleaved oefening, niet als voetnoot bij de locatief.

**De curriculumlaag bevat de volledige §4.2-boom**, inclusief fase 0 (klank en schrift) en alle dwarsdoorsnijdende modules. Dat is geen volledigheidsdrang: modules die in de boom staan maar door geen enkele les gedekt worden, zijn dan een zichtbaar gat in plaats van een vergeten hoofdstuk.

De boom staat in `content/curriculum.json` (54 modules over 8 fases). `npm run codes` legt de 97 lespunten ertegenaan en drukt de dekking af. Stand op 16-08-2026: **46 van de 54 modules gedekt, 8 gaten.**

| Fase | Ontbreekt |
|---|---|
| 0 — klank en schrift | `PHON-R` rollende en vocalische r (*vrt*, *prst*) |
| 1 — nominatief en werkwoordskader | `Q-WORDS` vraagwoorden, da/ne, li · `NEG-VERB` negatie ne + werkwoord |
| 4 — genitief | `GEN-NEG-IMATI` *nemam vremena* |
| dwarsdoorsnijdend | `ASPECT-PAIRS` aspect per werkwoordspaar · `CONDITIONAL` bih/bi/bismo · `ADJ-DEF` bepaald/onbepaald (*nov* / *novi*) · `SOUND-PALAT` palatalisatie |

`ASPECT-PAIRS` is de zwaarste van de acht: aspect is geen bijzaak in het Kroatisch en het staat nergens in de 21 lessen. Clitische woordvolgorde daarentegen wórdt gedekt (`g.13.red_klitika`).

---

## 5. Sectie B — Verhalen

### 5.1 Kernmechaniek: gegarandeerde i+1

Voor elk verhaal berekent het systeem, vóór het wordt aangeboden:

```
coverage = (aantal tokens waarvan het lemma in known_set zit) / totaal tokens
```

- **coverage < 95%** → verhaal wordt niet aangeboden (of vereenvoudigd)
- **coverage 95–98%** → ideaal; aanbieden
- **coverage > 99%** → te makkelijk, gebruik als vloeiendheidsherhaling

Voor het lemmatiseren: **CLASSLA-Stanza** (`pip install classla`, model `hr`) — dat is de state of the art voor Zuid-Slavische talen, met morfosyntactische tagging + lemmatisering, en veruit de beste optie voor Kroatisch. Alternatief/aanvulling: het `hrLex` inflectielexicon.

> Praktische noot: CLASSLA is een Python-package met modelbestanden (paar honderd MB). Draai het als een klein lokaal service-endpoint (FastAPI) dat je frontend/pipeline aanroept, zodat je het maar één keer hoeft te laden.

### 5.2 Verhalen in series (narrow reading)

Niet 50 losse verhaaltjes, maar **series** met vaste personages, plaats en thema. Reden: dan komen dezelfde woorden vanzelf 8–12 keer terug — precies wat nodig is voor verwerving — zonder dat het geforceerd voelt.

> **Bijgesteld (16-08-2026).** De oorspronkelijke opzet vroeg vijf series van 10–20 hoofdstukken. Dat is 10.000 tot 40.000 woorden gevalideerd Kroatisch, en daarmee veruit de grootste post van het hele plan — geschreven vóórdat er één keer bewezen is dat de leesloop werkt.
>
> **Er komt eerst één serie van 10 hoofdstukken van ongeveer 250 woorden.** Pas als die loop aantoonbaar werkt (coverage-meting klopt, gemijnde woorden komen terug in de reviews, begripsvragen doen wat ze moeten doen) wordt er geschaald. Het niveau van die eerste serie wordt bepaald ná de plaatsingstoets, niet nu — zonder gevulde `known_set` is elke niveaukeuze een gok.
>
> **Randvoorwaarde vóór het schrijven begint:** de bestaande verhalen halen hun eigen coverage-plafond niet. Met álle 894 woorden als bekend gerekend komen `ovo-je-nina` op 94,6%, `kljuc` op 95,5% en `bakina-kuharica` op 94,0% — onder of net op de 95%-grens, door gaten in hun glossaries. Een verhaal dat zijn eigen drempel niet kan halen, kan nooit als "goed leesbaar" gemeten worden. Die glossaries moeten eerst dicht.

Kandidaat-thema's voor latere series (gekozen op nut voor iemand die in/rond Kroatië is):
1. *Novi susjed* — verhuizen naar een dorp aan de kust: begroeten, wonen, buren (fase 1–2)
2. *Na tržnici* — markt, eten, boodschappen, getallen, hoeveelheden (fase 4: genitief!)
3. *Autobus u Split* — reizen, richtingen, tijd (fase 3: akk./lok.-contrast)
4. *Kod liječnika* — lichaam, gezondheid, datief-experiencer (`boli me…`) (fase 5)
5. *Prošlo ljeto* — vakantieverhaal in de verleden tijd (perfekt + aspect)

### 5.3 De leesloop per hoofdstuk

1. **Voorbereiding** — 5 nieuwe sleutelwoorden vooraf (pre-teaching verhoogt begrip aanzienlijk)
2. **Eerste lezing zonder hulp** — puur op betekenis, geen woordenboek
3. **Begripsvragen in het Nederlands** — betekenis eerst, altijd
4. **Tweede lezing met tap-to-gloss** — tik op een woord → lemma, vertaling, naamval/vorm-analyse, knop "voeg toe aan mijn woorden"
5. **Luisteren-terwijl-je-leest** — TTS-audio meelopend met tekstmarkering (dit koppelt klank aan schrift; erg effectief en goedkoop te bouwen)
6. **Focus on form** — 3–5 vragen over de doelstructuur: "waarom staat hier `kući` en niet `kuću`?"
7. **Mining** — geselecteerde woorden + de zin worden SRS-kaarten
8. **Hervertelling (optioneel, later)** — 3 zinnen zelf schrijven; LLM geeft feedback op vorm

### 5.4 Genereren of schrijven?

Genereren met een LLM is prima — **mits gevalideerd**. Zie §7. Nooit direct wat het model produceert aan jezelf voorschotelen: Kroatisch is een taal waar LLM's regelmatig Servische varianten, verkeerde aspectparen of te hoog niveau in mengen.

---

## 6. Sectie C — Woordenschat

### 6.1 Twee bronnen, één stroom

1. **Frequentie-backbone** — een gecureerde lijst van de ~2000 frequentste lemma's, in blokken van 100, gekoppeld aan het curriculum. Bron: frequentielijsten uit **hrWaC** (1,9 miljard tokens, CC BY-SA, downloadbaar via CLARIN.SI) of het Hrvatski nacionalni korpus. Filter handmatig op bruikbaarheid (webcorpora bevatten veel ruis: "kliknite", "korisnik").
2. **Mining uit verhalen** — alles wat je in een verhaal aantikt.

Streefgetallen: A1 ≈ 800–1000 lemma's, A2 ≈ 2000, B1 ≈ 3000–4000.

### 6.2 Kaarttypes (progressie per woord)

Een woord doorloopt stadia; elk stadium is een eigen SRS-item:

| Stadium | Kaart | Voorbeeld |
|---|---|---|
| 1 | **Herkenning** HR→NL | `kuća` → huis |
| 2 | **Cloze in context** | "Idem u ___ (huis)." → `kuću` ← test tegelijk vorm en betekenis |
| 3 | **Productie** NL→HR | huis → `kuća` |
| 4 | **Audio-herkenning** | 🔊 `kuća` → betekenis |
| 5 | **Collocatie/chunk** | `ići kući` (naar huis gaan — let op: bijzondere vorm!) |

Promoveer pas naar het volgende stadium als het huidige stabiel is (bijv. stability > 21 dagen).

### 6.3 Kroatisch-specifieke regels voor kaarten

- **Zelfstandige naamwoorden**: altijd mét geslacht op de kaart, en bij een onvoorspelbare stam ook de genitief ev. (`pas – psa`, `otac – oca`). Anders leer je een woord dat je niet kunt verbuigen.
- **Werkwoorden**: altijd als **aspectpaar** (`pisati / napisati`) én met de 1e persoon presens (`pišem`), want die is niet af te leiden. Eén kaart, drie stukjes informatie.
- **Chunks boven losse woorden bij preposities**: leer `s prijateljem`, `o filmu`, `kod kuće` als geheel. Voor een naamvalstaal is dit veel efficiënter dan losse preposities memoriseren.
- **Geen kale woordparen zonder context** — elke kaart bewaart de bronzin.

### 6.4 Leeches
Item met ≥6 lapses → uit de normale rotatie halen, en aanbieden voor "herstel": nieuwe context, mnemonic, of gewoon uitstellen. Nu blijft zo'n item eeuwig frustratie produceren.

---

## 7. Content-pipeline & kwaliteitsborging

**Dit is de sectie die het verschil maakt tussen een leuk prototype en iets waar je echt van leert.** Genereer content offline in een pipeline met validatiepoorten, sla het op als data, en serveer alleen gevalideerde content.

```
[LLM-generatie]
      ↓
[CLASSLA: tokenize + lemmatize + morfosyntactische tags]
      ↓
[Validatiepoorten]  ── faalt → regenereren met foutfeedback (max 3x) → anders naar review-queue
      ↓
[Opslaan in DB met coverage-stats]
```

**Validatiepoorten voor een verhaal:**

| Check | Criterium |
|---|---|
| Coverage | ≥95% tokens uit `known_set` ∪ `pre_taught` |
| Doelstructuur | ≥10 voorkomens van de doelgrammatica (gemeten op morfosyntactische tags, niet op tekst-matching) |
| Verboden structuren | 0 voorkomens van grammatica boven het huidige niveau (bv. geen aoristus, geen conditionaal in fase 2) |
| Lengte | binnen bandbreedte voor het niveau |
| Lexicon | elk lemma bestaat in hrLex / het eigen lexicon (vangt verzonnen woorden) |
| Servisme-check | woordenlijst-filter (`hleb/kruh`, `voz/vlak`, `talas/val`, `opšte/opće`, ekavische vormen) |
| Nieuwe woorden | ≤ N nieuwe lemma's, elk ≥3 keer voorkomend in het hoofdstuk |

**Validatiepoorten voor een grammatica-oefening:**
- Er is precies één correct antwoord (of alle correcte antwoorden staan in de sleutel)
- Afleiders zijn *plausibel*: gebruik echte verkeerde naamvalsvormen van hetzelfde woord, niet willekeurige woorden
- Alle woorden in het item staan al in `known_set` (anders test je woordenschat i.p.v. grammatica)

**Menselijke check:** bouw een simpel review-scherm waar je zelf (of een Kroatische kennis) items kunt goedkeuren/afkeuren/corrigeren. Content krijgt een status: `generated → validated → human_approved`. Serveer bij voorkeur alleen `human_approved` voor grammatica-uitleg.

---

## 8. De dagelijkse sessie

Zonder een vaste sessiestructuur wordt het weer een verzameling losse knoppen. Voorstel voor een sessie van 25–30 minuten:

```
1.  SRS-reviews (achterstallige kaarten)          ~8 min   ← altijd eerst
2.  Grammaticamodule (1 fase van de lesloop)      ~8 min
3.  Verhaalhoofdstuk + begripsvragen              ~8 min
4.  Nieuwe woorden uit dat hoofdstuk (5-10)       ~4 min
5.  Weakness-drill (top-3 uit de foutenlog)       ~3 min
```

Regels:
- Reviews hebben altijd voorrang op nieuw materiaal (anders groeit de schuld)
- Cap op nieuwe items per dag (start 8, aanpasbaar) — overbelasting is de #1 reden dat SRS-systemen sneuvelen
- Elke sessie eindigt met iets dat lukt (fluency-herhaling), niet met een nederlaag

Bouw ook een **"korte sessie" (10 min)**-modus: alleen reviews + 1 weakness-drill. Dan sla je op drukke dagen niet over.

---

## 9. Meten: welke voortgang telt

Vervang "aantal goede antwoorden" door:

- **Bekende lemma's** (per stadium: herkennend / productief)
- **Totaal gelezen woorden** — telt op, motiveert (streef naar 100.000+ in het eerste jaar)
- **Retentie** — % correct bij de eerste review na ≥7 dagen (dit is de echte maat; streef 85–90%)
- **Nauwkeurigheid per naamval** — een radardiagram over de 7 naamvallen legt precies bloot waar je zwak bent
- **Nauwkeurigheid per grammaticapunt** — voedt de weakness-drills
- **Coverage-niveau** — "je leest nu comfortabel op 96% bij B1-teksten"

---

## 10. Bouwplan voor Claude Code (gefaseerd)

Geef Claude Code **één fase per keer**. Niet alles in één opdracht — dan krijg je een half werkend geheel.

### Fase 0 — Fundering (breekt niets) — ✅ afgerond 16-08-2026

De oorspronkelijke Fase 0 ging uit van een codebase zonder FSRS. Die zat er al, en er was geen oude scheduler om uit te bouwen. Wat er wél moest gebeuren, en gebeurd is:

- [x] **0.1** Migratiereeks met `schema_migrations`, genummerde stappen in transacties, `npm run migrate`. De oude DDL is migratie 001 en blijft onveranderd.
- [x] **0.2** `card`-tabel tussen items en FSRS. `srs` en `review_log` hangen aan `card_id`. Eén woord kan nu een herkennings- én een productiekaart dragen, apart gepland. In Fase 0 krijgt elk item nog precies één kaart van zijn standaardsoort — het gedrag verandert niet, alleen de mogelijkheid ontstaat.
- [x] **0.3** `error_log` plus `classifyError()`: een fout antwoord wordt opgezocht in de vormcatalogus, zodat *wrong_case* van *wrong_number* van *diacritic* te onderscheiden is. `hintFor()` maakt daar een metalinguïstische hint van die het antwoord niet verklapt — trede 1 van de escalerende feedback.
- [x] **0.4** `content/curriculum.json` met de volledige §4.2-boom; alle 97 lespunten hebben een `code`. Zie §4.3 voor de dekking.
- [x] **0.5** Alle 92 verhaalzinnen hebben een vast id (`kljuc.p1.s3`) plus een `sentence`-tabel, zodat een gemijnd woord zijn bronzin kan vasthouden.
- [x] **0.6** `ts-fsrs` 4.7.1 → 5.4.1, dus FSRS-5.0 → **FSRS-6.0** (19 → 21 gewichten). Daarbij bleek `learning_steps` wel opgeslagen maar nooit gelezen of teruggeschreven; dat is nu gerepareerd.
- [x] **0.7** `analyze()` lokaal in plaats van CLASSLA — zie hieronder.
- [x] **A** `dueCount()` in de balk telde vervallen kaarten die de herhaalsessie niet kan serveren. Vervangen door `reviewableCount()`, met hetzelfde filter als `planReview()`.

**Acceptatie (`npm run check:fase0`, 12 controles):** een database van vóór de herbouw komt er ongeschonden doorheen; lege en bestaande database geven hetzelfde schema; migreren is herhaalbaar; één woord draagt twee onafhankelijk geplande kaarten; een accusatief waar de locatief moest levert `wrong_case` op met het juiste grammaticapunt en een hint zonder het antwoord; een fout in een échte oefening belandt onderweg in `error_log`; `analyze()` geeft lemma en naamval voor beide vormen van *kuća* en markeert wat het niet kent.

#### 0.7 — CLASSLA: interface nu, service later (besloten 16-08-2026)

De spec schreef een Python-service met CLASSLA voor. Dat is uitgesteld, en de reden is niet gemakzucht:

`/analyze` levert pas iets op zodra er tekst is waarvan de woordenlijst níet met de hand geschreven is. Zolang elk verhaal zijn eigen glossary draagt, doet de bestaande verbuigingsmotor het werk. Er nu een tweede runtime en een paar honderd megabyte modelbestanden bij halen, betekent dat `start.command` twee processen moet opstarten — voor een platform dat kort geleden nog struikelde over één Node-binary.

Wat er in plaats daarvan staat: `src/lib/analyze.ts`, met de vorm die CLASSLA ook zou hebben — `analyze(text) → {surface, lemma, feats, readings, unknown}[]`. Alles praat tegen die vorm, dus CLASSLA kan er in Fase 3 achter schuiven zonder dat één aanroeper verandert.

Twee eigenschappen zijn niet onderhandelbaar:

- **Per token een `unknown`-vlag.** Een ontleder die niet kan zeggen wat hij níet weet, is erger dan geen ontleder: onbekende woorden tellen dan stilzwijgend als bekend en je meet je leesdekking te hoog. Dit was geen theoretisch risico — `coverage.ts` deed het. Van de 566 lopende woorden in de vijf verhalen kregen er 24 gratis een vinkje, waaronder gewone inhoudswoorden als *problem*, *sekundi* en *litre*. Vier procent, en precies het verschil tussen 95% en 99%. Gerepareerd: onbekend telt niet als bekend.
- **Meerduidigheid blijft staan.** *kuće* is genitief enkelvoud, nominatief meervoud én accusatief meervoud. Alle lezingen blijven in `readings`; welke gekozen wordt, hangt af van het voorzetsel ervóór (`kod` regeert de genitief) — dezelfde naamvalsregering die de lessen onderwijzen.

**Vóór CLASSLA erachter schuift, wordt eerst de recall van de eigen implementatie op de bestaande verhalen gemeten.** Misschien is hij niet nodig.

### Fase 0.5 — Escalerende feedback (eerst, vóór alles wat oefeningen genereert)

De harde regel "feedback escaleert: hint → keuze → antwoord + uitleg" wordt op dit moment overal geschonden: bij een fout verschijnt meteen het juiste antwoord. Dat is de grootste gedragsmatige afwijking van de spec, en het is zinloos om oefeningen te gaan genereren die die fout op grotere schaal maken.

- [ ] Trede 1: de metalinguïstische hint uit `hintFor()` (bestaat al, wordt nog niet getoond)
- [ ] Trede 2: keuze uit 2–3 vormen, opgebouwd uit de vormcatalogus — echte verkeerde naamvalsvormen van hetzelfde woord, geen willekeurige woorden
- [ ] Trede 3: het antwoord met uitleg en een verwijzing naar de regel
- **Acceptatie:** een fout antwoord geeft nooit meteen de vorm; na drie tredes is het antwoord er wel; elke trede wordt vastgelegd, zodat "in één keer goed na een hint" te onderscheiden is van "pas na het antwoord".

### Fase 1 — Woordenschatsectie
- [ ] Kaarttypes 1–3, stadia-promotie, leech-afhandeling
- [ ] Frequentie-backbone importeren (top 2000 lemma's, gecureerd)
- [ ] Reviewscherm met FSRS-knoppen (Again/Hard/Good/Easy)
- **Acceptatie:** 30 dagen simuleren met een script en aantonen dat de planning klopt

### Fase 1.5 — Plaatsingstoets (naar voren gehaald)

Stond oorspronkelijk nergens; komt hier omdat de dekkingsmeter zonder gevulde `known_set` betekenisloos is en Fase 3 dan niet te beoordelen valt.

- [ ] **Diagnostisch per grammaticapunt**, geen enkel niveaucijfer. Het profiel is naar verwachting grillig: sommige naamvallen goed, aspect en clitische volgorde waarschijnlijk niet.
- [ ] **Woordenschat als adaptieve veeg over frequentiebanden** — start rond band 1000–1500, omhoog of omlaag op basis van de scores, tot de grens gevonden is. Geen vaste lijst van 100.
- [ ] Resultaat vult `known_set` én markeert elke module als `beheerst` / `onzeker` / `onbekend`.
- [ ] **Per module een "test je hieruit"-optie, ook later nog.** Wie tijdens een les merkt het toch niet te beheersen, moet de module kunnen terugzetten.
- [ ] **Status volgt altijd uit prestatie, nooit uit zelfinschatting.**
- **Acceptatie:** na de toets is per module een status vastgelegd die uit antwoorden is afgeleid; de leesdekking van de vijf verhalen verandert meetbaar mee.

### Fase 2 — Grammaticasectie
- [x] `curriculum.json` met alle modules uit §4.2 *(vooruitgelopen in Fase 0.4)*
- [ ] De 7-stappen-lesloop als herbruikbare component
- [ ] **De VanPatten-interpretatieoefening als eigen oefentype.** Je kiest de *betekenis*, niet de vorm: "Idem **u kuću**" tegenover "Sam **u kući**" → beweging of locatie? Dit ontbreekt nu volledig — alle bestaande keuzeoefeningen vragen naar de vorm. Zonder deze fase is er geen vorm-betekenis-koppeling vóór de productiedruk.
- [ ] Overige oefeningengenerator: invullen, transformatie, zinsbouw, clitic-volgorde-puzzel
- [x] `error_log` *(Fase 0.3)*; escalerende feedback is Fase 0.5
- [ ] Blocked → interleaved logica
- [ ] **De 5885 onbereikbare items aansluiten.** Van de 6290 items worden er maar 405 door een oefening aangesproken; geen enkele van de 5299 vormkaarten. Een vormkaart die vervalt kan de herhaalsessie nu niet serveren — dát is wat de generator moet oplossen, en tot die tijd verbergt `reviewableCount()` het eerlijk.
- **Acceptatie:** modules "Nominatief", "Akkusatief + animaatheid", "u/na + akk vs lok" volledig speelbaar; `unreachableDueCount()` staat op nul.

### Fase 3 — Verhalensectie
- [ ] Coverage-engine (`known_set` vs tekst)
- [ ] Verhaal-viewer: tap-to-gloss met morfologische analyse, mining-knop
- [ ] Begripsvragen + focus-on-form-vragen
- [ ] Eerste serie (10 hoofdstukken) gegenereerd + gevalideerd + door mens goedgekeurd
- **Acceptatie:** een hoofdstuk halen met gemeten coverage ≥95%, en 5 gemijnde woorden verschijnen de volgende dag in je reviews

### Fase 4 — Integratie
- [ ] Dagelijkse sessie-orchestrator (§8)
- [ ] Weakness-drills uit `error_log`
- [ ] Grammatica-van-deze-week wordt doelstructuur van het verhaal-van-deze-week
- [ ] Dashboard (§9)
- **Acceptatie:** één knop "start sessie" doorloopt alle vijf de blokken

### Fase 5 — Audio & productie
- [ ] TTS voor alle zinnen en woorden (cache als bestand, niet runtime)
- [ ] Luisteren-terwijl-je-leest met tekstmarkering
- [ ] Audio-kaarttype
- [ ] Schrijfopdrachten met LLM-feedback op vorm
- [ ] (Optioneel) spraakherkenning voor uitspraak

---

## 11. Wat je letterlijk aan Claude Code geeft

1. Zet **dit bestand** in je repo als `docs/REBUILD-SPEC.md`.
2. Maak/vul `CLAUDE.md` in de repo-root met de volgende regels:

```markdown
# Projectregels

Dit project bouwt een Kroatisch-leerplatform om volgens docs/REBUILD-SPEC.md.
Lees die spec vóór elke taak.

## Harde regels
- Content is DATA (DB/JSON), nooit hardcoded in componenten.
- Het SRS-algoritme is FSRS via een bestaande library. Nooit zelf schrijven of aanpassen.
- Alle drie de secties lezen en schrijven dezelfde knowledge state. Geen aparte voortgang per sectie.
- Kroatische content wordt NOOIT aan de gebruiker getoond zonder de validatiepoorten uit §7.
- Nooit een oefening genereren met woorden die niet in known_set zitten, tenzij het doel woordenschat is.
- Uitleg is in het Nederlands, doeltaalvoorbeelden in het Kroatisch (standaardkroatisch, geen Servische varianten).
- Feedback bij fouten escaleert: hint → keuze → antwoord + uitleg. Nooit meteen het antwoord.
- Elke wijziging aan het datamodel gaat via een migratie; bestaande review-historie mag nooit verloren gaan.

## Werkwijze
- Werk één fase uit §10 per keer. Vraag om bevestiging voordat je aan de volgende begint.
- Schrijf voor elke fase eerst de acceptatietest, dan de implementatie.
- Bij twijfel over Kroatische grammatica: markeer het item voor menselijke review, verzin niets.
```

3. Eerste opdracht aan Claude Code:

> Lees `docs/REBUILD-SPEC.md` en `CLAUDE.md`. Inventariseer eerst de huidige codebase: welke datastructuren, welke schermen, welk scheduling-mechanisme, wat kan hergebruikt worden. Geef me een korte analyse en een concreet migratieplan voor Fase 0. Nog niet implementeren.

---

## 12. Open keuzes — en de gemaakte keuzes

Stand 16-08-2026.

### 1. Niveau — beantwoord

> Ervaring met Kroatisch aanwezig, maar het platform moet **compleet zijn van nul tot eind**.

Dat zijn twee eisen die uit elkaar gehouden moeten worden, en dat onderscheid stuurt het hele ontwerp:

| | |
|---|---|
| **Het curriculum is compleet** | Élke module vanaf de basis staat in de boom. Geen gaten omdat "dat ken ik vast wel". Dit is een eigenschap van `curriculum.json`. |
| **Het pad erdoorheen is kort** | Waar de leerder al sterk is, wordt er niet doorheen gesleept. Dit is een eigenschap van de voortgangsstatus, niet van de content. |

Een module die je overslaat, verdwijnt dus niet — hij staat op `beheerst` en blijft zichtbaar en herhaalbaar.

Daaruit volgt de plaatsingstoets van Fase 1.5: diagnostisch per grammaticapunt, woordenschat als adaptieve veeg over frequentiebanden vanaf band 1000–1500, resultaat vult `known_set` én zet elke module op `beheerst` / `onzeker` / `onbekend`, met per module een "test je hieruit"-optie die ook later nog werkt.

> **Harde regel die hieruit volgt:** vertrouw de zelfinschatting niet. Modulestatus volgt altijd uit prestatie.

### 2. Doel — **open**
Lezen en schrijven, of ook spreken op termijn? Bij spreken schuiven audio- en productiekaarten naar voren. *Nog niet beantwoord; Fase 5 blijft voorlopig achteraan.*

### 3. Stack en tweede runtime — beantwoord
Next.js 15 / TypeScript / SQLite / `ts-fsrs`. **Geen tweede runtime nu.** CLASSLA is uitgesteld ten gunste van een lokale `analyze()`; zie §10, Fase 0.7. Met één toevoeging op de oorspronkelijke opzet: de `unknown`-vlag per token, want zonder die vlag telt `coverage.ts` onbekende woorden als bekend.

### 4. LLM-generatie — **open, met vastgelegde randvoorwaarden**
Of er gegenereerd wordt en met welk plafond, is nog niet beslist. Wat wél vaststaat: **alleen offline, in batch, en alleen als de gebruiker het zelf aanzet. Nooit tijdens een sessie.**

### 5. Native check — **open**
Is er iemand die Kroatisch spreekt en af en toe 20 items kan nakijken?

### 6. Lessen tegenover curriculum — beantwoord
Lessen blijven de bron en de volgorde; de curriculumlaag komt erbovenop. Zie §4.3.

### 7. Omvang van de verhalen — beantwoord
Eerst één serie van 10 hoofdstukken van ±250 woorden. Zie §5.2.

### 8. Werkend houden tijdens de verbouwing — beantwoord
Ja. Verbouwing, geen sloop. Elke fase moet het platform bruikbaar laten.

### 9. Bestaande voortgang — **open, veilige aanname gehanteerd**
Of de 34 kaarten en 62 reviews echte voortgang zijn of testdata, is niet bevestigd. **Aanname: behouden.** Weggooien kan altijd nog met de resetknop; terughalen niet.

---

## Bronnen

- Norris & Ortega (2000); Spada & Tomita (2010); Goo et al. (2015) — effectiviteit expliciete instructie
- VanPatten — processing instruction / structured input
- Hwang (2025), *Language Learning* — blocked-first-then-interleaved wint van pure interleaving
- Suzuki, Nakata & DeKeyser (2019) — desirable difficulty framework
- Hu & Nation (2000); Nation (2006); Laufer (2020); Schmitt et al. (2017) — 95/98% coverage
- Nation & Wang (1999); Pellicer-Sánchez & Schmitt (2010); Uchihara, Webb & Yanagisawa (2019) — aantal ontmoetingen
- FSRS — github.com/open-spaced-repetition (implementaties in TS, Python, Rust, Go)
- CLASSLA-Stanza — github.com/clarinsi/classla (lemmatisering + MSD-tagging voor Kroatisch)
- hrWaC 2.1 — clarin.si (CC BY-SA), 1,9 mld tokens, gelemmatiseerd → frequentielijsten
- hrLex 1.3 — inflectielexicon Kroatisch
