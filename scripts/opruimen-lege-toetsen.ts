/**
 * Lege plaatsingstoetsen opruimen. Eenmalig; draai met:
 *   npx tsx scripts/opruimen-lege-toetsen.ts
 *
 * Tot vandaag maakte het openen van /plaatsingstoets al een rij in
 * `placement_run` aan. Wie even keek en wegklikte liet een lege toets achter.
 * Dat is nu verholpen — de rij ontstaat pas bij het eerste antwoord — maar de
 * rijen die er al staan gaan daar niet vanzelf van weg.
 *
 * Alleen rijen zonder één enkel antwoord én zonder einddatum. Een toets waar
 * iemand vier vragen van heeft gedaan is geen rommel maar een afgebroken
 * meting, en die blijft staan: hij zegt iets wat je niet terugkrijgt.
 */
import { backupDatabase } from "../src/lib/db/backup";
import { sqlite } from "../src/lib/db";

const kandidaten = sqlite
  .prepare(
    `SELECT r.id, r.started_at,
            (SELECT count(*) FROM placement_answer a WHERE a.run_id = r.id) AS antwoorden
       FROM placement_run r
      WHERE r.finished_at IS NULL`,
  )
  .all() as { id: number; started_at: number; antwoorden: number }[];

const leeg = kandidaten.filter((r) => r.antwoorden === 0);
const metWerk = kandidaten.filter((r) => r.antwoorden > 0);

console.log(`${kandidaten.length} onafgeronde toets(en):`);
for (const r of kandidaten) {
  console.log(
    `  #${r.id}  ${new Date(r.started_at).toISOString().slice(0, 16)}  ` +
      `${r.antwoorden} antwoord(en)  ${r.antwoorden === 0 ? "→ weg" : "→ blijft staan"}`,
  );
}

if (!leeg.length) {
  console.log("\nNiets op te ruimen.");
  process.exit(0);
}

console.log(`\nBack-up: ${backupDatabase(sqlite, "voor-opruimen-lege-toetsen").file}`);
const weg = sqlite.prepare("DELETE FROM placement_run WHERE id = ? AND finished_at IS NULL");
let n = 0;
for (const r of leeg) n += weg.run(r.id).changes;

console.log(`${n} lege toets(en) verwijderd, ${metWerk.length} met antwoorden behouden.`);
