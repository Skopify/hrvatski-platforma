/**
 * Validatiepoorten voor de kernwoordenschat. Draai met: npm run check:freq
 *
 * ── Wat hier wél en niet gecontroleerd kan worden ──────────────────────────
 * Het plan was "of een lemma bestaat, is machinaal te checken tegen de
 * vormcatalogus". Dat werkt niet, en het is belangrijk om te weten waarom: die
 * catalogus is opgebouwd uít de 894 bestaande woorden. Een nieuw lemma staat er
 * per definitie niet in, dus zou elke nieuwe ingang als "bestaat niet" worden
 * afgekeurd.
 *
 * Wat wél machinaal kan, en hier gebeurt:
 *   - fonotactiek: klankcombinaties die in het Kroatisch niet voorkomen
 *   - geen Cyrillisch, geen vreemde alfabetten
 *   - servismen tegen een woordenlijst
 *   - interne consistentie: leidt de verbuigingsmotor uit lemma + gen_sg + nom_pl
 *     iets af dat met zichzelf klopt?
 *   - volledigheid van de §3-velden per woordsoort
 *   - dubbelen binnen de lijst, en overlap met wat er al is
 *
 * Wat alleen een mens kan: of het woord klopt, of de vertaling klopt, en of het
 * aspectpaar het juiste is. Daar is de nakijker voor — en alles hierboven komt
 * dus niet bij hem terecht.
 */
import fs from "node:fs";
import path from "node:path";

import { loadLessons, loadStories } from "../src/lib/content";
import { validateNoun } from "../src/lib/morphology";

interface Lemma {
  rank: number;
  hr: string;
  nl: string;
  pos: string;
  gender?: "m" | "f" | "n";
  animacy?: string;
  declension?: string;
  gen_sg?: string;
  nom_pl?: string;
  aspect?: string;
  present_1sg?: string;
  aspect_partner?: string;
  review?: boolean;
  review_note?: string;
  note_nl?: string;
}

const DIR = path.join(process.cwd(), "content", "frequency");
if (!fs.existsSync(DIR)) {
  console.log("Nog geen content/frequency/ — niets te controleren.");
  process.exit(0);
}

const bestanden = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const lemmas: Lemma[] = [];
for (const f of bestanden) {
  const inhoud = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) as { lemmas: Lemma[] };
  lemmas.push(...inhoud.lemmas);
}

const problemen: string[] = [];
const gemarkeerd: Lemma[] = [];
const fout = (l: Lemma, msg: string) => problemen.push(`  rang ${l.rank} (${l.hr}): ${msg}`);

/* ------------------------------------------------------- schrift & klank --- */

/** Klankcombinaties die het Kroatisch niet kent — vangt verzonnen woorden. */
const ONMOGELIJK = /(čč|ćć|šš|žž|đđ|sč|zč|sš|zž|ii|uu)/;
const NIET_LATIJN = /[Ѐ-ӿͰ-Ͽ]/;

/**
 * Servismen. Het platform onderwijst standaardkroatisch; deze paren zijn de
 * bekendste plekken waar dat uiteenloopt.
 */
const SERVISMEN: Record<string, string> = {
  hleb: "kruh",
  voz: "vlak",
  talas: "val",
  opšte: "opće",
  sto: "stol",
  nedelja: "tjedan / nedjelja",
  srećan: "sretan",
  vazduh: "zrak",
  fudbal: "nogomet",
  ostrvo: "otok",
  porodica: "obitelj",
  hiljada: "tisuća",
};

/* -------------------------------------------------------------- controles --- */

const gezien = new Map<string, number>();
const bestaand = new Map<string, string>();
for (const les of loadLessons()) for (const v of les.vocab) bestaand.set(v.hr.toLowerCase(), v.id);
for (const s of loadStories()) for (const v of s.vocab) bestaand.set(v.hr.toLowerCase(), v.id);

const overlap: string[] = [];
/** Vormen die de motor niet kan bevestigen — voor de nakijker, niet voor de foutenlijst. */
const onbevestigd: string[] = [];

