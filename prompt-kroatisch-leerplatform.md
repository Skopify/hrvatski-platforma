# Prompt voor Claude Code: Kroatisch leerplatform

Kopieer alles hieronder (inclusief de PDF's als bijlage) naar Claude Code.

---

## Context

Ik wil een persoonlijk, interactief platform bouwen om Kroatisch te leren. Ik ken Duolingo en vergelijkbare apps, en wil bewust **iets diepgaanders en uitdagenders** dan dat — een platform dat me daadwerkelijk taalvaardigheid bijbrengt (grammatica, zinsbouw, naamvallen, woordenschat in context) in plaats van alleen losse woordjes stampen.

Ik heb een aantal PDF's bijgevoegd met woordenlijsten, oefeningen en/of grammaticamateriaal. Gebruik deze als brondata en als indicatie van het niveau en de onderwerpen waarmee ik wil beginnen.

## Fase 1 — Onderzoek (verplicht, doe dit eerst)

Voordat je begint met bouwen, doe eerst onderzoek (web search) naar:

1. **Effectieve methodes voor taalverwerving**, met name voor talen met een uitgebreid naamvalsysteem (Kroatisch heeft 7 naamvallen — vergelijkbaar met bv. Pools, Russisch, Servisch). Kijk specifiek naar:
   - Spaced repetition-algoritmes (SM-2, FSRS, Anki's aanpak) en hoe ik deze het beste kan implementeren
   - Comprehensible input vs. expliciete grammatica-instructie — en hoe je dit combineert
   - Interleaving (afwisselen van onderwerpen) versus blocked practice
   - Active recall / productive vs. receptive oefenvormen (herkennen vs. zelf produceren)
   - Hoe CEFR-niveaus (A1–C2) gebruikt worden om leerpaden te structureren
2. **Best practices voor het aanleren van naamvallen/verbuigingen** specifiek — dit is waarschijnlijk het lastigste onderdeel van Kroatisch voor een Nederlandstalige leerder.
3. **Wat maakt taalapps saai of te makkelijk** (kritiek op Duolingo-achtige apps) zodat je weet welke valkuilen je moet vermijden.

Vat je bevindingen kort samen voordat je verdergaat, en vertaal ze naar concrete ontwerpkeuzes voor dit platform (bv. "ik gebruik FSRS voor spaced repetition omdat...", "oefeningen worden geïnterleaved per grammaticathema omdat...").

## Fase 2 — Analyseer de bijgevoegde PDF's

Lees de bijgevoegde PDF's door en:
- Extraheer woordenlijsten, zinnen, grammaticaregels en oefeningen
- Bepaal het ruwe niveau (A1/A2/etc.) en de onderwerpen die erin voorkomen
- Structureer deze content in een bruikbaar dataformaat (bv. JSON) dat als basis dient voor de eerste lessen/modules
- Vul eventuele gaten strategisch aan (bv. als er woordenschat is maar geen grammatica-uitleg) op basis van je onderzoek uit fase 1

## Fase 3 — Functionele eisen platform

### Kernprincipe
Geen eindeloze losse flashcards. Elke les combineert **context, grammatica en herhaling**. Denk aan een opbouw als: introductie van een grammaticapunt in context → herkenningsoefeningen → productieve oefeningen → gemengde herhaling met eerder geleerde stof (interleaving).

### Oefentypen (varieer, niet alleen multiple choice)
- Vertalen (NL → HR en HR → NL)
- Invuloefeningen met de juiste naamval/vervoeging (cloze deletion)
- Zinnen reconstrueren / woordvolgorde
- Luisteren + typen wat je hoort (gebruik text-to-speech, bv. via de browser Web Speech API of een externe TTS)
- Foutcorrectie: "wat is er fout aan deze zin?"
- Vrije productie: korte antwoorden op vragen in het Kroatisch
- Grammatica-uitleg momenten (geen oefening, maar korte theorie op het juiste moment — "teaching moments")

### Spaced repetition & voortgang
- Implementeer een SRS-algoritme (bij voorkeur FSRS of SM-2) dat per woord/grammaticapunt bijhoudt wanneer het herhaald moet worden
- Track per item: aantal keer goed/fout, moeilijkheidsgraad, laatste review, volgende review-datum

### Levelsysteem & profiel
- XP-systeem gekoppeld aan correct afgeronde oefeningen (moeilijkere oefeningen = meer XP)
- Levels/rangen (bv. gekoppeld aan CEFR: A1.1 → A1.2 → ... → B1)
- Streak-tracking (dagen achter elkaar geoefend)
- Statistiekendashboard: voortgang per grammaticaonderwerp, woordenschatgrootte, accuracy over tijd, tijd besteed
- Overzicht van "zwakke punten" — welke naamvallen/onderwerpen ik vaak fout doe, zodat het systeem daar gericht op kan bijsturen

### Data
- Sla voortgang persistent op (lokale database is prima om mee te beginnen, bv. SQLite of browser-based zoals IndexedDB — kies wat het beste past bij de architectuur die je voorstelt)
- Structuur moet het mogelijk maken om later content uit te breiden zonder alles opnieuw te bouwen

## Fase 4 — UI/UX

- Moderne, strakke uitstraling: overwegend wit met veel witruimte
- Kies zelf een goed passende accentkleur (onderbouw kort waarom, bv. iets dat bij Kroatië/de Adriatische Zee past, maar het hoeft niet letterlijk de vlagkleuren te zijn)
- Duidelijke typografie, subtiele animaties/micro-interacties bij feedback (goed/fout), geen kinderachtige mascottes of overdreven gamification-elementen
- Dashboard/profielpagina met de voortgangsdata prominent in beeld (grafieken/visualisaties)
- Focus op leesbaarheid en rust — het moet aanvoelen als een serieus leerinstrument, niet als een spelletjes-app

## Fase 5 — Aanpak

- Stel eerst een technische stack voor (framework, database, hoe TTS/audio wordt opgelost) en licht kort toe waarom, voordat je begint te bouwen
- Bouw iteratief: begin met een werkend skelet (navigatie, profiel, één lesmodule met een paar oefentypen), laat me dat zien, en breid daarna uit
- Zorg dat de content uit de PDF's daadwerkelijk in het systeem terechtkomt als eerste leerstof

---

**Belangrijk:** begin met fase 1 (onderzoek) en fase 2 (PDF-analyse), vat kort samen wat je hebt gevonden en welke keuzes je daaruit maakt, en vraag pas daarna om bevestiging voordat je met de bouw start.
