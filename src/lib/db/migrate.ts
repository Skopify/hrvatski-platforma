import type BetterSqlite3 from "better-sqlite3";

import { sql as basis } from "./migrations/001-basis";
import { up as kaarten } from "./migrations/002-kaarten";
import { sql as fouten } from "./migrations/003-fouten";
import { sql as zinnen } from "./migrations/004-zinnen";

/**
 * Migraties.
 *
 * Tot nu toe werd bij elke start één blok DDL uitgevoerd met CREATE TABLE IF NOT
 * EXISTS. Dat is geen migratiesysteem: het kan tabellen toevoegen, maar nooit
 * een kolom omkatten of bestaande rijen omzetten, en er wordt niet bijgehouden
 * wat er gedraaid heeft. Zodra het datamodel echt verandert — en dat doet het
 * hier — heb je genummerde stappen nodig die precies één keer draaien.
 *
 * Regels:
 *   - Een migratie die gedraaid heeft, verandert nooit meer. Wil je iets anders,
 *     dan schrijf je een nieuwe. Anders krijgt een lege database een ander
 *     schema dan een database die de reeks heeft doorlopen.
 *   - Elke migratie draait in zijn eigen transactie. Faalt hij halverwege, dan
 *     is er niets gebeurd en blijft het versienummer staan waar het stond.
 *   - Vreemde sleutels staan uit tijdens het migreren. Een tabel omkatten gaat
 *     via DROP en RENAME, en met sleutelcontrole aan zou SQLite halverwege
 *     struikelen over verwijzingen die pas aan het eind weer kloppen.
 */
export interface Migratie {
  id: number;
  naam: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

const uitTekst = (tekst: string) => (sqlite: BetterSqlite3.Database) => sqlite.exec(tekst);

export const MIGRATIES: Migratie[] = [
  { id: 1, naam: "basis", up: uitTekst(basis) },
  { id: 2, naam: "kaarten los van items", up: kaarten },
  { id: 3, naam: "foutenlogboek", up: uitTekst(fouten) },
  { id: 4, naam: "verhaalzinnen", up: uitTekst(zinnen) },
];

export const LATEST_VERSION = MIGRATIES.reduce((n, m) => Math.max(n, m.id), 0);

export interface MigratieUitkomst {
  versie: number;
  toegepast: number[];
}

export function migrate(sqlite: BetterSqlite3.Database): MigratieUitkomst {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const gedaan = new Set(
    (sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((r) => r.id),
  );

  const openstaand = MIGRATIES.filter((m) => !gedaan.has(m.id)).sort((a, b) => a.id - b.id);
  if (openstaand.length === 0) {
    return { versie: huidigeVersie(sqlite), toegepast: [] };
  }

  // PRAGMA foreign_keys werkt niet binnen een transactie, dus hij gaat eromheen.
  const sleutelsStonden = sqlite.pragma("foreign_keys", { simple: true }) === 1;
  sqlite.pragma("foreign_keys = OFF");

  const toegepast: number[] = [];
  try {
    for (const m of openstaand) {
      const draai = sqlite.transaction(() => {
        m.up(sqlite);
        sqlite
          .prepare("INSERT INTO schema_migrations (id, naam, applied_at) VALUES (?, ?, ?)")
          .run(m.id, m.naam, Date.now());
      });
      draai();
      toegepast.push(m.id);
    }
  } finally {
    if (sleutelsStonden) sqlite.pragma("foreign_keys = ON");
  }

  // Na een tabelherbouw controleren of er geen verwijzingen zijn losgeraakt.
  // Let op: de migraties zijn op dit punt al vastgelegd. Dit is dus geen
  // terugrolpunt maar een alarm — het zegt dat er iets mis is met de reeks zelf,
  // en dat er een back-up uit data/backups/ terug moet.
  const kapot = sqlite.pragma("foreign_key_check") as unknown[];
  if (kapot.length > 0) {
    throw new Error(
      `Migratie ${toegepast.join(", ")} liet ${kapot.length} verwijzing(en) los staan. ` +
        `De wijzigingen zijn al vastgelegd — herstel vanaf een back-up in data/backups/ ` +
        `voordat je verder werkt.`,
    );
  }

  return { versie: huidigeVersie(sqlite), toegepast };
}

function huidigeVersie(sqlite: BetterSqlite3.Database): number {
  const rij = sqlite.prepare("SELECT max(id) AS v FROM schema_migrations").get() as {
    v: number | null;
  };
  return rij.v ?? 0;
}

/** Op welke versie een database staat. 0 als er nooit gemigreerd is. */
export function currentVersion(sqlite: BetterSqlite3.Database): number {
  try {
    return huidigeVersie(sqlite);
  } catch {
    return 0; // schema_migrations bestaat nog niet
  }
}

/** Welke migraties er nog wachten. Leeg betekent: bij. */
export function pendingMigrations(sqlite: BetterSqlite3.Database): string[] {
  let gedaan = new Set<number>();
  try {
    gedaan = new Set(
      (sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((r) => r.id),
    );
  } catch {
    // geen schema_migrations: alles staat open
  }
  return MIGRATIES.filter((m) => !gedaan.has(m.id)).map((m) => `${m.id} (${m.naam})`);
}
