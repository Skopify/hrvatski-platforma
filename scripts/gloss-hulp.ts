/**
 * Glossen voorstellen voor een verhaal. Draai met: npm run gloss -- <slug>
 *
 * Elk woord in een verhaal moet aantikbaar zijn — dat is wat een verhaal tot
 * leesmateriaal maakt in plaats van een muur tekst. Bij een verhaal van
 * tweehonderdvijftig woorden zijn dat honderd glossen, en die met de hand
 * intikken kost meer tijd dan het schrijven van het verhaal zelf.
 *
 * Wat dit script kan, doet het: de vormcatalogus weet dat «kući» de locatief
 * van «kuća» is, en de woordenlijst weet dat «kuća» huis betekent. Samen is dat
 * precies wat een gloss nodig heeft.
 *
 * Wat het niet kan, laat het leeg met een «??». Een gloss die ernaast zit, is
 * erger dan geen gloss: hij wordt geloofd.
 */
import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { glossKey, loadStory, storySentences } from "../src/lib/content";
import { db } from "../src/lib/db";
import { items } from "../src/lib/db/schema";
import { formKey, NAAMVAL_NAAM, readingsFor } from "../src/lib/forms";

const slug = process.argv[2];
if (!slug) {
  console.log("Gebruik: npm run gloss -- <slug>");
  process.exit(1);
}
const verhaal = loadStory(slug);
if (!verhaal) {
  console.log(`Geen verhaal met slug «${slug}».`);
  process.exit(1);
}

/** Van lemma naar de Nederlandse betekenis, uit alles wat het platform kent. */
const betekenis = new Map<string, { nl: string; id: string }>();
for (const rij of db.select().from(items).where(eq(items.kind, "vocab")).all()) {
  const p = rij.payload as { hr?: string; nl?: string };
  if (p?.hr && p.nl) betekenis.set(formKey(p.hr), { nl: p.nl, id: rij.id });
}
// Het verhaal leert zelf ook woorden voor.
for (const v of verhaal.vocab) betekenis.set(formKey(v.hr), { nl: v.nl, id: v.id });

/**
 * Welke naamval een voorzetsel eist. Dezelfde tabel als in de taalcontrole,
 * en hier onmisbaar: na «o» is «školi» locatief en niet datief, maar die twee
 * vormen zijn identiek. Zonder het voorzetsel ernaast kiest de catalogus de
 * eerste lezing, en die is in de helft van de gevallen de verkeerde.
 */
const VOORZETSEL: Record<string, string[]> = {
  iz: ["gen"], od: ["gen"], do: ["gen"], kod: ["gen"], bez: ["gen"], zbog: ["gen"],
  blizu: ["gen"], pokraj: ["gen"], iznad: ["gen"], ispod: ["gen"], ispred: ["gen"],
  iza: ["gen"], između: ["gen"], oko: ["gen"], poslije: ["gen"], prije: ["gen"],
  nakon: ["gen"], preko: ["gen"], prema: ["dat"], k: ["dat"], ka: ["dat"],
  o: ["loc"], pri: ["loc"], kroz: ["acc"], niz: ["acc"], uz: ["acc"],
  u: ["acc", "loc"], na: ["acc", "loc"], pred: ["acc", "ins"], nad: ["acc", "ins"],
  pod: ["acc", "ins"], među: ["acc", "ins"], s: ["ins", "gen"], sa: ["ins", "gen"],
  po: ["loc", "acc"], za: ["acc", "gen", "ins"],
};

/**
 * Telwoorden regeren óók. Vanaf vijf volgt genitief meervoud — «pet sati» is
 * genitief, ook al ziet die vorm eruit als de nominatief meervoud.
 */
const TELWOORD_GEN_PL = new Set([
  "pet", "šest", "sedam", "osam", "devet", "deset", "jedanaest", "dvanaest",
  "trinaest", "četrnaest", "petnaest", "dvadeset", "trideset", "sto", "tisuću",
  "nekoliko", "mnogo", "puno", "malo", "koliko",
]);

const aanwezig = new Set(Object.keys(verhaal.glossary));
/** Per ontbrekend woord: het voorzetsel dat eraan voorafging, als dat er was. */
const ontbreekt = new Map<string, string | null>();
for (const z of storySentences(verhaal)) {
  const woorden = z.hr.split(/\s+/);
  for (let i = 0; i < woorden.length; i++) {
    const sleutel = glossKey(woorden[i]!);
    if (!sleutel || aanwezig.has(sleutel) || ontbreekt.has(sleutel)) continue;
    const vorige = i > 0 ? glossKey(woorden[i - 1]!) : "";
    ontbreekt.set(sleutel, VOORZETSEL[vorige] || TELWOORD_GEN_PL.has(vorige) ? vorige : null);
  }
}

