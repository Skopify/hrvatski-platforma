/**
 * Migraties draaien. Gebruik: npm run migrate
 *
 * Normaal hoef je dit niet zelf te doen — de server draait openstaande migraties
 * bij het opstarten. Dit is voor als je wilt zien wat er gebeurt, of wilt
 * controleren of een database bij is zonder de server te starten.
 *
 * Er wordt eerst een back-up gemaakt als er iets te migreren valt.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { LATEST_VERSION, MIGRATIES, migrate } from "../src/lib/db/migrate";

const DB_PATH = process.env.HRVATSKI_DB
  ? path.resolve(process.env.HRVATSKI_DB)
  : path.join(process.cwd(), "data", "hrvatski.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const bestond = fs.existsSync(DB_PATH);
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

const huidig = (() => {
  try {
    const rij = sqlite.prepare("SELECT max(id) AS v FROM schema_migrations").get() as {
      v: number | null;
    };
    return rij.v ?? 0;
  } catch {
    return 0;
  }
})();

if (huidig >= LATEST_VERSION) {
  console.log(`Database is bij: versie ${huidig} van ${LATEST_VERSION}. Niets te doen.`);
  process.exit(0);
}

// Alleen back-uppen als er echt iets verandert aan een bestaande database.
if (bestond && huidig > 0) {
  const dir = path.join(path.dirname(DB_PATH), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const doel = path.join(dir, `voor-migratie-${stamp}.db`);
  sqlite.prepare("VACUUM INTO ?").run(doel);
  console.log(`Back-up: ${path.relative(process.cwd(), doel)}`);
}

const { versie, toegepast } = migrate(sqlite);

for (const id of toegepast) {
  const m = MIGRATIES.find((x) => x.id === id);
  console.log(`  ${String(id).padStart(3, "0")}  ${m?.naam ?? "?"}`);
}
console.log(
  toegepast.length
    ? `\n${toegepast.length} migratie(s) toegepast. Database staat op versie ${versie}.`
    : `Niets toegepast. Database staat op versie ${versie}.`,
);

sqlite.close();
