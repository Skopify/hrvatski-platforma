/**
 * De validatiepoorten voor verhalen uit §7. Draai met: npm run check:verhalen
 *
 * Dit meet iets anders dan de dekkingsmeter in de app. Die vraagt: kent déze
 * leerder genoeg woorden voor dit verhaal? Dat hangt af van hoeveel hij geleerd
 * heeft en zegt niets over het verhaal zelf.
 *
 * Hier is de vraag: is dit verhaal geschikt voor de leerder voor wie het
 * geschreven is — iemand die de lessen tot en met `requires_lesson` heeft
 * gedaan? Dat is een eigenschap van de tekst, en die hoort te kloppen voordat
 * er iemand aan begint.
 */
import {
  glossKey,
  loadLessons,
  loadStories,
  storySentences,
  storyWordCount,
  type Story,
} from "../src/lib/content";
import { FUNCTION_WORDS, formKey, readingsFor } from "../src/lib/forms";
import { vindServismen } from "../src/lib/servisms";

/*
  Bandbreedtes per niveau, in lopende woorden.

  Uit de praktijk van gegradeerde lezers: een A1-tekst die langer is dan
  honderdvijftig woorden wordt een vermoeiende opsomming, en een B1-tekst van
  honderd woorden is geen tekst maar een alinea. De ondergrens doet er net zo
  veel toe als de bovengrens — te kort betekent dat een structuur niet vaak
  genoeg terugkomt om te blijven hangen.
*/
const LENGTE: Record<string, [number, number]> = {
  "A1.1": [50, 120],
  "A1.2": [70, 150],
  "A2.1": [120, 250],
  "A2.2": [150, 300],
  B1: [250, 450],
  B2: [350, 600],
};

/** Hoeveel nieuwe woorden een niveau verdraagt, en hoe vaak elk moet terugkomen. */
const NIEUW: Record<string, number> = {
  "A1.1": 8,
  "A1.2": 10,
  "A2.1": 14,
  "A2.2": 18,
  B1: 22,
  B2: 28,
};
const MIN_VOORKOMENS = 2;

/* ------------------------------------------------------------ het lexicon --- */

const lessen = loadLessons().sort((a, b) => a.number - b.number);

/**
 * De woordenboekvormen die een leerder kent na les `nr`.
 *
 * Alleen de lemma's. De vormen komen bij het meten uit de vormcatalogus: die
 * weet dat «kući» bij «kuća» hoort, en zonder die stap zou elk verbogen woord
 * als onbekend gelden. Dan meet je of iemand naamvallen kent in plaats van of
 * hij het woord kent, en dat is een andere vraag.
 */
function lemmasTot(nr: number): Set<string> {
  const uit = new Set<string>();
  for (const les of lessen) {
    if (les.number > nr) break;
    for (const v of les.vocab) uit.add(formKey(v.hr));
  }
  return uit;
}

/**
 * Kent iemand met dit lexicon dit woord?
 *
 * Drie manieren waarop het antwoord ja is: het is een functiewoord, het staat
 * er letterlijk in, of de vormcatalogus brengt het terug bij een lemma dat
 * erin staat.
 */
function kent(lemmas: Set<string>, token: string): boolean {
  if (FUNCTION_WORDS.has(token) || lemmas.has(token)) return true;
  return readingsFor(token).some((l) => lemmas.has(formKey(l.lemma)));
}

/* ------------------------------------------------------------- de meting --- */

interface Uitslag {
  slug: string;
  cefr: string;
  les: number;
  woorden: number;
  lengteOk: boolean;
  lengteBand: [number, number];
  dekking: number;
  dekkingMetVoorleren: number;
  onbekend: string[];
  nieuw: number;
  dubbel: number;
  nieuwMax: number;
  zeldzaam: { woord: string; n: number }[];
  servismen: string[];
  zinnen: number;
  gemLengte: number;
}

