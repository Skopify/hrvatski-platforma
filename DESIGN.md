# DESIGN.md: Hrvatski «Nove tendencije»

Status: **gebouwd (fase 3).** Op 28 september 2026 bijgestuurd op verzoek: "super
modern, 3D-achtig, ga helemaal los". Dit document beschrijft wat er nu in de code staat.

## 1. Richting

Zagreb was tussen 1961 en 1973 het centrum van *Nove tendencije*: kinetische kunst,
optische rasters en de eerste computerkunst van Europa. Dat is een futurisme dat uit
Kroatië zelf komt, en het past bij een leerplatform: strakke rasters, precieze
lijnen, één heldere kleur, en beweging die iets laat zien in plaats van iets te
versieren.

De šahovnica is hierin geen losse versiering meer, maar het raster zelf, en het is
driedimensionaal:

- **Het šahovnica-veld** (overzicht, 404): een live WebGL-veld van 900 rood-witte
  tegels dat golft als de Adriatische zee. Tegels rijzen op onder de cursor en vangen
  het accent; een klik stuurt een rimpeling door het veld; tegels in het midden
  gloeien naarmate het dagdoel vol raakt. Dit is het ene grote idee; de rest van de
  interface is er de rustige omlijsting van.
- **Tegels die kantelen**: het dagdoel (12 tegels), de sessievoortgang (één tegel per
  opgave, die omklapt naar groen, goud of rood) en de merkband boven elke kop.
- **Kaarten als objecten**: ze kantelen mee met de muis en vangen licht waar de cursor staat.
- **Het logo als kubus** met zes kanten šahovnica, die een kwartslag draait bij hover.

Onderzoek vooraf (september 2026): de sterkste 3D-sites van dit jaar (Lusion, Hubtown,
Oryzo, Iventions, Shopify Editions) kiezen één hard idee en budgetteren alles daaromheen,
laten objecten met gedempte traagheid op de cursor reageren, gebruiken mist en licht
voor diepte, en tekenen alleen wat zichtbaar is. Die vier regels staan hierin.

- Soort interface: **gebruiken en lezen** (sessies, drills, verhalen), geen marketingpagina.
- Spektakel op het overzicht, rust waar je leert. In een sessie of verhaal beweegt
  alleen wat feedback geeft.
- Licht en donker zijn allebei volwaardig. Standaard volgt de app het systeem.

## 2. Kleur

Eén accent (Jadran-blauw) voor alles wat je kunt aanklikken en voor voortgang.
Rood is alleen de šahovnica. Groen en rood-inkt zijn betekeniskleuren (goed/fout),
geen accenten. Oranje is alleen de reeks.

| Token | Licht | Donker | Rol |
|---|---|---|---|
| `plane` | `#f3f4f1` | `#0d0f12` | ondergrond |
| `surface` | `#fcfcfb` | `#15181c` | kaart, invoer |
| `sunken` | `#e9ebe6` | `#1c2025` | lege vakjes, sporen, tags |
| `line` | `#dde0da` | `#272c33` | haarlijnen, kaartranden |
| `line-strong` | `#c3c8bf` | `#394049` | invoerranden |
| `ink` | `#111418` | `#eceef1` | tekst |
| `ink-2` | `#434a53` | `#b2b9c2` | lopende tekst, uitleg |
| `ink-3` | `#5f6771` | `#8f97a2` | bijschriften (haalt AA, in tegenstelling tot de oude `ink-muted`) |
| `accent` | `#1d4fd8` | `#7ea4ff` | links, actieve staat, voortgang |
| `accent-fill` | `#1d4fd8` | `#3563e9` | vulling primaire knop (witte tekst) |
| `accent-wash` | `#e7edfc` | `#16213a` | actieve navigatie, geselecteerd woord |
| `good` / `good-wash` | `#0d7042` / `#e3f3ea` | `#4cc98c` / `#10271c` | goed antwoord |
| `bad` / `bad-wash` | `#c0262d` / `#fbe9e9` | `#ff7a7a` / `#2c1417` | fout antwoord |
| `warm` | `#b4400b` | `#ff9a5c` | reeks |
| `flag` | `#d81e2c` | `#ef3b47` | šahovnica, logo |

