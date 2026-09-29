# DESIGN.md: Hrvatski «Lagano»

Status: **gebouwd.** Op 29 september 2026 gekozen door Antonio, met een voorbeeld van een
strakke app-site erbij: "iOS-achtige stijl, maar beter, met logische animaties". Vervangt
«Plakat» (affiche, die was het niet) en «Nove tendencije» (3D-veld). Dit document
beschrijft wat er in de code staat; bij verschil wint dit document tot het is bijgewerkt.

## 1. Richting

"Lagano": licht, zonder moeite. Niet een telefoon nagebootst, maar de logica van iOS:

- **De letter van het apparaat** (SF Pro op Mac en iPhone). Die heeft optische maten en
  spatiëring per grootte al ingebouwd. Alleen de leesletter (Literata) wordt meegeleverd.
- **Witte kaarten op een lichtgrijze grond**, zoals gegroepeerde lijsten in Instellingen.
- **Glas voor wat boven de inhoud zweeft**: de titelbalk, de tabbalk, de zijbalk en het
  woordpaneel. De pagina loopt eronder door.
- **Beweging die vertelt waar je bent** (zie §6). Indrukken reageert meteen.
- **Een grote titel per pagina**, die bij scrollen klein in de glazen balk verschijnt.
- **Het overzicht als widgets**, met het dagdoel als ring zoals in de Activiteit-app.

## 2. Kleur

| Token | Licht | Donker | Rol |
|---|---|---|---|
| `plane` | `#f2f2f7` | `#0b0b0c` | gegroepeerde achtergrond |
| `surface` | `#ffffff` | `#1c1c1e` | kaart |
| `sunken` | `#ececf1` | `#2c2c2e` | grijze knop, spoor, segmented control |
| `ink` / `-secondary` / `-muted` | `#1d1d1f` / `#48484d` / `#6e6e73` | `#f5f5f7` / `#c7c7cc` / `#98989d` | tekst |
| `accent` | `#0066cc` | `#4da3ff` | links en blauwe tekst |
| `accent-fill` | `#0071e3` | idem | vulling van knoppen en selectie (witte tekst 4,7:1) |
| `ring` | `#ff2d55` | `#ff375f` | de dagdoelring |
| `good` / `bad` / `warm` | `#1a7f37` / `#d70015` / `#b25000` | `#32d74b` / `#ff453a` / `#ff9f0a` | goed, fout, reeks |
| `flag` | `#d81e2c` | idem | alleen het logo (šahovnica) |

Alle tekstkleuren halen WCAG AA op hun ondergrond, in beide thema's.

## 3. Typografie

- Systeemletter (`-apple-system`, SF Pro); elders valt hij terug op Segoe UI of Roboto.
- Grote titel: 34–46px, gewicht 700, spatiëring -0,028em.
- Kopjes boven een groep (`.eyebrow`): 13px, 600, grijs, zoals in Instellingen.
- Cijfers (`.num`): gelijke breedte, 700.
- Literata voor verhalen en leestekst.

## 4. Vorm en diepte

- Kaarten 22px afgerond, geen rand in licht, een heel zachte schaduw. In donker een
  lichte binnenrand in plaats van schaduw.
- Knoppen als capsules: **blauw gevuld** voor de hoofdactie, **grijs** voor een tweede keuze.
- Glas: `backdrop-filter: blur(24px) saturate(1.8)` met een lichte rand; bij
  `prefers-reduced-transparency` effen.

## 5. Componenten

- `PageHeader`: grote titel en inleiding; verschijnt klein in een glazen balk zodra de
  titel uit beeld scrolt.
- Navigatie: tabbalk van glas op de telefoon (iconen, het actieve item met naam),
  smalle zijbalk op een tablet, volle zijbalk zoals iPadOS op een scherm. De selectie
  schuift met een veer naar het nieuwe item; het nieuwe icoon maakt een klein sprongetje.
- `Ring`: dagdoel als ring die zich bij het laden tekent.
- `StepTiles`: capsules per opgave die zich van links vullen in groen, goud of rood.
- Segmented control (leesstand in verhalen): witte duim die met een veer verschuift.
- Woordpaneel (verhalen): paneel van glas met een greepje, van onderen in en weer
  naar onderen uit.
- `HoverLight`: klikbare kaarten lichten zacht op waar de muis staat (het hover-effect
  van visionOS), zodat je ziet wat je gaat raken.

## 6. Beweging: logisch, niet decoratief

| Moment | Wat | Duur / curve | Waarom |
|---|---|---|---|
| Dieper in een sectie (Verhalen → verhaal) | nieuwe pagina schuift van rechts | 380ms veer | je gaat een laag dieper |
| Terug naar boven | pagina komt van links | 380ms veer | je komt terug waar je was |
| Naar een andere sectie | vervaagt op zijn plek | 240ms | tabs liggen naast elkaar, niet achter elkaar |
| Grote titel uit beeld | titel verschijnt klein in de glazen balk | 200–300ms | je weet altijd waar je bent |
| Selectie in het menu | schuift naar het nieuwe item, icoon springt | 460ms veer | waar je vandaan komt en heen gaat |
| Indrukken (knop, kaart) | kleiner en iets doorzichtig, meteen | 80ms in, veer terug | de app hoort je op het moment van aanraken |
| Woordpaneel | van onderen in, naar onderen uit | 440ms / 280ms | hetzelfde pad heen en terug |
| Segmented control | duim schuift | 420ms veer | één keuze uit twee |
| Antwoord goed/fout | capsule vult zich in de kleur | 420ms veer | je ziet de sessie vorderen |
| Fout antwoord | het "nee"-schudden van iOS | 360ms | herkenbaar, zonder alarm |
| Dagdoel, balken, grafieken | ring en lijnen tekenen zich één keer | 700–1100ms | je ziet de voortgang geteld worden |

De veer is Apple's standaard: kritisch gedempt, geen doorschieten
(`cubic-bezier(0.32, 0.72, 0, 1)`). Bewust niet: de volgende vraag na Enter komt
direct; geen scroll-animaties; geen eindeloze lussen.

**Minder beweging:** geen verschuiven, schalen of schudden; wel korte fades en
kleurwissels, zodat je nog steeds ziet dat iets verandert.

**Techniek:** geen nieuwe bibliotheek. CSS-transities en -animaties; `template.tsx`
kiest push, pop of tab op basis van het vorige pad.

## 7. Waar wat staat

- Tokens, componentklassen en beweging: `src/app/globals.css`
- Overgangen tussen pagina's: `src/app/template.tsx`
- Kop: `PageHeader.tsx` · navigatie: `Nav.tsx` · hover-licht: `HoverLight.tsx` · thema: `ThemeToggle.tsx`
- Ring, capsules, logo: `ui.tsx` · overzicht: `src/app/page.tsx`
- Woordpaneel en segmented control: `StoryReader.tsx`
- 404 en laden: `app/not-found.tsx`, `app/loading.tsx`

Routes, inhoud, teksten en functies zijn niet veranderd.
