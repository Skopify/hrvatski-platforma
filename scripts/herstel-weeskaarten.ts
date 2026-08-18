/**
 * Eenmalig herstel: kaarten zonder SRS-rij opruimen.
 * Draai met: npx tsx scripts/herstel-weeskaarten.ts
 *
 * Aanleiding: "voortgang wissen" leegde srs en review_log maar liet de
 * kaartrijen staan (zie src/lib/progress-reset.ts). Wat overbleef was een kaart
 * zonder planning: hij komt niet terug als herhaling, want daarvoor is een
 * SRS-rij nodig, en hij komt ook niet terug als nieuw woord, want de kaart
 * bestaat al. Het woord verdwijnt dus stilletjes uit de rotatie.
 *
 * De reset zelf is inmiddels gerepareerd. Dit script trekt de databases recht
 * die de oude versie hebben gedraaid. Het raakt uitsluitend kaarten zonder
 * SRS-rij aan — alles met historie blijft staan — en maakt eerst een kopie.
 */
import { backupDatabase } from "../src/lib/db/backup";
import { sqlite } from "../src/lib/db";

const wezen = (
  sqlite
    .prepare("SELECT count(*) n FROM card c LEFT JOIN srs s ON s.card_id = c.id WHERE s.card_id IS NULL")
    .get() as { n: number }
).n;

if (!wezen) {
  console.log("Geen kaarten zonder SRS-rij. Er valt niets te herstellen.");
  process.exit(0);
}

const kopie = backupDatabase(sqlite, "voor-herstel-weeskaarten");
console.log(`Back-up: ${kopie.file}`);

const voor = (sqlite.prepare("SELECT count(*) n FROM card").get() as { n: number }).n;
sqlite
  .prepare("DELETE FROM card WHERE id IN (SELECT c.id FROM card c LEFT JOIN srs s ON s.card_id = c.id WHERE s.card_id IS NULL)")
  .run();
const na = (sqlite.prepare("SELECT count(*) n FROM card").get() as { n: number }).n;

console.log(`${voor - na} kaart(en) zonder planning verwijderd; ${na} kaarten met historie blijven staan.`);
console.log("Die woorden komen vanzelf terug als nieuwe kaart zodra ze in een les of herhaling langskomen.");
