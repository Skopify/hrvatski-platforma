/**
 * De oogst van het nakijken. Draai met: npm run nakijk-oogst
 *
 * Alles wat de nakijker niet heeft goedgekeurd, naast elkaar: de zin zoals hij
 * er staat, de voorgestelde verbetering, en waar hij vandaan komt.
 *
 * Met opzet een lijst en geen knop. Een moedertaalspreker die «zo zegt niemand
 * dat» schrijft, vraagt om een herschreven opgave en niet om een
 * tekstvervanging — en welke van de twee het is, kan alleen iemand zien die de
 * oefening eromheen kent.
 */
import { alleZinnen, oogst, stand } from "../src/lib/nakijken";

const s = stand();
console.log(
  `Nagekeken: ${s.totaal - s.open} van ${s.totaal} zinnen · ` +
    `${s.goedgekeurd} goed · ${s.fout} fout · ${s.twijfel} twijfel · ${s.open} open`,
);
for (const h of s.perHerkomst) {
  console.log(`  ${h.herkomst.padEnd(8)} ${String(h.nagekeken).padStart(4)} van ${h.totaal}`);
}

const werk = oogst();
if (!werk.length) {
  console.log("\nNiets te verwerken.");
  process.exit(0);
}

// Waar staat deze zin in de content? Zonder die vraag is een correctie niet te
// verwerken zonder de hele map door te grepen.
const opHash = new Map(alleZinnen().map((z) => [z.hash, z]));

console.log(`\n${werk.length} zin(nen) om te verwerken:\n`);
for (const w of werk) {
  const zin = opHash.get(w.hash);
  console.log(`  ${w.oordeel.status.toUpperCase()}  ${zin?.plek ?? "— niet meer in de content —"}`);
  console.log(`    nu:  ${w.hr}`);
  if (w.oordeel.correctie) console.log(`    →    ${w.oordeel.correctie}`);
  if (w.oordeel.opmerking) console.log(`    «${w.oordeel.opmerking}»`);
  console.log();
}
