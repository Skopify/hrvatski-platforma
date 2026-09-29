# DESIGN.md: Hrvatski «Krabbel»

Status: **gebouwd.** Op 29 september 2026 gekozen door Antonio, na drie eerdere richtingen
die het niet waren («Nove tendencije», «Plakat», «Lagano»): "speels en uitdagend, soort
scribble-achtig webdesign, modern, met de juiste animaties — bijvoorbeeld dat je bij
voortgang een pill krijgt die dynamisch is". Ook: "de icoontjes vind ik niks, te AI en
generiek". Dit document beschrijft wat er in de code staat; bij verschil wint dit document
tot het is bijgewerkt.

## 1. Richting

Een schrift vol krabbels, maar strak gebouwd: stipjespapier, dikke inktlijnen, pastelvlakken,
harde schaduwen, en handgetekende details die zichzelf tekenen. Leren mag er leuk uitzien;
het blijft een studieomgeving.

- **Elke rand is een inktlijn van 2px, en elke hoek is een fractie scheef.** Alle
  `--radius-*` tokens hebben per hoek een andere waarde (`border-radius: a b c d / e f g h`),
  dus alles wat `rounded-*` gebruikt ziet er met de hand getekend uit, zonder dat een
  component er iets voor doet.
- **Wat je kunt aanraken heeft een harde schaduw.** Wijzen tilt hem 2px op, indrukken drukt
  hem terug op het papier. Dat is de hele interactietaal.
- **Kleur zit in pastelvlakken met donkere inkt** (10:1 of beter) en in één blauw voor alles
  wat klikbaar is.
- **Krabbels tekenen zichzelf**: een golf onder elke paginatitel, een pijl naar de knop.
- **Iconen zijn zelf ontworpen** (`doodles.tsx`), geen bibliotheek: een inktlijn met een
  gekleurde vlek die er een fractie naast ligt, door één SVG-filter (`#rough`) licht laten
  wiebelen.
- **Speels waar je kijkt, rustig waar je oefent.** De sessie blijft papier en inkt; alleen
  de voortgang en de feedback dragen kleur.

## 2. Kleur

Zes pastelstiften plus twee (`--color-pop-*`), altijd met donkere inkt (`on-pop`) erop.
Elke sectie heeft er een (`sections.tsx`): Overzicht sky, Grammatica lilac, Verhalen peach,
Schrijven pink, Lessen mint, Oefenen yellow, Woorden lime, Voortgang coral, Gesprek aqua.

| Token | Licht | Donker | Rol |
|---|---|---|---|
| `plane` | `#fbfaf7` | `#17161d` | papier (met stipjes) |
| `surface` | `#ffffff` | `#23212b` | kaart, invoer |
| `ink` / `-secondary` / `-muted` | `#1b1a22` / `#3f3c4a` / `#5f5c6b` | `#f5f2ea` / `#d3cfdf` / `#a9a5b8` | tekst |
| `outline` | `#1b1a22` | `#e9e5da` | alle omlijningen en harde schaduwen |
| `accent` / `accent-fill` | `#2f3fe0` / `#3b4cff` | `#8f9bff` / `#3b4cff` | klikbaar; vulling van de hoofdknop (wit op blauw 5,7:1) |
| `good` / `bad` / `warm` | `#0d7a44` / `#c4245f` / `#b34700` | `#5fdc9a` / `#ff7fa6` / `#ffa066` | goed, fout, reeks |

Alle tekst haalt WCAG AA in beide thema's. **Op een pastelvlak zijn de kleuren erbinnen
altijd de lichte-thema-waarden**, ook in het donker (`[class*="bg-pop-"] *` in
`globals.css`): de stiften blijven licht, dus de inkt erop blijft donker, een knop erin blijft
wit, en de omlijning erin blijft inkt. Het vlak zelf houdt zijn krijtrand in het donker.

## 3. Typografie

- **Bricolage Grotesque** (variabel, optische maat): koppen en interface. Gewicht 800,
  spatiëring -0,035em. Cijfers (`.num`) gelijke breedte.
- **Shantell Sans** (`.hand`): het handschrift van krabbels: datum, kleine notities,
  kopjes boven een blok, meta-regels. Nooit voor lopende tekst; minimaal 13px.
- **Literata** (`.reading`): verhalen en alle lange Kroatische tekst, want dikke kopletters
  lezen slecht over meerdere regels en de diakritische tekens moeten rustig staan.

Alle letters zelf gehost met Latin Extended (č ć đ š ž). Geen externe verzoeken.

## 4. Vorm, diepte en materiaal

- Kaarten: 2px inktrand, geen schaduw. Klikbare kaarten (`card-lift`): 3px harde schaduw,
  bij wijzen 5px en 2px omhoog, bij indrukken 1px en 2px omlaag.
- Knoppen: vette pillen met inktrand en 3px harde schaduw. Blauw gevuld = hoofdactie, wit =
  tweede keuze.
- Invoer (`.input`): inktrand, 3px schaduw; bij focus komt hij los en krijgt een blauwe schaduw.
- Stickers: `pill`, `SectionSticker` en de iconen liggen een fractie scheef (`tilt-*`,
  `rotate`) en komen recht als je erop wijst (alleen met muis).
- Geen glas en geen zachte schaduwen. Het enige verloop in de code is het stipjespatroon.

## 5. Componenten