function meet(verhaal: Story): Uitslag {
  const lemmas = lemmasTot(verhaal.requires_lesson);

  const zinnen = storySentences(verhaal);
  const tokens: string[] = [];
  for (const z of zinnen) {
    for (const ruw of z.hr.split(/\s+/)) {
      const k = glossKey(ruw);
      if (k) tokens.push(k);
    }
  }

  /*
    Twee dekkingscijfers, en dat is met opzet.

    Het eerste is de dekking uit de leergang alleen: wat kent iemand die de
    lessen tot hier heeft gedaan, zonder dat dit verhaal hem iets bijleert? Dat
    zegt hoe zwaar de tekst is.

    Het tweede telt de eigen woordenlijst van het verhaal mee. Dat is wat de
    lezer werkelijk meemaakt — hij krijgt die woorden immers vooraf. Alleen dat
    tweede cijfer meten had geen zin: elk verhaal leert precies de woorden voor
    die het gebruikt, dus dan staat er altijd honderd procent, en een poort die
    altijd open staat is geen poort.
  */
  const voorgeleerd = new Set<string>();
  for (const v of verhaal.vocab) voorgeleerd.add(formKey(v.hr));
  for (const sleutel of Object.keys(verhaal.glossary)) voorgeleerd.add(formKey(sleutel));

  const kaal = tokens.filter((t) => kent(lemmas, t)).length;
  const metVoorleren = tokens.filter(
    (t) => kent(lemmas, t) || voorgeleerd.has(t) || readingsFor(t).some((l) => voorgeleerd.has(formKey(l.lemma))),
  ).length;

  const onbekend = [...new Set(tokens.filter((t) => !kent(lemmas, t)))];

  /*
    Hoe vaak komt elk nieuw woord voor?

    Twee dingen die eerder misgingen.

    Tellen op de woordenboekvorm werkte niet: «rajčica» staat in de tekst als
    «rajčice» en kwam op nul uit, terwijl het woord er gewoon staat. Nu loopt
    het via de glossen — die wijzen elk woord in de tekst aan zijn item toe, en
    dat is precies waar ze voor zijn.

    En er wordt over de hele serie geteld, niet per hoofdstuk. Dat is het punt
    van narrow reading uit §5.2: je leest vijf verhalen over dezelfde mensen op
    dezelfde plek, en «trajekt» komt in deel drie terug omdat het verhaal
    erover gaat, niet omdat een regel dat eist. Per hoofdstuk tellen zou me
    dwingen woorden kunstmatig te herhalen, en dat maakt de tekst slechter in
    plaats van beter.
  */
  const serie = verhaal.series
    ? loadStories().filter((x) => x.series === verhaal.series)
    : [verhaal];
  /*
    Geteld op het wóórd, niet op het item-id. Elk verhaal geeft zijn eigen
    woordenlijst eigen id's — `v.pr7.riba` naast `v.pr9.riba` — en op id
    tellen kwam daarom voor élk woord op precies één uit, ook als het in drie
    delen van de serie voorkwam. Een meting die overal hetzelfde antwoord
    geeft, meet niets.
  */
  /*
    «Nieuw» is alleen wat de leergang op dit punt nog niet gegeven heeft.

    Een flink deel van elke verhaalwoordenlijst staat al in de lessen: van de
    veertien woorden bij «Nina ide na tržnicu» zijn er tien al in les 8
    behandeld. Die als nieuw tellen maakte elk verhaal zwaarder dan het is.

    De dubbele items zelf blijven staan. Ze zijn overbodig — het platform heeft
    nu twee kaarten voor «kruh» — maar op zes ervan staat al een beoordeling,
    en reviewhistorie weggooien om een telling mooier te maken is de verkeerde
    ruil. Dat opruimen vraagt een migratie die de kaarten samenvoegt.
  */
  const alBekend = verhaal.vocab.filter((v) => lemmas.has(formKey(v.hr)));
  const echtNieuw = verhaal.vocab.filter((v) => !lemmas.has(formKey(v.hr)));

  const perLemma = new Map<string, number>();
  for (const deel of serie) {
    for (const z of storySentences(deel)) {
      for (const ruw of z.hr.split(/\s+/)) {
        const k = glossKey(ruw);
        if (!k) continue;
        const gloss = deel.glossary[k];
        const lemma = formKey(gloss?.lemma ?? k);
        perLemma.set(lemma, (perLemma.get(lemma) ?? 0) + 1);
      }
    }
  }
  const zeldzaam = echtNieuw
    .map((v) => ({ woord: v.hr, n: perLemma.get(formKey(v.hr)) ?? 0 }))
    .filter((x) => x.n < MIN_VOORKOMENS);

  const servismen = zinnen.flatMap((z) => vindServismen(z.hr).map((m) => m.fout));
  const woorden = storyWordCount(verhaal);
  const band = LENGTE[verhaal.cefr] ?? [0, 9999];

  return {
    slug: verhaal.slug,
    cefr: verhaal.cefr,
    les: verhaal.requires_lesson,
    woorden,
    lengteOk: woorden >= band[0] && woorden <= band[1],
    lengteBand: band,
    dekking: tokens.length ? kaal / tokens.length : 0,
    dekkingMetVoorleren: tokens.length ? metVoorleren / tokens.length : 0,
    onbekend,
    nieuw: echtNieuw.length,
    dubbel: alBekend.length,
    nieuwMax: NIEUW[verhaal.cefr] ?? 99,
    zeldzaam,
    servismen,
    zinnen: zinnen.length,
    gemLengte: zinnen.length ? woorden / zinnen.length : 0,
  };
}