const voorstel: Record<string, Record<string, string>> = {};
let raak = 0;
for (const [sleutel, voorzetsel] of ontbreekt) {
  const eigen = betekenis.get(sleutel);
  if (eigen) {
    voorstel[sleutel] = { hr: sleutel, nl: eigen.nl, item: eigen.id };
    raak++;
    continue;
  }

  /*
    Geen woordenboekvorm — dan terug via de catalogus. En daar begint het
    opletten, want een vorm heeft zelden één lezing.

    «mora» is de nominatief meervoud van «more» (zee) én de derde persoon van
    «morati» (moeten). De eerste versie van dit script nam gewoon de eerste
    lezing, en glosseerde «svaka stvar mora ići u ormar» met «zee». Zo'n gloss
    is erger dan geen gloss: hij staat er met evenveel gezag als de goede.

    Dus: eerst filteren op wat het voorzetsel toelaat, en wat daarna nog
    dubbelzinnig is over verschillende woorden, blijft leeg met «??».
  */
  let lezingen = readingsFor(sleutel);
  const toegestaan = voorzetsel
    ? (VOORZETSEL[voorzetsel] ?? (TELWOORD_GEN_PL.has(voorzetsel) ? ["gen"] : undefined))
    : undefined;
  if (toegestaan) {
    const gefilterd = lezingen.filter((l) => l.feats.case && toegestaan.includes(l.feats.case));
    if (gefilterd.length) lezingen = gefilterd;
  }

  const lemmas = [...new Set(lezingen.map((l) => formKey(l.lemma)))];
  if (lemmas.length !== 1) {
    voorstel[sleutel] = {
      hr: sleutel,
      nl: "??",
      info: lemmas.length
        ? `?? meerdere woorden mogelijk: ${lemmas.join(", ")}`
        : "??",
    };
    continue;
  }

  const lemma = betekenis.get(lemmas[0]!);
  if (!lemma) {
    voorstel[sleutel] = { hr: sleutel, nl: "??", info: "??" };
    continue;
  }

  // Eén woord, maar misschien meerdere naamvallen. Dan geen naamval noemen:
  // het lemma en de betekenis kloppen, de ontleding is niet vast te stellen.
  const eersteLezing = lezingen[0]!;
  const naamvallen = [...new Set(lezingen.map((l) => l.feats.case).filter(Boolean))];
  const getal = eersteLezing.feats.number === "pl" ? " meervoud" : " enkelvoud";
  const info =
    naamvallen.length === 1
      ? `${NAAMVAL_NAAM[naamvallen[0]!]}${getal} van ${eersteLezing.lemma}`
      : naamvallen.length > 1
        ? `vorm van ${eersteLezing.lemma}`
        : eersteLezing.label;

  voorstel[sleutel] = {
    hr: sleutel,
    nl: lemma.nl,
    lemma: eersteLezing.lemma,
    info,
    item: lemma.id,
  };
  raak++;
}

/*
  Het voorstel gaat naar .gloss/ en niet naar content/stories/.

  Dat is geen netheid maar een geleerde les: de eerste versie zette het bestand
  naast de verhalen, en `loadStories()` leest die map uit. Het voorstel werd
  ingelezen als elfde verhaal, en de contentvalidatie viel om op een verhaal
  zonder woordenlijst.
*/
const map = path.join(process.cwd(), ".gloss");
fs.mkdirSync(map, { recursive: true });
const uit = path.join(map, `${slug}.json`);
fs.writeFileSync(uit, JSON.stringify(voorstel, null, 2) + "\n", "utf8");

const open = Object.values(voorstel).filter((v) => v.nl === "??").length;
console.log(
  `${ontbreekt.size} ontbrekende gloss(en): ${raak} ingevuld uit de woordenlijst, ${open} met «??».`,
);
console.log(`Voorstel staat in ${path.relative(process.cwd(), uit)}`);
if (open) {
  console.log("\nZelf invullen:");
  for (const [k, v] of Object.entries(voorstel)) if (v.nl === "??") console.log("  " + k);
}