Gemeten contrast (WCAG): elke tekstkleur haalt minimaal 4.5:1 op `plane`, `surface`
én `sunken`, in beide modi. Witte tekst op `accent-fill`: 6.6:1 licht, 5.1:1 donker.

Donker is grafiet, geen navy: de neutrale tinten hebben nauwelijks blauw, zodat het
niet terugvalt op de donkerblauwe vlakken die eerder zijn afgewezen.

### Effecten: alleen waar ze iets doen

- **Geen decoratieve gradients** (geen verlopen achtergronden, geen verlooptekst). Wel
  als lichtval: de glans op een kantelende kaart, en maskers die het 3D-veld laten
  oplossen in de kaart eromheen.
- **Gloed: in donker** op de primaire knop. In het donker is licht de manier om te
  zeggen "dit is de volgende stap"; in licht doet een getinte schaduw dat werk.
- **Glas: alleen lagen waar de pagina onderdoor loopt**: de zwevende navigatie op de
  telefoon en het woordpaneel bij verhalen. Bij `prefers-reduced-transparency`: effen
  `surface`.

## 3. Typografie

Twee families, elk met een taak.

- **Archivo** (variabel, breedte-as 62–125 en gewicht 100–900): koppen en interface.
  - Koppen breed (`wdth` 112–118, gewicht 700–750, spatiëring -0.02 tot -0.03em). Dat
    brede, strakke gezicht is het "futuristische" deel.
  - Interface normaal (`wdth` 100, 400–600).
  - Getallen smal met gelijke breedte (`wdth` 78, `tabular-nums`), voor XP, tellers
    en tijden: het leest als een instrument.
- **Literata** (blijft): Kroatische leestekst in verhalen en sessievragen.

Fraunces en Plus Jakarta Sans verdwijnen. Beide staan op de lijst van meest gebruikte
AI-letters, en Fraunces geeft Old Style-cijfers ("1.596" zakt onder de regel) die op
de voortgangspagina rommelig ogen. Alles blijft zelf gehost, met Latin Extended voor
č, ć, đ, š en ž.

### Schaal (vervangt de 30 losse maten in de code)

| Token | Grootte / regelhoogte | Gebruik |
|---|---|---|
| `text-xs` | 12 / 16 | tags, badges |
| `text-sm` | 13 / 20 | bijschriften, meta |
| `text-base` | 15 / 24 | interface, uitleg |
| `text-lg` | 17 / 26 | invoer, sessievragen (Archivo) |
| `text-read` | 19 / 32 | verhalen (Literata) |
| `text-h3` | 18 / 24 | kaarttitels |
| `text-h2` | 22 / 28 | sectiekoppen |
| `text-h1` | clamp(34px, 4.5vw, 48px) / 1.04 | paginakop |
| `text-num-lg` | 30 / 1 | kerncijfers |

Minimum voor tekst die je moet lezen: 12px. Navigatielabels op de telefoon: 11px
(was 8.5px).

## 4. Ruimte, vorm, diepte

- **Ruimteschaal** (4px-basis): 4, 8, 12, 16, 24, 32, 48, 64. Tussen secties 48,
  binnen een kaart 24, tussen verwante regels 8 of 12.
- **Radii** (vaste regel): `r-sm` 8px voor letterknoppen (č ć š), `r-md` 12px voor
  knoppen, invoer en tegels, `r-lg` 16px voor kaarten, volledig rond alleen voor tags
  en telbadges. Geen pil-knoppen meer: ze vloeken met het raster.