- `PageHeader`: sticker van de sectie, grote titel, golf eronder in de diepe tint van de
  sectie, dan de inleiding. Bij scrollen krimpt de titel naar een balk bovenaan.
- `Doodle`, `Squiggle`, `Arrow`, `Sparkle`: `doodles.tsx`. De golf is een herhalend patroon
  (mask), dus even fijn bij elke breedte.
- Navigatie: zijbalk (tablet en groter) en een sticker-strook onderaan (telefoon). Het actieve
  item is een blok in de stift van zijn sectie dat naar het nieuwe item schuift en van kleur
  wisselt.
- **`PillMeter`** (dagdoel, woorden, niveau): een dikke pill die als gel meegeeft. Het
  vulstuk is altijd even breed als de pill en schuift met `translateX` naar binnen, met een
  kleine overshoot. Stijgt de waarde, dan veert de pill mee en zweeft er een sticker "+12"
  uit.
- **`StepTiles`** (sessievoortgang): één pill in stukjes, één stukje per opgave. Een
  beantwoorde opgave vult zich van links in mint (goed), geel (bijna) of roze (fout); de hele
  pill geeft even mee. Het huidige stukje heeft een stip.
- **`XpChip`**: gele sticker die opspringt als er XP bijkomt.
- Feedback in een sessie: pastelvlak (mint / geel / roze) met inktrand en harde schaduw, met een
  XP-sticker die binnenspringt en blijft liggen.
- `CommandMenu` (⌘K of `/`): overal vandaan naar een pagina, les, verhaal of onderwerp.
  Zoekt zonder dakjes. Opent zonder animatie.
- `Island`: gele melding bovenaan die openvouwt ("Bewaard voor herhaling").
- `Celebrate`: confetti in de stiftkleuren, één keer per dag bij het dagdoel.

## 6. Beweging: elke animatie heeft een reden (Emils `animate`-skill)

Poortwachter per moment: hoe vaak zie je het, en wat vertelt het.

| Moment | Wat | Duur / curve | Waarom |
|---|---|---|---|
| Volgende vraag na Enter | **niets** | 0 | honderden keren per dag, met het toetsenbord |
| Zoekvenster openen | **niets** (alleen aan/uit) | 0 | toetsenbordactie, honderden keren per dag |
| Indrukken (knop, kaart, veld) | 3px omlaag, schaduw weg | 60ms ease-out | de app hoort je op het moment van aanraken |
| Wijzen (alleen muis) | 1–2px omhoog, schaduw groeit | 140–160ms ease-out | laat zien wat je kunt pakken |
| Dieper in een sectie / terug / andere sectie | van rechts / van links / omhoog vervagen | 280 / 280 / 220ms ease-out | waar je heen ging |
| Menu-blok | schuift naar het nieuwe item, kleur wisselt | 280ms ease-in-out | waar je vandaan komt |
| Golf onder de titel | veegt van links naar rechts | 380ms ease-out | kort, elke pagina |
| Pill (dagdoel, woorden, niveau) | vulstuk veert op zijn plek, pill geeft mee | 520ms overshoot-curve | bevestigt dat er iets bijkwam |
| "+n" bij toename | zweeft omhoog en verdwijnt | 900ms ease-out | laat zien hoeveel |
| Sessiepill | stukje vult zich, pill geeft mee | 380 + 520ms | het antwoord telde |
| XP-sticker | springt op | 320ms overshoot | idem |
| Goed / fout antwoord | paneel komt omhoog / het "nee"-schudden | 300 / 320ms | herkenbaar, zonder alarm |
| Woordpaneel | van onderen in, naar onderen uit | 460 / 260ms drawer-curve | hetzelfde pad heen en terug |
| Leesstand-schakelaar | duim schuift | 260ms ease-in-out | één keuze uit twee |
| Melding (eiland) | vouwt open van het midden | 420ms drawer-curve | occasioneel |
| Grafieken en balken | tekenen zich één keer | 420–900ms | een meting die binnenkomt |

Overshoot (`--ease-back`) alleen op de pills en de XP-sticker: de speelse momenten waar de
gebruiker om vroeg. Al het andere gebruikt de sterke ease-out uit Emils skill. Alleen
`transform` en `opacity` bewegen (plus `clip-path` voor de golf).

**Minder beweging:** geen verschuiven, gel, schudden, tekenen of zweven; wel korte fades en
kleurwissels. Pills en de golf staan meteen op hun eindstand. Hover geeft geen verschuiving.

**Techniek:** geen nieuwe bibliotheek. CSS-transities en -animaties; WAAPI voor de gel en de
XP-sprong, zodat een tweede antwoord vlak na het eerste de animatie opnieuw start in plaats
van te haperen.

## 7. Waar wat staat

- Tokens, klassen (`card`, `btn`, `input`, `pill`), pastelscope en beweging: `src/app/globals.css`
- Iconen en krabbels: `src/components/doodles.tsx` · secties en stiften: `sections.tsx`
- Pills: `PillMeter.tsx`, `StepPill.tsx`, `XpChip.tsx`
- Kop en navigatie: `PageHeader.tsx`, `Nav.tsx` · overgangen: `app/template.tsx`
- Zoeken, meldingen, feest: `CommandMenu.tsx`, `Island.tsx`, `Celebrate.tsx`, `CountUp.tsx`
- Overzicht: `src/app/page.tsx` · 404 en laden: `app/not-found.tsx`, `app/loading.tsx`

Routes, inhoud, teksten en functies zijn niet veranderd.
