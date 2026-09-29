/**
 * De database opnieuw opbouwen uit content/. Draai met: npm run db:reset
 *
 * Dit verwijdert je voortgang. Vroeger was dit een kale `rm` in package.json,
 * zonder kopie — de enige route in het project die het reviewlogboek kon
 * vernietigen zonder vangnet. Nu maakt het eerst een back-up via dezelfde
 * functie als de seed en de migraties, en vraagt het om bevestiging.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

import Database from "better-sqlite3";

import { legacyDbPad } from "../src/lib/data";
import { backupDatabase } from "../src/lib/db/backup";

const DB = process.env.HRVATSKI_DB ? path.resolve(process.env.HRVATSKI_DB) : legacyDbPad();

// Sinds de accounts heeft elke gebruiker een eigen database. Dit script is voor één bestand: de
// oude installatie of een bestand dat je met HRVATSKI_DB aanwijst. Je eigen voortgang wis je in
// de app (Voortgang → opnieuw beginnen), en een heel account met `npm run gebruiker`.
if (!process.env.HRVATSKI_DB && !fs.existsSync(DB)) {
  console.log("Er is geen oude database (data/hrvatski.db): die is bij de eerste account overgenomen.\nVoortgang wissen doe je in de app; een account verwijderen met: npm run gebruiker -- verwijder <naam>.\nWil je een specifiek bestand opnieuw opbouwen: HRVATSKI_DB=pad npm run db:reset");
  process.exit(0);
}

if (fs.existsSync(DB)) {
  if (!process.argv.includes("--ja")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const antwoord = await rl.question(
      `Dit wist ${path.relative(process.cwd(), DB)} en bouwt hem opnieuw op. Je voortgang is dan weg (er komt eerst een kopie).\nTyp RESET om door te gaan: `,
    );
    rl.close();
    if (antwoord.trim() !== "RESET") {
      console.log("Afgebroken. Er is niets gewijzigd.");
      process.exit(1);
    }
  }
  const sqlite = new Database(DB);
  const kopie = backupDatabase(sqlite, "voor-db-reset", DB);
  sqlite.close();
  console.log(`Back-up: ${kopie.file}`);
}

for (const ext of ["", "-wal", "-shm"]) fs.rmSync(DB + ext, { force: true });

const seed = spawnSync(process.execPath, ["--import", "tsx", "scripts/seed.ts"], { stdio: "inherit", env: process.env });
process.exit(seed.status ?? 1);
