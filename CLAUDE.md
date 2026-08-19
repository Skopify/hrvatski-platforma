# Projectregels

Dit project bouwt een Kroatisch-leerplatform om volgens `docs/REBUILD-SPEC.md`.
Lees die spec vóór elke taak — en §12 het eerst, want daar staat wat er al beslist is.

## Harde regels

- Content is DATA (`content/*.json`), nooit hardcoded in componenten.
- Het SRS-algoritme is FSRS via `ts-fsrs`. Nooit zelf schrijven of aanpassen.
- Alle drie de secties lezen en schrijven dezelfde knowledge state. Geen aparte voortgang per sectie.
- Kroatische content wordt NOOIT aan de gebruiker getoond zonder de validatiepoorten uit §7.
- Nooit een oefening genereren met woorden die niet in `known_set` zitten, tenzij het doel woordenschat is.
- Uitleg is in het Nederlands, doeltaalvoorbeelden in het Kroatisch (standaardkroatisch, geen Servische varianten). `npm run check:taal` bewaakt dat; nieuwe content draait daar doorheen vóór ze op het scherm komt.
- Feedback bij fouten escaleert: hint → keuze → antwoord + uitleg. Nooit meteen het antwoord.
- Elke wijziging aan het datamodel gaat via een migratie; bestaande review-historie mag nooit verloren gaan.
- **Modulestatus volgt uit prestatie, nooit uit zelfinschatting.** Het curriculum is compleet van nul tot eind; het pad erdoorheen mag kort zijn waar de leerder sterk is. Dat is niet hetzelfde.
- **Een meting die iets niet weet, zegt dat.** Onbekende woorden tellen nooit stilzwijgend als bekend, en een getal op het scherm belooft niet meer dan het waarmaakt.

## Werkwijze

- Werk één fase uit §10 per keer. Vraag om bevestiging voordat je aan de volgende begint.
- Schrijf voor elke fase eerst de acceptatietest, dan de implementatie.
- Bij twijfel over Kroatische grammatica: markeer het item voor menselijke review, verzin niets.

## Database

- **Geen enkel script schrijft naar `data/hrvatski.db` zonder eerst een kopie te maken.** Niet alleen migraties — ook `seed`, en elk toekomstig script dat de database aanraakt. Gebruik `backupDatabase()` uit `src/lib/db/backup.ts`; die houdt de laatste vijftien kopieën in `data/backups/` en ruimt de rest op.
  Het onderscheid "migraties veranderen het schema, de rest alleen content" houdt geen stand: de seed verwijdert rijen (verouderde vormen, mét hun SRS-toestand), en een bug daarin is zonder kopie niet terug te draaien. Het reviewlogboek is het enige hier dat je niet kunt terugverdienen door harder te studeren.
- **Migreer nooit vanuit de draaiende applicatie.** `src/lib/db/index.ts` zet een bestaande database alleen op als hij nog niet bestaat; loopt hij achter, dan weigert de server te starten en verwijst hij naar `npm run migrate`. Dat is geen voorzichtigheid maar ervaring: toen de migratie bij het openen draaide, hoefde er alleen een bestand veranderd te worden om een draaiende dev-server het schema van de echte leerhistorie te laten omgooien, zonder back-up.
- Een migratie die gedraaid heeft, verandert nooit meer. Wil je iets anders, schrijf een nieuwe.

## Node

Gebruik `/usr/local/bin/node` (v20.11.1). De Homebrew-node op het pad is stuk (ontbrekende icu4c 73); `~/.zprofile` zet hem er via `brew shellenv` vóór. `start.command` zoekt zelf een werkende node.

## Commando's

| | |
|---|---|
| `npm run dev` | ontwikkelserver |
| `npm run migrate` | openstaande migraties, met back-up vooraf |
| `npm run seed` | content-JSON → database (idempotent) |
| `npm run check` | nakijklogica |
| `npm run check:content` | contentvalidatie |
| `npm run check:taal` | het Kroatisch zelf: spelling, voorzetsel+naamval, servismen |
| `npm run check:fase0` | acceptatietests Fase 0 |
| `npm run check:fase05` | acceptatietests Fase 0.5 (escalerende feedback) |
| `npm run check:fase1` | acceptatietests Fase 1 (woordenschat) |
| `npm run check:fase15` | acceptatietests Fase 1.5 (plaatsingstoets) |
| `npm run check:freq` | validatiepoorten kernwoordenschat |
| `npm run codes` | grammaticacodes + dekking van het curriculum |
| `npm run zin-ids` | vaste id's op verhaalzinnen |
| `npm run patch` | contentwijzigingen uit `content/patch-*.json` |

## Geheimen

`azure.env` staat in de repo-map en is gitignored. De repo is **openbaar**. Nooit committen, nooit in de chat echoën, nooit naar een tweede bestand kopiëren.