for (const l of lemmas) {
  const sleutel = l.hr.toLowerCase();

  if (gezien.has(sleutel)) fout(l, `staat al op rang ${gezien.get(sleutel)}`);
  else gezien.set(sleutel, l.rank);

  if (NIET_LATIJN.test(l.hr)) fout(l, "bevat niet-Latijns schrift");
  if (ONMOGELIJK.test(l.hr)) fout(l, "bevat een klankcombinatie die het Kroatisch niet kent");
  if (!l.nl?.trim()) fout(l, "geen Nederlandse vertaling");

  const servisme = SERVISMEN[sleutel];
  if (servisme) fout(l, `Servische variant — gebruik ${servisme}`);

  if (bestaand.has(sleutel)) overlap.push(`${l.hr} (${bestaand.get(sleutel)})`);

  // §3-velden per woordsoort. Ontbreekt er iets, dan hoort er review: true te
  // staan — een ontbrekend veld zonder markering is een gat dat niemand ziet.
  const mist: string[] = [];
  if (l.pos === "noun") {
    if (!l.gender) mist.push("gender");
    if (!l.gen_sg) mist.push("gen_sg");
    if (!l.nom_pl) mist.push("nom_pl");
  } else if (l.pos === "verb") {
    if (!l.aspect) mist.push("aspect");
    if (!l.present_1sg) mist.push("present_1sg");
  }
  if (mist.length && !l.review) {
    fout(l, `mist ${mist.join(", ")} zonder review-markering`);
  }

  if (l.review) {
    gemarkeerd.push(l);
    if (!l.review_note) fout(l, "gemarkeerd voor review zonder toelichting");
  }

  // Interne consistentie van de verbuiging: klopt gen_sg met het lemma?
  if (l.pos === "noun" && l.gender && l.gen_sg && !l.review) {
    const uitkomst = validateNoun({
      id: `v.freq.${l.rank}`,
      hr: l.hr,
      nl: l.nl,
      pos: "noun",
      gender: l.gender,
      animacy: (l.animacy as "animate" | "inanimate") ?? "inanimate",
      declension: l.declension,
      gen_sg: l.gen_sg,
      nom_pl: l.nom_pl,
    });
    // Een afwijking van het regelmatige patroon is geen fout maar een grens van
    // de controle. Vluchtige a wordt bevestigd; een -men-stam of een echt
    // onregelmatige vorm kan alleen een mens beoordelen, en gaat dus naar de
    // reviewlijst in plaats van naar de foutenlijst.
    if (uitkomst.verdict === "unverifiable") {
      onbevestigd.push(
        `${l.hr} → ${uitkomst.got} (regelmatig zou ${uitkomst.expected} zijn)`,
      );
    } else if (uitkomst.verdict === "wrong") {
      fout(l, `genitief hoort ${uitkomst.expected} te zijn, lijst zegt ${uitkomst.got}`);
    }
  }
}

/* ----------------------------------------------------------------- verslag --- */

const perSoort = new Map<string, number>();
for (const l of lemmas) perSoort.set(l.pos, (perSoort.get(l.pos) ?? 0) + 1);

console.log(`\nKernwoordenschat — ${lemmas.length} lemma's uit ${bestanden.length} bestand(en)`);
console.log("─".repeat(64));
console.log(
  "per woordsoort: " +
    [...perSoort].map(([p, n]) => `${p} ${n}`).join(" · "),
);
console.log(`al aanwezig in de cursus: ${overlap.length}`);
if (overlap.length) console.log(`  ${overlap.slice(0, 12).join(", ")}${overlap.length > 12 ? " …" : ""}`);
console.log(`\nniet machinaal te bevestigen (${onbevestigd.length}) — onregelmatige stammen:`);
for (const o of onbevestigd) console.log(`  ${o}`);
console.log(`\ngemarkeerd voor de nakijker: ${gemarkeerd.length}`);
for (const l of gemarkeerd) console.log(`  ${l.hr} — ${l.review_note}`);

const schoon = lemmas.length - problemen.length - gemarkeerd.length - onbevestigd.length;
console.log(`\nschoon door de poorten: ${schoon} van ${lemmas.length}`);
console.log(`voor de nakijker: ${gemarkeerd.length + onbevestigd.length} (${gemarkeerd.length} gemarkeerd + ${onbevestigd.length} onbevestigde vormen)`);

if (problemen.length) {
  console.log(`\n${problemen.length} probleem/problemen:`);
  for (const p of problemen) console.log(p);
  process.exit(1);
}
console.log("\nGeen machinale problemen gevonden.");
