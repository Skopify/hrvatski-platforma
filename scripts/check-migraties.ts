/**
 * Bewaakt de regel «een migratie die gedraaid heeft, verandert nooit meer».
 * Draai met: npm run check:migraties
 *
 * Elke migratie heeft een vingerafdruk in src/lib/db/migrations/CHECKSUMS.json.
 * Verandert een bestaande migratie, dan faalt dit — een lege database zou dan
 * een ander schema krijgen dan jouw echte database, en dat merk je pas maanden
 * later. Een nieuwe migratie wordt met `--nieuw` aan het lijstje toegevoegd;
 * bestaande regels worden nooit overschreven.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src", "lib", "db", "migrations");
const lijst = path.join(dir, "CHECKSUMS.json");
const bestanden = fs.readdirSync(dir).filter((f) => /^\d{3}-.*\.ts$/.test(f)).sort();
const vinger = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex");

const bekend: Record<string, string> = fs.existsSync(lijst) ? JSON.parse(fs.readFileSync(lijst, "utf8")) : {};
const nieuw = process.argv.includes("--nieuw");

let fout = 0;
for (const f of bestanden) {
  const nu = vinger(f);
  if (!bekend[f]) {
    if (nieuw) {
      bekend[f] = nu;
      console.log(`+ ${f} toegevoegd`);
    } else {
      console.log(`✗ ${f} staat nog niet in CHECKSUMS.json (draai: npm run check:migraties -- --nieuw)`);
      fout++;
    }
  } else if (bekend[f] !== nu) {
    console.log(`✗ ${f} is veranderd na het vastleggen. Een migratie die gedraaid heeft verandert nooit meer: schrijf een nieuwe.`);
    fout++;
  } else {
    console.log(`✓ ${f}`);
  }
}
for (const f of Object.keys(bekend)) {
  if (!bestanden.includes(f)) {
    console.log(`✗ ${f} staat in CHECKSUMS.json maar bestaat niet meer`);
    fout++;
  }
}

if (nieuw && !fout) fs.writeFileSync(lijst, JSON.stringify(Object.fromEntries(Object.entries(bekend).sort()), null, 2) + "\n");
console.log(fout ? `\n${fout} probleem(en).` : `\n${bestanden.length} migraties, allemaal ongewijzigd.`);
process.exit(fout ? 1 : 0);
