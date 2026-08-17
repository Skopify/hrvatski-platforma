import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { LATEST_VERSION, currentVersion, migrate, pendingMigrations } from "./migrate";
import * as schema from "./schema";

/**
 * HRVATSKI_DB laat de acceptatietests tegen een kopie draaien in plaats van
 * tegen je echte voortgang. In gewoon gebruik staat hij niet, en dan is het
 * gewoon data/hrvatski.db.
 */
const DB_PATH = process.env.HRVATSKI_DB
  ? path.resolve(process.env.HRVATSKI_DB)
  : path.join(process.cwd(), "data", "hrvatski.db");
const DB_DIR = path.dirname(DB_PATH);

declare global {
  // eslint-disable-next-line no-var
  var __hrvatskiDb: ReturnType<typeof create> | undefined;
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
function create() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const nieuw = !fs.existsSync(DB_PATH);
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

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

// In dev hergebruikt Next de module tussen hot reloads; zonder cache zou elke
// reload een nieuwe SQLite-handle openen.
const instance = globalThis.__hrvatskiDb ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__hrvatskiDb = instance;

export const db = instance.db;
export const sqlite = instance.sqlite;
export { schema };