- **Diepte**: kaarten krijgen een haarlijn en een heel lichte getinte schaduw (licht),
  of alleen een lijn met een binnenlichtrand (donker). Niet alles wordt een kaart: de
  vier losse statistiekkaarten worden één strook met haarlijnen.
- **Paginabreedtes** blijven zoals ze zijn (`Page` wide/detail/focus, `PageHeader`
  voor elke kop). Elke pagina gebruikt ze, geen losse `max-w-*`.

## 5. Componenten

- **Knop primair**: `accent-fill`, witte tekst, 44px hoog, `r-md`. Eén per scherm.
- **Knop secundair**: `surface` met lijn; bij hover accentlijn en accenttekst.
- **Tag**: 24px hoog, rond, `sunken` of `accent-wash`. Nooit op een afbeelding.
- **Invoer**: 48px hoog, `r-md`, `line-strong`. Goed: `good`-rand en `good-wash`. Fout:
  `bad`-rand en `bad-wash`.
- **Letterbalk** (č ć š ž đ): 40px tegels, `r-sm`.
- **Dagdoel-šahovnica** (`DayTiles`): 12 tegels (6×2), één per twaalfde van het
  dagdoel, in het dambordpatroon (rood vol / rood omlijnd). Vervangt de ring.
- **Sessievoortgang** (`StepTiles`): één tegel per opgave. Klaar = omgeklapt naar goed
  (groen), bijna (goud) of fout (rood); het huidige vakje heeft een accentrand.
- **Šahovnica-veld** (`SahovnicaVeld`): alleen op het overzicht en de 404.
- **Woorddekking** bij verhalen: neutrale balk (`ink-3`) met een streepje op de
  drempel voor vlot lezen. Geen rood meer: 70% dekking is geen alarm.
- **Navigatie**: rail links (desktop, nu *sticky* zodat hij niet wegscrolt), zwevende
  glazen balk onderaan (telefoon). De actieve markering schuift naar het nieuwe item.
- **Lege staat, laden, fout**: elke lijst heeft een lege staat die zegt wat er komt en
  hoe. Nieuw: een eigen 404-pagina en laadskeletten in de vorm van de echte inhoud.

## 6. Beweging

### Tokens

| Token | Waarde | Voor |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | alles wat verschijnt of reageert |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | iets dat op het scherm verschuift |
| `--dur-press` | 120ms | indrukken |
| `--dur-quick` | 160ms | hover, kleur, popover |
| `--dur-base` | 220ms | vakjes, invoerstaat, paginawissel |
| `--dur-slow` | 480ms | grafiek die zich tekent (één keer) |

Geen verende overshoot meer (de oude `--ease-spring` gaat eruit). Alleen `transform`
en `opacity` bewegen; kleuren mogen overvloeien.

### Wat beweegt, en waarom

