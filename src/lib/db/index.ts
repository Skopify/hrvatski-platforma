import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { LATEST_VERSION, currentVersion, migrate, pendingMigrations } from "./migrate";
import * as schema from "./schema";

import { huidigeGebruikerId, GeenGebruikerError } from "../accounts/context";
import { gebruikerDbPad } from "../data";

/**
 * Welke database is dit? Twee standen:
 *
 *   · HRVATSKI_DB is gezet: één vaste database, zonder accounts. Zo draaien scripts en
 *     de acceptatietests tegen een kopie in plaats van tegen echte voortgang.
 *   · Anders: de database van de gebruiker die nu bezig is (zie accounts/context.ts).
 *     Niemand ingelogd? Dan geeft `db` een fout in plaats van iets: faalt dicht.
 *
 * `db` en `sqlite` hieronder zijn daarom geen vaste verbindingen maar doorgeefluiken die bij
 * elk gebruik de juiste ophalen. Voor de rest van de code verandert er niets.
 */
// Lazy: een script zet HRVATSKI_DB pas nadat het zijn eigen imports heeft gedaan.
const vasteDb = () => (process.env.HRVATSKI_DB ? path.resolve(process.env.HRVATSKI_DB) : null);

type Verbinding = ReturnType<typeof create>;
declare global {
  // eslint-disable-next-line no-var
  var __hrvatskiDbs: Map<string, Verbinding> | undefined;
}

/**
 * Een bestaande database wordt hier nooit gemigreerd.
 *
 * Dat is geen voorzichtigheid maar ervaring: toen de migratie wél bij het
 * openen draaide, hoefde er alleen een bestand veranderd te worden om een
 * draaiende dev-server het schema van de échte leerhistorie te laten omgooien —
 * zonder back-up, zonder dat iemand erom vroeg. Een hot reload hoort geen
 * datamodel te verbouwen.
 *
 * Een database die nog niet bestaat, mag wel meteen opgezet worden: daar valt
 * niets te verliezen. Loopt een bestaande database achter, dan weigert de server
 * te starten en verwijst hij naar `npm run migrate` — dat script maakt eerst een
 * kopie en laat zien wat het doet.
 */
function create(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const nieuw = !fs.existsSync(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Een tweede proces (een script, een test) dat tegelijk schrijft, wacht een
  // paar seconden in plaats van meteen "database is locked" te geven.
  sqlite.pragma("busy_timeout = 5000");
  // Met WAL is NORMAL veilig tegen corruptie en een stuk sneller dan FULL: bij
  // een stroomstoring kan de laatste transactie verloren gaan, de database niet.
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("temp_store = MEMORY");

  if (nieuw) {
    migrate(sqlite);
  } else {
    const versie = currentVersion(sqlite);
    const achterstand = pendingMigrations(sqlite);

    if (achterstand.length > 0) {
      throw new Error(
        `De database staat op versie ${versie}, de code verwacht ${LATEST_VERSION}. ` +
          `Openstaand: ${achterstand.join(", ")}.\n` +
          `Draai eerst  npm run migrate  — dat maakt een back-up en past ze toe.`,
      );
    }

    // De database kán ook nieuwer zijn dan de code, en dat is de gevaarlijkste
    // van de twee: hij start dan gewoon op en loopt pas veel later stuk op een
    // kolom die nog niet bestond. Dat overkomt je zodra je naar een oudere
    // branch schakelt terwijl je database al gemigreerd is. Dus liever meteen
    // stoppen met een melding die zegt wat er aan de hand is.
    if (versie > LATEST_VERSION) {
      throw new Error(
        `De database staat op versie ${versie}, maar deze code kent er maar ${LATEST_VERSION}. ` +
          `Je staat waarschijnlijk op een oudere branch dan waarmee je database is bijgewerkt.\n` +
          `Schakel terug naar de nieuwste code, of zet een kopie uit data/backups/ terug.`,
      );
    }
  }

  const now = Date.now();
  sqlite
    .prepare("INSERT OR IGNORE INTO profile (id, created_at) VALUES (1, ?)")
    .run(now);

  return { db: drizzle(sqlite, { schema }), sqlite };
}

// Een handvol verbindingen open houden (de laatst gebruikte), niet er honderd.
const MAX_OPEN = 12;
const verbindingen = () => (globalThis.__hrvatskiDbs ??= new Map());

function verbinding(dbPath: string): Verbinding {
  const alle = verbindingen();
  const bestaand = alle.get(dbPath);
  if (bestaand && bestaand.sqlite.open) {
    alle.delete(dbPath); // achteraan: recent gebruikt
    alle.set(dbPath, bestaand);
    return bestaand;
  }
  const nieuw = create(dbPath);
  alle.set(dbPath, nieuw);
  while (alle.size > MAX_OPEN) {
    const [oudste, v] = alle.entries().next().value as [string, Verbinding];
    alle.delete(oudste);
    try {
      v.sqlite.close();
    } catch {
      // al dicht
    }
  }
  return nieuw;
}

function huidige(): Verbinding {
  const vast = vasteDb();
  if (vast) return verbinding(vast);
  const id = huidigeGebruikerId();
  if (id === null) throw new GeenGebruikerError();
  const pad = gebruikerDbPad(id);
  // Een account zonder database is een fout, geen reden om stilletjes een lege te maken.
  if (!fs.existsSync(pad)) throw new Error(`Gebruiker ${id} heeft geen database (${pad}).`);
  return verbinding(pad);
}

/** Een verbinding sluiten, bijvoorbeeld voordat een account wordt verwijderd of overgenomen. */
export function sluitDb(dbPath: string): void {
  const alle = verbindingen();
  const v = alle.get(dbPath);
  if (!v) return;
  alle.delete(dbPath);
  try {
    v.sqlite.pragma("wal_checkpoint(TRUNCATE)");
    v.sqlite.close();
  } catch {
    // al dicht
  }
}

export function sluitAlleDbs(): void {
  for (const pad of [...verbindingen().keys()]) sluitDb(pad);
}

function doorgeefluik<T extends object>(kies: () => T): T {
  return new Proxy({} as T, {
    get(_doel, sleutel) {
      const echt = kies() as Record<string | symbol, unknown>;
      const waarde = echt[sleutel];
      // Methoden horen bij de échte verbinding, niet bij het doorgeefluik.
      return typeof waarde === "function" ? (waarde as (...a: unknown[]) => unknown).bind(echt) : waarde;
    },
    has: (_doel, sleutel) => sleutel in (kies() as object),
  });
}

export const db = doorgeefluik(() => huidige().db);
export const sqlite = doorgeefluik(() => huidige().sqlite);
export { schema };
