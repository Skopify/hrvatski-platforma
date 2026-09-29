# Architectuur, prestaties en beveiliging

Stand 29-09-2026. Dit document beschrijft hoe het platform in elkaar zit en welke
afspraken de code bewaakt. De regels zelf staan in `CLAUDE.md`; de productkeuzes in
`docs/REBUILD-SPEC.md`.

## Lagen

| Laag | Waar | Regel |
|---|---|---|
| Content | `content/*.json` | Data, nooit hardcoded in componenten. `check:content`, `check:taal` en `check:verhalen` bewaken haar. |
| Domeinlogica | `src/lib/` | Geen React. Schrijven naar het leerlogboek gaat via `leerlogboek.ts` (XP, reeks, antwoorden) en `srs.ts` (FSRS via `ts-fsrs`). |
| Acties | `src/app/actions/<domein>.ts` | Eén bestand per domein (oefenen, drill, verhalen, les, woorden, plaatsing, modules, nakijken, schrijven), elk `"use server"`. Een pagina stuurt alleen mee wat ze gebruikt. `index.ts` is een doorgeefluik voor scripts en tests, geen eindpunt. |
| Weergave | `src/app/**/page.tsx`, `src/components/` | Servercomponenten lezen; clientcomponenten alleen waar interactie of beweging nodig is. |
| Data | `data/hrvatski.db` (SQLite, WAL) | Schema alleen via migraties (`src/lib/db/migrations`), vastgelegd met vingerafdrukken (`check:migraties`). |

Eén kennislaag: alle secties lezen en schrijven dezelfde kaarten. Het gesprek (BETA)
is de uitzondering en schrijft niets naar de leerhistorie.

## Beveiligingsmodel

Het platform draait lokaal, maar een lokale server is voor je browser een website.

- **Bereik.** `npm run dev` en `npm start` luisteren alleen op `127.0.0.1`. Voor je
  telefoon: `npm run dev:lan`.
- **Poort** (`src/middleware.ts`). Alleen eigen hostnamen (localhost, loopback,
  privé-IP, `.local`) tegen DNS-rebinding; API-verzoeken en acties moeten van het
  platform zelf komen (`Sec-Fetch-Site`, `Origin`). Extra namen:
  `HRVATSKI_ALLOWED_HOSTS`.
- **Koppen** (`next.config.ts`). CSP zonder externe bronnen, `frame-ancestors 'none'`,
  `nosniff`, `Referrer-Policy: no-referrer`, geen `X-Powered-By`.
- **Invoer** (`src/lib/valideer.ts`). Acties begrenzen getallen en tekstlengtes.
- **Geheimen.** `azure.env` is gitignored en heeft nooit in de geschiedenis gestaan.
  Uit de omgeving leest het platform alleen `AZURE_SPEECH_*`; de regio wordt gevalideerd
  omdat de sleutel in het adres meegaat.
- **Gegevens.** Elk script dat de database aanraakt maakt eerst een back-up
  (`backupDatabase`). `db:reset` vraagt bevestiging en maakt er ook een.
- **Afhankelijkheden.** `npm run audit:prod`. Open: de PostCSS in Next 15 (build-tijd,
  verwerkt alleen eigen CSS); die verdwijnt met Next 16.

## Starten en stoppen

`Hrvatski.app` (gemaakt met `npm run app:maak`, gitignored) roept `scripts/app-start.sh` aan:
kijkt of er al een server draait, zoekt een werkende node, zet klaar wat ontbreekt
(pakketten, database, `npm run migrate` met back-up, een verse build als de code nieuwer
is), start de productieserver alleen op `127.0.0.1` en opent Safari.

- **Beheerd.** De server start met `HRVATSKI_MANAGED=1`; alleen dan mag hij zichzelf uitzetten.
  Een gewone `npm run dev` doet dat nooit.
- **Teken van leven.** Elke open pagina meldt zich elke 30 seconden (`/api/leven`). Na 10 minuten
  stilte sluit de server af (`src/lib/levenscyclus.ts`); bij het starten geldt dezelfde tijd, dus
  een trage start wordt niet afgebroken. Afsluiten is netjes: het WAL van SQLite wordt leeggemaakt
  en de database gesloten.
- **Knop Afsluiten** (zijbalk) roept `/api/afsluiten` aan, alleen in de beheerde app en alleen met
  een eigen kop, bovenop de herkomstcontrole van de middleware.
- **Ollama op verzoek.** Alleen de sectie Gesprek start Ollama, niet het leren. Het model wordt na
  10 minuten zonder bericht uit het geheugen gehaald (Ollama's `keep_alive`); het Ollama-proces zelf
  stopt na 15 minuten zonder gesprek en bij het afsluiten. **Alleen als wij het gestart hebben**
  (`data/ollama-door-app.pid`): draaide Ollama al, dan blijft het aan.
- Instelbaar met `HRVATSKI_IDLE_SECONDS` en `HRVATSKI_OLLAMA_IDLE_SECONDS`. Logboek: `data/app.log`.

## Prestaties

Gemeten op een productiebuild met een kopie van de echte database.

- Serverrespons 10 tot 45 ms per pagina, gedeelde JavaScript 103 kB.
- De zoekindex (⌘K) zit niet meer in elke pagina maar wordt bij het eerste gebruik
  opgehaald (`/api/zoek`): ongeveer 21 kB minder per pagina.
- De woordenlijst stuurt alleen de velden die ze toont.
- SQLite: `busy_timeout`, `synchronous = NORMAL` (veilig met WAL), `temp_store = MEMORY`.

Bekende ruimte: `/woorden` levert alle 985 woorden aan de browser (380 kB). Bij een
groter woordenboek hoort dat via een API met paginering.

## Controles

`npm run typecheck` en de acceptatietests (`check:*`, `proef:*`) draaien in CI
(`.github/workflows/ci.yml`) op een database die uit `content/` wordt opgebouwd.
