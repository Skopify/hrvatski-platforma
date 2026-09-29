# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Eén volwassen Nederlandstalige leerder die Kroatisch leert voor zichzelf, naast werk.
Hij gebruikt het platform elke dag kort (een herhaalsessie, een verhaal, een
schrijfopdracht), op een laptop en op zijn telefoon, vaak 's avonds.

## Product Purpose

Een Kroatisch-leerplatform dat grammatica, lezen, schrijven en woordenschat op één
gedeelde kennisstaat laat draaien. Succes betekent: de leerder kan elke week iets
wat hij de week ervoor niet kon, en het platform zegt eerlijk wat hij wel en niet
beheerst.

## Positioning

Geen quiz-app met Kroatisch als module. Alles is gebouwd rond één kennislaag (FSRS),
verhalen binnen de grammatica die je al kent, en nakijken dat taalkundig klopt
(standaardkroatisch, geen Servische varianten).

## Operating Context

- Dagelijkse herhaalsessie en drills: tientallen tot honderden antwoorden per dag, veel typen, met č/ć/š/ž/đ.
- Verhalen lezen met woorden aantikken voor betekenis en vorm.
- Schrijfopdrachten per niveau, nagekeken op spelling, naamval en servismen.
- Draait lokaal (Next.js + SQLite), geen accounts, geen externe verzoeken.

## Capabilities and Constraints

- Uitleg in het Nederlands, doeltaalvoorbeelden in het Kroatisch.
- Feedback bij fouten escaleert: hint, dan keuze, dan antwoord met uitleg.
- Content is data (`content/*.json`); componenten tonen, verzinnen niets.
- Een meting die iets niet weet, zegt dat. Getallen op het scherm beloven niet meer dan ze waarmaken.
- Routes en navigatievolgorde liggen vast: Overzicht, Grammatica, Verhalen, Schrijven, Lessen, Oefenen, Woorden, Voortgang.

## Brand Commitments

- Merkteken: de šahovnica (rood-wit dambord) als logo en als enige ornament.
- Visuele wereld sinds 29-09-2026: «Lagano», iOS-achtig maar beter, met logische animaties (zie DESIGN.md). Zijn referentie: strakke, lichte app-sites met pilknoppen en zwevende panelen.
- Blijvend: pagina's mogen onderling niet verschillen in kop of marges, en navy-vlakken vond hij niet fris.

## Product Principles

1. Leren gaat voor effect: een animatie of kleur die het lezen of typen vertraagt, gaat eruit.
2. Eerlijk over voortgang: geen beloningsgeluid zonder echte vooruitgang erachter.
3. Eén systeem, overal gelijk: elke pagina gebruikt dezelfde kop, breedtes en componenten.
4. Kroatisch krijgt de mooiste letter: diakritische tekens moeten altijd echt getekend zijn.

## Accessibility & Inclusion

WCAG AA: contrast, toetsenbordbediening met zichtbare focus, en `prefers-reduced-motion` gerespecteerd.
