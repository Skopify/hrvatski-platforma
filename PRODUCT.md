# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nederlandstalige volwassenen (de eigenaar en wie hij uitnodigt) die Kroatisch leren voor zichzelf, naast werk.
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
- Draait lokaal (Next.js + SQLite), geen externe verzoeken. Sinds 29-09-2026 met accounts: elke gebruiker heeft een eigen login en eigen voortgang op dezelfde computer; er is geen e-mail of cloud (wachtwoordherstel gaat met een herstelcode).

## Capabilities and Constraints

- Uitleg in het Nederlands, doeltaalvoorbeelden in het Kroatisch.
- Feedback bij fouten escaleert: hint, dan keuze, dan antwoord met uitleg.
- Content is data (`content/*.json`); componenten tonen, verzinnen niets.
- Een meting die iets niet weet, zegt dat. Getallen op het scherm beloven niet meer dan ze waarmaken.
- Routes en navigatievolgorde liggen vast: Overzicht, Grammatica, Verhalen, Schrijven, Lessen, Oefenen, Woorden, Voortgang, en als negende Gesprek (BETA, sinds 29-09-2026).
- Gesprek is de enige plek waar een model Kroatisch genereert: lokaal (Ollama, gratis), elke zin door de taalpoorten, alleen woorden uit de lessen, en niets van het gesprek telt als voortgang.

## Brand Commitments

- Merkteken: de šahovnica (rood-wit dambord) als logo en als enige ornament.
- Visuele wereld sinds 29-09-2026: «Krabbel», speels en uitdagend scribble-ontwerp met dynamische pills en handgetekende iconen (zie DESIGN.md). Hij vond eerdere richtingen te generiek of "te AI"; de iconen moeten met de hand ontworpen zijn.
- Blijvend: pagina's mogen onderling niet verschillen in kop of marges, en navy-vlakken vond hij niet fris.

## Product Principles

1. Leren gaat voor effect: een animatie of kleur die het lezen of typen vertraagt, gaat eruit.
2. Eerlijk over voortgang: geen beloningsgeluid zonder echte vooruitgang erachter.
3. Eén systeem, overal gelijk: elke pagina gebruikt dezelfde kop, breedtes en componenten.
4. Kroatisch krijgt de mooiste letter: diakritische tekens moeten altijd echt getekend zijn.

## Accessibility & Inclusion

WCAG AA: contrast, toetsenbordbediening met zichtbare focus, en `prefers-reduced-motion` gerespecteerd.