/* ---------------------------------------------------------------- verslag --- */

const uitslagen = loadStories()
  .sort((a, b) => a.requires_lesson - b.requires_lesson)
  .map(meet);

console.log(
  "verhaal                niveau  les  woorden  band        uit de les  met voorleren  nieuw  dubbel  zin",
);
for (const u of uitslagen) {
  console.log(
    u.slug.padEnd(23) +
      u.cefr.padEnd(8) +
      String(u.les).padStart(3) +
      String(u.woorden).padStart(9) +
      (u.lengteOk ? " " : "!") +
      ` ${u.lengteBand[0]}–${u.lengteBand[1]}`.padEnd(12) +
      `${(u.dekking * 100).toFixed(0)}%`.padStart(9) +
      `${(u.dekkingMetVoorleren * 100).toFixed(0)}%`.padStart(14) +
      (u.dekkingMetVoorleren >= 0.95 ? " " : "!") +
      String(u.nieuw).padStart(6) +
      (u.nieuw <= u.nieuwMax ? " " : "!") +
      String(u.dubbel).padStart(7) +
      u.gemLengte.toFixed(1).padStart(6),
  );
}

const problemen: string[] = [];
for (const u of uitslagen) {
  if (!u.lengteOk) {
    problemen.push(
      `${u.slug}: ${u.woorden} woorden, buiten de band ${u.lengteBand[0]}–${u.lengteBand[1]} voor ${u.cefr}`,
    );
  }
  if (u.dekkingMetVoorleren < 0.95) {
    problemen.push(
      `${u.slug}: ook mét de eigen woordenlijst blijft ${((1 - u.dekkingMetVoorleren) * 100).toFixed(1)}% ` +
        `van de tekst onaantikbaar: ${u.onbekend.slice(0, 10).join(", ")}`,
    );
  }
  if (u.nieuw > u.nieuwMax) {
    problemen.push(
      `${u.slug}: ${u.nieuw} nieuwe woorden, meer dan de ${u.nieuwMax} die ${u.cefr} verdraagt`,
    );
  }
  if (u.zeldzaam.length) {
    problemen.push(
      `${u.slug}: ${u.zeldzaam.length} nieuw woord(en) komen in de hele serie minder dan ${MIN_VOORKOMENS}× voor: ` +
        u.zeldzaam.slice(0, 8).map((z) => `${z.woord} (${z.n}×)`).join(", "),
    );
  }
  if (u.servismen.length) problemen.push(`${u.slug}: Servische vorm(en): ${u.servismen.join(", ")}`);
}

const dubbelTotaal = uitslagen.reduce((n, u) => n + u.dubbel, 0);
if (dubbelTotaal) {
  console.log(
    `\n${dubbelTotaal} verhaalwoord(en) staan al in de lessen en hebben nu een tweede item.\n` +
      "   Dat splitst de SRS in twee kaarten voor hetzelfde woord. Opruimen vraagt een\n" +
      "   migratie die de kaarten samenvoegt — er staat al reviewhistorie op.",
  );
}

if (problemen.length) {
  console.log(`\n${problemen.length} bevinding(en):\n`);
  for (const p of problemen) console.log("  · " + p);
} else {
  console.log("\nAlle verhalen binnen hun poorten.");
}
