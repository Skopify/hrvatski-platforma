import fs from "node:fs";
import path from "node:path";

import type BetterSqlite3 from "better-sqlite3";

/**
 * Een kopie van de database, vóórdat er iets aan verandert.
 *
 * ── Waarom dit een gedeelde functie is en geen regel in elk script ─────────
 * Er is één ding in dit platform dat je niet kunt terugverdienen door harder te
 * studeren: het reviewlogboek. Dat is de opname van hoe jouw geheugen zich over
 * maanden gedroeg, en het bestaat maar één keer.
 *
 * Elk script dat naar data/hrvatski.db schrijft, maakt daarom eerst een kopie —
 * niet alleen de migraties. Dat onderscheid leek eerder logisch (migraties
 * veranderen het schema, de seed alleen content) maar het houdt geen stand: een
 * seed die een bug heeft, kan net zo goed rijen weggooien. De seed doet dat zelfs
 * met opzet, voor verouderde vormen.
 *
 * ── Waarom VACUUM INTO ─────────────────────────────────────────────────────
 * Een kale bestandskopie mist de WAL. VACUUM INTO schrijft een consistente
 * database weg, ook terwijl er verbindingen openstaan.
 */

const BEWAAR = 15;

export interface BackupResult {
  /** Pad ten opzichte van de projectmap. Leeg als er niets te kopiëren viel. */
  file: string;
  opgeruimd: number;
}

/**
 * Kopieert de database naar data/backups/ met reden en tijd in de naam.
 * Een database die nog niet bestaat, levert een lege uitkomst — daar valt
 * niets te verliezen.
 */
export function backupDatabase(
  sqlite: BetterSqlite3.Database,
  reden: string,
  dbPath?: string,
): BackupResult {
  const pad = dbPath ?? (sqlite.name as string);
  if (!pad || !fs.existsSync(pad)) return { file: "", opgeruimd: 0 };

  const dir = path.join(path.dirname(pad), "backups");
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "")
    .replace("T", "-");
  const veiligeReden = reden.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const doel = path.join(dir, `${veiligeReden}-${stamp}.db`);

  sqlite.prepare("VACUUM INTO ?").run(doel);

  // Oude kopieën opruimen. Zonder deze rem groeit de map bij elke seed met
  // twee megabyte, en dan wordt de back-up zelf het probleem.
  const bestanden = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  let opgeruimd = 0;
  for (const oud of bestanden.slice(BEWAAR)) {
    fs.unlinkSync(path.join(dir, oud.f));
    opgeruimd++;
  }

  return { file: path.relative(process.cwd(), doel), opgeruimd };
}
