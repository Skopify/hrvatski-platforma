/**
 * Zelfcontrole van de beoordelingsladder. Draai met: npm run check
 *
 * Dit is geen testsuite maar een leesbare momentopname: het laat zien hoe een
 * antwoord door de drie treden (exact / diakritisch / tikfout / fout) valt en
 * welke FSRS-rating en XP daaruit volgen. Handig na elke aanpassing aan grading.ts.
 */
import { findExercise } from "../src/lib/content";
import { gradeText, normalize, stripDiacritics, xpFor } from "../src/lib/grading";
import { ratingFor } from "../src/lib/srs";

const RATING_NAME = ["Manual", "Again", "Hard", "Good", "Easy"];

const cases: { id: string; given: string; expect: string }[] = [
  { id: "e.01.023", given: "Ovo je bilježnica, a ono je olovka.", expect: "exact" },
  { id: "e.01.023", given: "Ovo je biljeznica, a ono je olovka.", expect: "diacritic" },
  { id: "e.01.023", given: "ovo je bilježnica a ono je olovka", expect: "exact" },
  { id: "e.01.023", given: "Ovo je bilježnice, a ono je olovka.", expect: "typo" },
  { id: "e.01.023", given: "Ovo je knjiga.", expect: "wrong" },
  { id: "e.01.030", given: "Jeste li Vi lektorica Ana Majic? Da, jesam.", expect: "diacritic" },
  { id: "e.01.018", given: "One nisu studentice.", expect: "exact" },
  { id: "e.01.015", given: "Student sam.", expect: "exact" },
  { id: "e.01.014", given: "Ja nisam profesor", expect: "exact" },
  { id: "e.01.011", given: "", expect: "wrong" },
];

let failures = 0;

for (const c of cases) {
  const found = findExercise(c.id);
  if (!found) {
    console.log(`ONBEKEND  ${c.id}`);
    failures++;
    continue;
  }
  const r = gradeText(found.exercise, c.given);
  const xp = xpFor(found.exercise, r);
  const rating = ratingFor(r, found.exercise, 5000);
  const ok = r.verdict === c.expect;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok" : "FOUT"}  ${r.verdict.padEnd(9)} goed=${String(r.correct).padEnd(5)} ` +
      `bijna=${String(r.nearMiss).padEnd(5)} xp=${String(xp).padStart(2)} ` +
      `${RATING_NAME[rating].padEnd(5)}  «${c.given.slice(0, 40)}»`,
  );
}

console.log("\nnormalize:       ", JSON.stringify(normalize("  Ja  SAM   student!  ")));
console.log("stripDiacritics: ", stripDiacritics("bilježnica čaj ćevap đak šešir"));
console.log(failures === 0 ? "\nAlles zoals verwacht." : `\n${failures} afwijking(en).`);
process.exit(failures === 0 ? 0 : 1);
