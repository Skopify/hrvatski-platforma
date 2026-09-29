/**
 * Draait een script tegen elke voortgangsdatabase: de oude installatie (als die er nog is),
 * het sjabloon, en die van elke gebruiker.
 * Gebruik: tsx scripts/voor-alle-dbs.ts <script> [argumenten]   (bijvoorbeeld: seed, migrate)
 *
 * Elke gebruiker heeft een eigen database met dezelfde leerstof erin. Wordt de content of het
 * schema bijgewerkt, dan moet dat bij allemaal, en elk script maakt daarbij zijn eigen
 * back-up in de map van die database (CLAUDE.md: geen schrijven zonder kopie).
 * Bestaat er nog niets (een nieuwe installatie), dan wordt het sjabloon gebouwd: dat is
 * de database waar elke nieuwe gebruiker mee begint.
 */
import { spawnSync } from "node:child_process";

import { alleDbPaden, sjabloonPad } from "../src/lib/data";

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error("Gebruik: tsx scripts/voor-alle-dbs.ts <script> [argumenten]");
  process.exit(1);
}

let doelen = alleDbPaden();
if (!doelen.length) doelen = [{ naam: "sjabloon (nieuwe installatie)", pad: sjabloonPad() }];

let fout = 0;
for (const d of doelen) {
  if (doelen.length > 1 || d.naam.startsWith("sjabloon")) console.log(`\n── ${d.naam} ──`);
  const r = spawnSync(process.execPath, ["--import", "tsx", `scripts/${script}.ts`, ...rest], {
    stdio: "inherit",
    env: { ...process.env, HRVATSKI_DB: d.pad },
  });
  if (r.status !== 0) {
    fout++;
    console.error(`✗ ${script} faalde voor ${d.naam}; de rest gaat door, kijk hierboven wat er misging.`);
  }
}
process.exit(fout ? 1 : 0);
