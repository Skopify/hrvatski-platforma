/**
 * Het beschikbare lexicon op een gegeven punt in de leergang.
 * Draai met: npm run lexicon -- 18
 *
 * §7 van de spec zet dit als stap één van de contentpijplijn: eerst vaststellen
 * binnen welke woorden geschreven mag worden, dán schrijven. De vijf oudste
 * verhalen zijn andersom gemaakt — vrij geschreven en achteraf van een
 * woordenlijst voorzien — en dat is precies waarom ze op 54 tot 72% dekking uit
 * de leergang uitkomen. Wie het lexicon achteraf vaststelt, kan alleen nog
 * repareren.
 */
import { loadLessons } from "../src/lib/content";

const tot = Number(process.argv[2] ?? "21");
const lessen = loadLessons()
  .sort((a, b) => a.number - b.number)
  .filter((l) => l.number <= tot);

const perSoort = new Map<string, { hr: string; nl: string; les: number }[]>();
for (const les of lessen) {
  for (const v of les.vocab) {
    const lijst = perSoort.get(v.pos) ?? [];
    lijst.push({ hr: v.hr, nl: v.nl, les: les.number });
    perSoort.set(v.pos, lijst);
  }
}

const volgorde = ["noun", "verb", "adj", "adv", "prep", "pron", "num", "phrase", "conj", "interj"];
let totaal = 0;
for (const soort of [...volgorde, ...[...perSoort.keys()].filter((k) => !volgorde.includes(k))]) {
  const lijst = perSoort.get(soort);
  if (!lijst?.length) continue;
  totaal += lijst.length;
  console.log(`\n=== ${soort} (${lijst.length}) ===`);
  console.log(lijst.map((v) => `${v.hr} (${v.nl})`).join(" · "));
}
console.log(`\n${totaal} woorden beschikbaar na les ${tot} (lessen 1 t/m ${lessen.at(-1)?.number}).`);