| Moment | Wat | Duur / easing | Waarom |
|---|---|---|---|
| Knop indrukken | `scale(0.97)` | 120ms ease-out | bevestigt dat de klik aankwam |
| Hover kaart/knop | lijnkleur en tekstkleur, geen optillen | 160ms ease | laat zien wat klikbaar is, zonder springen; alleen op apparaten met muis |
| Pagina openen | inhoud kantelt uit de diepte naar voren (`rotateX 5°→0`, 14px, fade) | 360ms ease-out | geeft de nieuwe pagina een begin; blokkeert nooit klikken |
| Merkband boven een kop | vakjes klappen één voor één omhoog | 620ms, 28ms per vakje | kinetisch raster; zegt "nieuwe pagina" |
| Kaart onder de muis | kantelt mee (max ±4,5°) en vangt licht | direct; terug in 500ms | kaarten voelen als objecten die je kunt pakken |
| Logokubus | draait een kwartslag | 900ms ease-in-out | een merk dat je kunt aanraken |
| Šahovnica-veld | golft continu; tegels rijzen onder de cursor; klik = rimpeling | live, gedempt nagestuurd | het ene grote 3D-moment van de app |
| Navigatie-markering | schuift naar het nieuwe item | 250ms ease-in-out | laat zien waar je vandaan komt en heen gaat |
| Dagdoel vullen | nieuwe tegels klappen om (`rotateX 180°`) | 520ms ease-out, 34ms per tegel | toont wat je vandaag hebt verdiend; alleen de tegels die er sinds je laatste bezoek bij kwamen |
| Antwoord gegeven | tegel in de voortgang klapt om naar groen/goud/rood | 520ms ease-out | directe feedback, en je ziet de sessie vorderen |
| Antwoord fout | invoer kleurt rood + korte duw van 4px | 250ms ease-out | "dit klopt niet", zonder alarm |
| Woord aantikken | uitleg schaalt vanaf het woord open (`0.96→1`) | 160ms ease-out | de uitleg hoort zichtbaar bij dat woord |
| Venster openen (voortgang wissen) | fade + `scale(0.97→1)`, vanuit het midden | 200ms ease-out; dicht 150ms | duidelijk dat er iets bovenop ligt |
| Grafieken en balken | lijn tekent zich, balken groeien, de heatmap bouwt zich diagonaal op | 420–900ms ease-out, één keer bij laden | leest als een meting die binnenkomt |
| Reeks omhoog | vlammetje flakkert één keer | 600ms | viert iets wat echt gebeurde |

### Wat bewust niet beweegt

- **Volgende vraag na Enter**: direct, geen overgang. Dit gebeurt honderden keren per
  dag; elke animatie zou de sessie trager laten voelen.
- **Letterknoppen** (č ć š) alleen een indrukeffect, verder niets.
- **Geen scroll-animaties**: je scant deze pagina's dagelijks, en inhoud die pas bij
  scrollen verschijnt vertraagt dat.
- **Geen eindeloze lussen** buiten het 3D-veld. Het vlammetje flakkert één keer.
- **Kantelen alleen met een muis.** Op een touchscreen zou een tik de kaart laten
  kantelen in plaats van openen.

### Minder beweging (`prefers-reduced-motion`)

Minder, niet niets. Alle verschuivingen, schalen, duwtjes en trapsgewijze
verschijningen vervallen. Kleur- en fade-overgangen blijven (max 160ms), zodat goed/fout
en de actieve staat nog steeds zichtbaar wisselen. Het dagdoel staat meteen gevuld,
kaarten kantelen niet, en het 3D-veld is één stilstaand beeld.

### Techniek

Geen nieuwe bibliotheek.
- 3D-veld: ruwe WebGL2 met instancing (één kubus, 900 keer in één draw call). Tekent
  alleen als het in beeld is en het tabblad zichtbaar is; pixelverhouding maximaal
  1,75; zonder WebGL2 blijft het vlak leeg en werkt de pagina gewoon. Three.js zou
  150 kB toevoegen voor één kubus.
- Kantelen: één luisteraar voor de hele app (`TiltLayer`), transform rechtstreeks op
  de kaart.
- De rest is CSS (`perspective`, `rotateX/Y`, `backface-visibility`), die buiten de
  hoofdthread draait en soepel blijft terwijl een pagina laadt.

## 7. Waar wat staat

- Tokens, letters, 3D- en motieklassen: `src/app/globals.css`
- Thema (volgt het systeem tot je zelf kiest): `ThemeToggle.tsx` + script in `layout.tsx`
- 3D-veld: `SahovnicaVeld.tsx` · kantelen: `TiltLayer.tsx` · dagdoel: `DayTiles.tsx`
- Tegels en merkband: `ui.tsx` (`StepTiles`, `Checker`) · navigatie en logokubus: `Nav.tsx`
- Pagina-ingang: `app/template.tsx` · 404 en laden: `app/not-found.tsx`, `app/loading.tsx`

Routes, inhoud, teksten en functies zijn niet veranderd.
