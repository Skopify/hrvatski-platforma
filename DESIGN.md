# DESIGN.md: Hrvatski «Plakat»

Status: **gebouwd.** Op 29 september 2026 gekozen door Antonio ("meer gewaagd, durf het
roer om te gooien"), uit twee richtingen: *Zagreb Noć* (donkere 3D-ruimte) of *Plakat*
(Zagrebse affiche). Vervangt «Nove tendencije» van een dag eerder. Dit document
beschrijft wat er in de code staat; bij verschil wint dit document tot het is bijgewerkt.

## 1. Richting

De Zagrebse affiche: EXAT 51, Ivan Picelj, Vjenceslav Richter, de posters van Nove
tendencije en de Zagrebse tekenfilmschool. Drie drukinkten (rood, blauw, geel) plus
zwart en papier. Volle vlakken, harde randen, letters die de hele breedte pakken,
geometrie als beeld.

- **Elke sectie is een affiche in een eigen kleur.** De paginakop is een geplakt
  kleurvlak met de titel van rand tot rand. Je ziet aan de kleur waar je bent.
- **Het overzicht is een mozaïek van vlakken**: rood (vandaag en de volgende stap),
  blauw (het šahovnica-veld), geel (dagdoel), zwart (reeks), papier (kerncijfers) en
  één lange rangbalk.
- **3D als grafisch object**: een kubus in de affichekleuren in elke kop, het logo
  als šahovnica-kubus, en een rond eiland van 3D-tegels dat in een blauw vlak zweeft
  (de cirkel in het vierkant, hét motief van de Zagrebse affiche).
- **Luid waar je kijkt, rustig waar je leert.** Sessies en verhalen blijven papier,
  inkt en Literata; alleen de voortgangstegels dragen kleur.

## 2. Kleur

| Token | Licht | Donker | Rol |
|---|---|---|---|
| `crvena` | `#d4190f` | idem | rood vlak; Grammatica, Oefenen, Fouten; overzicht "vandaag" |
| `plava` | `#1f3fd6` | idem | blauw vlak; Verhalen, Woorden, Plaatsingstoets; het veld |
| `zuta` | `#ffcf1a` | idem | geel vlak; Schrijven, Voortgang; dagdoel, selectie |
| `crna` | `#121212` | `#f2f2ec` | zwart vlak; Lessen, Nakijken; reeks. In donker wordt het een papieren vlak |
| `papir` | `#fbfbf7` | `#121212` | papier op een vlak |
| `plane` / `surface` | `#f2f2ec` / `#fbfbf7` | `#121212` / `#1b1b1b` | ondergrond / vel |
| `ink` | `#121212` | `#f2f2ec` | tekst én alle lijnen |
| `accent` | `#1f3fd6` | `#7d93ff` | klikbaar, geselecteerd, voortgang |
| `good` / `bad` | `#0b7a45` / `#c4170f` | `#4fce8f` / `#ff6b5e` | goed / fout in sessies |

Tekst op vlakken: papier op rood (5,1:1) en blauw (7,4:1), inkt op geel (12,7:1). Alle
tekstkleuren op papier halen minstens 4,8:1. De sectiekleuren staan in
`src/lib/secties.ts`; een blok zet `tone-<kleur> block-tone` en gebruikt `--tone`,
`--on-tone` en `--tone-2` (de tweede kleur, voor schaduwen op dat vlak).

## 3. Typografie

- **Archivo** (variabel: breedte 62–125, gewicht 100–900) voor alles behalve lezen.
  - `.poster-title`: breedte 125, gewicht 900, kapitalen, regelafstand 0,86.
    `FitTitle` rekt hem op tot de breedte van zijn blok (max 220px).
  - `.display`: breedte 118, 820, gewone letters. Kroatische titels blijven in
    gewone letters, zodat je de schrijfwijze ziet.
  - `.label-caps`: 11,5px, 800, kapitalen, spatiëring 0,08em, voor etiketten.
  - `.num`: breedte 78, 800, gelijke cijfers, voor alle getallen.
  - Knoppen: kapitalen, breedte 112, 800.
- **Literata** voor verhalen en leestekst.

## 4. Vorm en diepte

- **Alles recht.** Alle radii staan op 0 (`--radius-*` in `@theme`). Alleen wat echt
  rond is (tellers, de afspeelknop) is een cirkel.
- **Lijnen zijn inkt**: kaarten 2px, affichevlakken 3px. Alleen rasterlijnen in
  grafieken zijn zacht.
- **Geen zachte schaduwen.** Wat je kunt pakken, komt bij hover los van het papier:
  4px verschoven, met een harde schaduw van 6px in inkt. Knoppen krijgen een rode
  schaduw, op een kleurvlak de tweede kleur van dat vlak. Indrukken zet alles terug
  op het papier.
- **Geen gradients, geen glas, geen gloed.** Het enige "verloop" in de code is het
  dambordpatroon van de logokubus.

## 5. Componenten

- `PageHeader`: affichevlak in de sectiekleur, klein dambord linksboven, kubus
  rechtsboven, `FitTitle` onderaan; de inleiding staat eronder op papier.
- `FitTitle`: kop die zijn blok vult; te lange titels mogen over meer regels.
- `PosterCube`: CSS-kubus met zes vlakken (rood, blauw, geel, papier, šahovnica, zwart).
- `SahovnicaVeld`: WebGL2-eiland van 3D-tegels met affichebelichting (drie vlakke
  tinten, geen verloop). Opgetilde en verdiende tegels slaan geel aan.
- `DayTiles`: 12 tegels die omklappen naar rood en zwart op het gele vlak.
- `StepTiles`: voortgang in een sessie; de huidige tegel geel met inktrand, klaar =
  omgeklapt naar groen, goud of rood.
- Navigatie: zwarte strook met een gele rand; het actieve item is een blok in de
  kleur van zijn sectie dat naar het nieuwe item schuift en onderweg van kleur wisselt.

## 6. Beweging

| Moment | Wat | Duur / easing | Waarom |
|---|---|---|---|
| Paginakop | het kleurvlak veegt van links naar rechts (`clip-path`), de titel volgt | 620ms in-out, titel 520ms na 260ms | een affiche die geplakt wordt: zegt "nieuwe pagina" |
| Dambord in de kop | vakjes klappen één voor één omhoog | 620ms, 28ms per vak | kinetisch raster |
| Kubus | draait mee met het scrollen; kwartslag bij hover | scrollgebonden / 900ms | een object in de ruimte, geen plaatje |
| Blokken en kaarten laden | schuiven 8px omhoog, na elkaar | 360ms, 45ms per blok, max 6 | het mozaïek bouwt zich op |
| Kaart of knop onder de muis | los van het papier met harde schaduw | 140–180ms ease-out | laat zien wat je kunt pakken |
| Indrukken | terug op het papier | 60–80ms | directe bevestiging |
| Navigatieblok | schuift naar het nieuwe item en wisselt van kleur | 380ms in-out | waar je vandaan komt en heen gaat |
| Šahovnica-veld | golft; tegels onder de cursor slaan geel aan; klik = rimpeling | live, gedempt | het ene grote 3D-moment |
| Dagdoel | nieuwe tegels klappen om | 520ms, 34ms per tegel | alleen wat sinds je vorige bezoek bijkwam |
| Antwoord in sessie | tegel klapt om naar groen/goud/rood | 520ms | directe feedback |
| Grafieken en balken | tekenen zich, groeien, heatmap bouwt diagonaal op | 420–900ms | een meting die binnenkomt |

Bewust niet: de volgende vraag na Enter komt direct; geen scroll-animaties behalve de
kubus; geen eindeloze lussen buiten het veld; het vlammetje flakkert één keer.

**Minder beweging:** vegen, verschuiven, kantelen, draaien en schudden vervallen;
fades en kleurwissels blijven. Hover geeft geen verschuiving en geen schaduw meer.
Het veld is één stilstaand beeld.

**Techniek:** geen nieuwe bibliotheek. Het veld is ruwe WebGL2 met instancing en
tekent alleen in beeld. De rest is CSS: `clip-path`, `perspective`,
`backface-visibility`, en `animation-timeline: scroll()` waar de browser het kent.

## 7. Waar wat staat

- Tokens, tonen, typografie, componentklassen, 3D en beweging: `src/app/globals.css`
- Sectiekleuren: `src/lib/secties.ts`
- Kop: `PageHeader.tsx`, `FitTitle.tsx`, `PosterCube.tsx`
- Overzicht: `src/app/page.tsx` · veld: `SahovnicaVeld.tsx` · dagdoel: `DayTiles.tsx`
- Tegels, dambord: `ui.tsx` · navigatie en logokubus: `Nav.tsx` · thema: `ThemeToggle.tsx`
- 404 en laden: `app/not-found.tsx`, `app/loading.tsx`

Routes, inhoud, teksten en functies zijn niet veranderd.
