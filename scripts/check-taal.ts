/**
 * Taalcontrole. Draai met: npm run check:taal
 *
 * Waar check:content de structuur bewaakt (id's, ontbrekende antwoorden,
 * dekkende glossen), kijkt dit script naar de táál zelf: elk Kroatisch woord dat
 * ergens op het scherm komt, wordt langs de vormcatalogus gehaald.
 *
 * Waarom dat nodig is: de vormcatalogus kent ruim vijfduizend vormen die de
 * verbuigingsmotor uit de woordenlijst afleidt. Een woord in een oefenzin dat
 * daar niet in voorkomt, is één van drie dingen — een tikfout, een vorm die de
 * motor niet maakt, of een woord dat gewoon niet in de leergang zit. Alle drie
 * wil je weten. De eerste is een fout die de leerder verkeerd leert, de tweede
 * een gat in de motor, en de derde een woord dat onaantikbaar op het scherm
 * staat.
 *
 * Dit script keurt géén grammatica goed. Dat kan het niet: dat «kuću» bestaat
 * zegt niets over of hij op die plek in die zin hoort. Wat het wél doet, is de
 * berg klein genoeg maken dat een moedertaalspreker de rest kan nakijken.
 */
import fs from "node:fs";
import path from "node:path";

import {
  lessonExercises,
  loadLessons,
  loadStories,
  storySentences,
  type Exercise,
  type ExerciseType,
} from "../src/lib/content";
import {
  FUNCTION_WORDS,
  formIndex,
  formKey,
  NAAMVAL_NAAM,
  readingsFor,
  type Naamval,
} from "../src/lib/forms";
import { loadModules, moduleExercises } from "../src/lib/modules";
import { SERVISMEN, vindServismen } from "../src/lib/servisms";
import { VOORZETSEL_NAAMVAL } from "../src/lib/tekstcontrole";

/* -------------------------------------------------------------- zelftest --- */

/*
  Eerst bewijzen dat de controle werkt, dan pas rapporteren.

  Zonder dit stuk betekent «geen fouten gevonden» twee dingen tegelijk: de
  content klopt, óf de controle is stuk. Die twee zijn van buiten niet uit
  elkaar te houden, en de tweede is precies wat er gebeurt als iemand een
  reguliere expressie aanpast. Elke regel hieronder is een fout die de controle
  moet zien, en een correcte zin die hij met rust moet laten.
*/
const ZELFTEST: [string, boolean][] = [
  ["Idem na voz u sedam sati.", true],
  ["Kupujem hleb i mleko.", true],
  ["Ovo je lep grad.", true],
  ["Moram da idem kući.", true],
  ["Ko je to?", true],
  ["Idem na vlak u sedam sati.", false],
  ["Kupujem kruh i mlijeko.", false],
  ["Ovo je lijep grad.", false],
  ["Moram ići kući.", false],
  ["Tko je to?", false],
  // Een gewone bijzin met `da` is geen servisme; alleen na een modaal werkwoord.
  ["Mislim da je dobro.", false],
];

const zelftestFouten = ZELFTEST.filter(
  ([zin, moetMelden]) => vindServismen(zin).length > 0 !== moetMelden,
);
if (zelftestFouten.length) {
  console.log("De taalcontrole zelf is stuk — deze zinnen worden verkeerd beoordeeld:");
  for (const [zin] of zelftestFouten) console.log(`  ${zin}`);
  process.exit(1);
}

/* ------------------------------------------------------------ welk veld --- */

/**
 * Welke velden Kroatisch bevatten, per oefeningtype.
 *
 * Dit moet expliciet, want het is niet af te leiden uit het veld. Bij
 * `translate_nl_hr` is `given` Nederlands en `answer` Kroatisch; bij
 * `translate_hr_nl` precies andersom. En bij `interpret` is het antwoord de
 * bétekenis — dus Nederlands, terwijl de zin erboven Kroatisch is. Een script
 * dat dat door elkaar haalt, meldt honderden Nederlandse woorden als
 * onbekend Kroatisch en wordt daarmee onbruikbaar.
 */
type Veld = "given" | "answer" | "accepts" | "tokens" | "pairs" | "model_answer";

const KROATISCH: Partial<Record<ExerciseType, Veld[]>> = {
  reading: ["given"],
  cloze: ["given", "answer", "accepts"],
  translate_nl_hr: ["answer", "accepts"],
  translate_hr_nl: ["given"],
  word_order: ["answer", "accepts", "tokens"],
  // Bij een verbeteroefening is `given` de foute zin — die hóórt niet te kloppen.
  error_correction: ["answer", "accepts"],
  interpret: ["given"],
  listen_type: ["answer", "accepts"],
  match: ["pairs"],
  free_production: ["model_answer"],
  // choice en teaching_moment: zie hieronder, die zijn gemengd.
};

/*
  Afleiders staan met opzet niet in deze tabel.

  Een goede afleider ís vaak een niet-bestaande vorm: «učiju» naast «uče» laat
  precies de fout zien die een leerder maakt. Ze langs de vormcatalogus halen
  meldt dus juist het geslaagde werk als fout — en dat is de snelste manier om
  een controle onbruikbaar te maken.
*/

/**
 * Bij meerkeuze hangt het van de opgave af: soms zijn de opties Kroatische
 * vormen («kući / kuću»), soms Nederlandse betekenissen («in het huis / naar
 * het huis»). Één blik op de opties beslist: staat er een spatie in, dan is het
 * een omschrijving en geen woordvorm.
 */
function keuzeIsKroatisch(e: Exercise): boolean {
  const opties = [e.answer, ...(e.distractors ?? [])].filter(Boolean) as string[];
  if (!opties.length) return false;
  return opties.every((o) => !o.includes(" "));
}

/* ---------------------------------------------------------- woordenlijst --- */

const NAMEN_PAD = path.join(process.cwd(), "content", "namen.json");

/**
 * Eigennamen en leenwoorden die niet in de leergang staan maar wel op het
 * scherm mogen komen. Los bestand, geen lijst in de code: wie een verhaal
 * schrijft dat in Rijeka speelt, hoort geen script te hoeven aanpassen.
 */
function laadNamen(): Set<string> {
  if (!fs.existsSync(NAMEN_PAD)) return new Set();
  const raw = JSON.parse(fs.readFileSync(NAMEN_PAD, "utf8")) as {
    namen?: string[];
    klankvoorbeelden?: string[];
  };
  return new Set([...(raw.namen ?? []), ...(raw.klankvoorbeelden ?? [])].map(formKey));
}

const namen = laadNamen();

/**
 * Wat al is nagekeken.
 *
 * Zonder deze lijst zou de controle elke keer dezelfde drie meldingen geven die
 * bij inspectie goed bleken, en dan wordt hij niet meer gelezen. Mét de lijst
 * is elke nieuwe melding per definitie nieuw — en dus het bekijken waard.
 */
const NAGEKEKEN_PAD = path.join(process.cwd(), "content", "taalcontrole.json");
const nagekeken: { spelling_nagekeken?: Record<string, string>; naamval_nagekeken?: Record<string, string> } =
  fs.existsSync(NAGEKEKEN_PAD) ? JSON.parse(fs.readFileSync(NAGEKEKEN_PAD, "utf8")) : {};
const spellingOk = new Set(Object.keys(nagekeken.spelling_nagekeken ?? {}).map(formKey));
const naamvalOk = new Set(Object.keys(nagekeken.naamval_nagekeken ?? {}).map((k) => k.toLowerCase()));

/** Diakrieten eraf: kuća → kuca. Voor het herkennen van ontbrekende tekens. */
function kaal(woord: string): string {
  return woord
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Van kale sleutel naar de vormen die er mét diakrieten bestaan. */
const kaalIndex = new Map<string, Set<string>>();
for (const sleutel of formIndex().keys()) {
  const k = kaal(sleutel);
  const set = kaalIndex.get(k);
  if (set) set.add(sleutel);
  else kaalIndex.set(k, new Set([sleutel]));
}
for (const w of FUNCTION_WORDS) {
  const k = kaal(w);
  const set = kaalIndex.get(k);
  if (set) set.add(w);
  else kaalIndex.set(k, new Set([w]));
}

/* --------------------------------------------------------- Nederlands --- */

/**
 * Een Nederlandse woordenlijst, opgebouwd uit het platform zelf.
 *
 * Nodig omdat veel velden tweetalig zijn: een paradigmatabel heeft een kolom
 * met vormen en een kolom met betekenissen, en een meerkeuzevraag kan zowel
 * «kući / kuću» als «wit / zwart» als opties hebben. Zonder deze lijst meldde
 * het script honderden Nederlandse woorden als onbekend Kroatisch, en daarmee
 * verdronken de acht echte tikfouten.
 *
 * De lijst komt uit de Nederlandse velden van alle content — glossen, uitleg,
 * opdrachten. Wat daarin tussen «guillemets» of in **vet** staat is juist het
 * Kroatisch waar de uitleg over gaat, en dat wordt er eerst uitgeknipt.
 */
const nederlands = new Set<string>();

function leerNederlands(tekst: string | undefined) {
  if (!tekst) return;
  const zonderHr = tekst.replace(/«[^»]*»/g, " ").replace(/\*\*[^*]*\*\*/g, " ");
  for (const w of woorden(zonderHr)) {
    const k = formKey(w);
    if (k) nederlands.add(k);
  }
}

/* ------------------------------------------------------------- bevinding --- */

interface Bevinding {
  woord: string;
  soort: "diakriet" | "vorm" | "onbekend";
  suggestie?: string;
  plekken: string[];
}

/**
 * Stammen van alles wat het platform als woord kent.
 *
 * Hiermee valt het verschil te zien tussen twee soorten onbekende woorden. Is
 * «zidovi» onbekend terwijl «zid» in de woordenlijst staat, dan is het een
 * vorm die de verbuigingsmotor niet maakt — het woord klopt, de catalogus is
 * incompleet. Staat er niets in de buurt, dan is het een woord dat er
 * helemaal niet hoort te staan, en dát is waar tikfouten zich verstoppen.
 */
const stammen = new Set<string>();
for (const lezingen of formIndex().values()) {
  for (const l of lezingen) {
    const lemma = formKey(l.lemma);
    for (let n = 3; n <= lemma.length; n++) stammen.add(lemma.slice(0, n));
  }
}

function isVormVanBekendWoord(woord: string): boolean {
  // De langste stam die dit woord kan hebben, is het woord min zijn uitgang.
  for (let n = Math.min(woord.length, 8); n >= 3; n--) {
    if (stammen.has(woord.slice(0, n))) return n >= 4 || woord.length <= 5;
  }
  return false;
}

const bevindingen = new Map<string, Bevinding>();

function meld(woord: string, plek: string, extraBekend: Set<string>) {
  const sleutel = formKey(woord);
  if (!sleutel) return;
  if (/^\d/.test(sleutel)) return;
  if (FUNCTION_WORDS.has(sleutel) || namen.has(sleutel) || extraBekend.has(sleutel)) return;
  if (readingsFor(sleutel).length) return;
  if (nederlands.has(sleutel)) return;

  // Bestaat het woord wél met diakrieten? Dan is het bijna altijd een tikfout.
  const metTekens = [...(kaalIndex.get(kaal(sleutel)) ?? [])].filter((v) => v !== sleutel);
  const soort: Bevinding["soort"] = metTekens.length
    ? "diakriet"
    : isVormVanBekendWoord(sleutel)
      ? "vorm"
      : "onbekend";

  const bestaand = bevindingen.get(sleutel);
  if (bestaand) {
    if (bestaand.plekken.length < 6) bestaand.plekken.push(plek);
    return;
  }
  bevindingen.set(sleutel, {
    woord: sleutel,
    soort,
    suggestie: metTekens[0],
    plekken: [plek],
  });
}

/**
 * Een Kroatische zin uit elkaar halen. Koppelteken telt als woordteken.
 *
 * De sterretjes van de opmaak gaan er eerst uit, niet als scheidingsteken maar
 * spoorloos. In de uitleg staat vaak nadruk midden in een woord — «maj**ka**»
 * om de uitgang te laten zien — en wie op sterretjes splitst houdt «maj» over.
 * Dat werd keurig gemeld als de Servische naam voor mei.
 */
function woorden(tekst: string): string[] {
  return tekst.replace(/[*_]/g, "").split(/[^\p{L}\p{N}\-]+/u).filter(Boolean);
}

function scanZin(tekst: string | undefined, plek: string, extraBekend: Set<string>) {
  if (!tekst) return;
  // Gaten in invuloefeningen (___ of ...) en losse letters overslaan.
  const schoon = tekst.replace(/_{2,}/g, " ").replace(/\.{3}/g, " ");
  for (const w of woorden(schoon)) meld(w, plek, extraBekend);
}

/**
 * Kroatisch dat tussen Nederlandse uitleg staat. In de modules is dat de
 * hoofdmoot: elke regel uitleg noemt de vormen waar het over gaat, en die
 * staan tussen «guillemets» of in **vet**. Buiten die tekens staat Nederlands,
 * en dat blijft hier dus buiten schot.
 */
function scanInline(tekst: string | undefined, plek: string, extraBekend: Set<string>) {
  if (!tekst) return;
  const brokken = [
    ...[...tekst.matchAll(/«([^»]+)»/g)].map((m) => m[1]!),
    ...[...tekst.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]!),
  ];
  for (const brok of brokken) {
    // Een Nederlandse zin in vet is geen Kroatisch. Ruwe zeef: bevat hij een
    // Nederlands functiewoord, dan is het Nederlands.
    if (/\b(de|het|een|is|zijn|niet|van|met|dat|je|wordt|maar|dus|want)\b/i.test(brok)) continue;
    scanZin(brok, plek, extraBekend);
  }
}

function scanOefening(e: Exercise, plek: string, extraBekend: Set<string>) {
  const velden = e.type === "choice"
    ? (keuzeIsKroatisch(e) ? (["given", "answer", "accepts"] as Veld[]) : (["given"] as Veld[]))
    : KROATISCH[e.type] ?? [];

  for (const veld of velden) {
    if (veld === "tokens") for (const t of e.tokens ?? []) scanZin(t, `${plek}:tokens`, extraBekend);
    else if (veld === "pairs") for (const p of e.pairs ?? []) scanZin(p.hr, `${plek}:pairs`, extraBekend);
    else if (veld === "accepts") for (const a of e.accepts ?? []) scanZin(a, `${plek}:accepts`, extraBekend);
    else scanZin(e[veld] as string | undefined, `${plek}:${veld}`, extraBekend);
  }

  // De Nederlandse velden: alleen wat expliciet als Kroatisch gemarkeerd staat.
  scanInline(e.prompt_nl, `${plek}:prompt`, extraBekend);
  scanInline(e.body_nl, `${plek}:uitleg`, extraBekend);
  scanInline(e.explain_nl, `${plek}:uitleg`, extraBekend);
  scanInline(e.hint, `${plek}:hint`, extraBekend);
  scanInline(e.nudge, `${plek}:zetje`, extraBekend);
  for (const r of e.rubric_nl ?? []) scanInline(r, `${plek}:criterium`, extraBekend);
  for (const rij of e.table?.rows ?? []) {
    for (const cel of rij.cells) scanZin(cel, `${plek}:tabel`, extraBekend);
  }
}

/* ----------------------------------------------------------------- lopen --- */

const leeg = new Set<string>();

/*
  Eerste doorloop: leer het Nederlands van dit platform kennen. Dit moet
  compleet zijn vóór de tweede doorloop begint — een woord dat pas in les 19
  in het Nederlands voorkomt, moet ook in les 3 niet als Kroatisch gelden.
*/
function nlVanOefening(e: Exercise) {
  leerNederlands(e.prompt_nl);
  leerNederlands(e.body_nl);
  leerNederlands(e.explain_nl);
  leerNederlands(e.hint);
  leerNederlands(e.nudge);
  leerNederlands(e.placeholder);
  for (const r of e.rubric_nl ?? []) leerNederlands(r);
  for (const p of e.pairs ?? []) leerNederlands(p.nl);
  // De kolomkoppen van een tabel zijn Nederlands; de cellen niet altijd.
  for (const k of e.table?.columns ?? []) leerNederlands(k);
  for (const rij of e.table?.rows ?? []) leerNederlands(rij.label);
}

for (const les of loadLessons()) {
  leerNederlands(les.title_nl);
  for (const c of les.can_do_nl) leerNederlands(c);
  for (const v of les.vocab) leerNederlands(v.nl);
  for (const g of les.grammar) {
    leerNederlands(g.title_nl);
    leerNederlands(g.explanation_nl);
    leerNederlands(g.contrast_nl);
    for (const pf of g.pitfalls_nl ?? []) leerNederlands(pf);
    leerNederlands(g.paradigm?.caption_nl);
    for (const k of g.paradigm?.columns ?? []) leerNederlands(k);
    for (const rij of g.paradigm?.rows ?? []) leerNederlands(rij.label);
  }
  for (const sec of les.sections) {
    leerNederlands(sec.title_nl);
    leerNederlands(sec.translation_nl);
  }
  for (const e of lessonExercises(les)) nlVanOefening(e);
}

for (const m of loadModules()) {
  leerNederlands(m.title_nl);
  leerNederlands(m.grammar.title_nl);
  leerNederlands(m.grammar.explanation_nl);
  leerNederlands(m.grammar.contrast_nl);
  for (const pf of m.grammar.pitfalls_nl ?? []) leerNederlands(pf);
  leerNederlands(m.grammar.paradigm?.caption_nl);
  for (const k of m.grammar.paradigm?.columns ?? []) leerNederlands(k);
  for (const rij of m.grammar.paradigm?.rows ?? []) leerNederlands(rij.label);
  for (const e of moduleExercises(m)) nlVanOefening(e);
}

for (const verhaal of loadStories()) {
  leerNederlands(verhaal.title_nl);
  for (const z of storySentences(verhaal)) leerNederlands(z.nl);
  for (const gloss of Object.values(verhaal.glossary)) leerNederlands(gloss.nl);
  for (const v of verhaal.vocab) leerNederlands(v.nl);
  for (const e of verhaal.exercises) nlVanOefening(e);
  for (const q of verhaal.comprehension ?? []) nlVanOefening(q as Exercise);
}

/* Tweede doorloop: nu pas het Kroatisch beoordelen. */


for (const les of loadLessons()) {
  for (const v of les.vocab) {
    scanZin(v.gen_sg, `${v.id}:gen`, leeg);
    scanZin(v.nom_pl, `${v.id}:mv`, leeg);
  }
  for (const g of les.grammar) {
    for (const rij of g.paradigm?.rows ?? []) {
      for (const cel of rij.cells) scanZin(cel, `${g.id}:paradigma`, leeg);
    }
    scanInline(g.explanation_nl, `${g.id}:uitleg`, leeg);
    scanInline(g.contrast_nl, `${g.id}:contrast`, leeg);
    for (const p of g.pitfalls_nl ?? []) scanInline(p, `${g.id}:valkuil`, leeg);
  }
  for (const s of les.sections) scanZin(s.text_hr, `${s.id}:tekst`, leeg);
  for (const e of lessonExercises(les)) scanOefening(e, e.id, leeg);
}

for (const m of loadModules()) {
  scanInline(m.grammar.explanation_nl, `${m.code}:uitleg`, leeg);
  scanInline(m.grammar.contrast_nl, `${m.code}:contrast`, leeg);
  for (const p of m.grammar.pitfalls_nl ?? []) scanInline(p, `${m.code}:valkuil`, leeg);
  for (const rij of m.grammar.paradigm?.rows ?? []) {
    for (const cel of rij.cells) scanZin(cel, `${m.code}:paradigma`, leeg);
  }
  for (const e of moduleExercises(m)) scanOefening(e, e.id, leeg);
}

for (const verhaal of loadStories()) {
  // Woorden die het verhaal zelf introduceert, tellen als bekend: die staan in
  // de eigen woordenlijst en zijn in de tekst aantikbaar.
  const eigen = new Set<string>();
  for (const v of verhaal.vocab) eigen.add(formKey(v.hr));
  for (const sleutel of Object.keys(verhaal.glossary)) eigen.add(formKey(sleutel));

  for (const z of storySentences(verhaal)) scanZin(z.hr, `${verhaal.slug}:${z.id}`, eigen);
  for (const e of verhaal.exercises) scanOefening(e, e.id, eigen);
  for (const q of verhaal.comprehension ?? []) scanOefening(q as Exercise, q.id, eigen);
}

/* ------------------------------------------------------------ rapportage --- */

const lijst = [...bevindingen.values()].sort(
  (a, b) => b.plekken.length - a.plekken.length || a.woord.localeCompare(b.woord),
);
const diakriet = lijst.filter((b) => b.soort === "diakriet" && !spellingOk.has(b.woord));
const vormen = lijst.filter((b) => b.soort === "vorm");
const onbekend = lijst.filter((b) => b.soort === "onbekend");

const toon = (b: Bevinding) =>
  `  ${b.woord.padEnd(18)}${b.suggestie ? "→ " + b.suggestie.padEnd(16) : "".padEnd(18)}` +
  `${String(b.plekken.length).padStart(2)}×  ${b.plekken.slice(0, 3).join(", ")}`;

if (diakriet.length) {
  console.log(`\nA. ${diakriet.length} woord(en) die mét diakrieten wél bestaan — vrijwel zeker een tikfout:\n`);
  for (const b of diakriet) console.log(toon(b));
}

if (vormen.length) {
  console.log(
    `\nB. ${vormen.length} vorm(en) van een woord dat het platform kent, maar die de ` +
      `verbuigingsmotor niet maakt.\n   Niet per se fout — wel onaantikbaar en niet in te plannen:\n`,
  );
  for (const b of vormen) console.log(toon(b));
}

if (onbekend.length) {
  console.log(
    `\nC. ${onbekend.length} woord(en) waar het platform niets van weet. Hier zitten de ` +
      `eigennamen tussen\n   (zet die in content/namen.json) en de echte tikfouten:\n`,
  );
  for (const b of onbekend) console.log(toon(b));
}

console.log(
  `\nA ${diakriet.length} tikfouten · B ${vormen.length} ontbrekende vormen · C ${onbekend.length} onbekende woorden`,
);

/* ================================================ voorzetsel en naamval === */

/*
  Tot hier ging het over spelling: bestaat dit woord? Dat zegt nog niets over of
  het op die plek hóórt. Deze tweede controle kijkt naar één ding dat wél
  mechanisch te beoordelen is, en dat toevallig ook de grootste valkuil van het
  Kroatisch is: welke naamval een voorzetsel eist.

  «iz» wil altijd genitief. Staat er «iz grad» in plaats van «iz grada», dan is
  dat fout — ongeacht de zin, ongeacht de betekenis. Zulke voorzetsels zijn de
  helft van de lijst hieronder.

  De andere helft is dubbel: «u» wil accusatief als je ergens naartoe gaat en
  locatief als je er bent. Daar kan dit script niet kiezen, dus accepteert het
  allebei — en vangt alleen de gevallen waar géén van beide staat.

  Meerduidigheid gaat altijd in het voordeel van de content: een woordvorm die
  óók als de goede naamval te lezen is, telt als goed. Een controle die bij
  twijfel alarm slaat, wordt na de tiende valse melding niet meer gelezen.
*/
/*
  Eén tabel, twee gebruikers.

  Deze stond hier ook, letterlijk overgeschreven, naast die in
  src/lib/tekstcontrole.ts. Twee kopieën van dezelfde taalkundige regels lopen
  uit elkaar zodra iemand er één aanpast — en dan keurt de contentcontrole iets
  goed wat de leerder afgekeurd krijgt, of andersom.
*/
const VOORZETSEL = VOORZETSEL_NAAMVAL;

/** Woorden die tussen voorzetsel en zelfstandig naamwoord mogen staan. */
const TUSSENWOORD = /^(taj|ta|to|toga|tom|tim|ovaj|ova|ovo|ovom|ovim|onaj|ona|moj|moja|moje|mom|mojoj|mojim|tvoj|tvoja|tvom|njegov|njezin|naš|naša|našem|vaš|njihov|svoj|svoja|svom|svojoj|svojim|jedan|jedna|jedno|jednom|jednu|cijeli|cijelu|cijelom|prvi|prvu|prvom|drugi|drugu|drugom|neki|neku|nekom|svaki|svaku|svakom)$/;

/**
 * Telwoorden. Die nemen het regeren over van het voorzetsel: na twee, drie en
 * vier komt genitief enkelvoud, vanaf vijf genitief meervoud — ook achter «u».
 * «U pet sati» is dus correct, en zonder deze lijst was dat de meest gemelde
 * "fout" van het hele platform.
 */
const TELWOORD = /^(dva|dvije|tri|četiri|pet|šest|sedam|osam|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|petnaest|šesnaest|sedamnaest|osamnaest|devetnaest|dvadeset|trideset|četrdeset|pedeset|šezdeset|sedamdeset|osamdeset|devedeset|sto|dvjesto|tristo|osamsto|tisuću|tisuća|milijun|milijuna|nekoliko|mnogo|malo|puno)$/;

interface Naamvalfout {
  plek: string;
  fragment: string;
  voorzetsel: string;
  woord: string;
  wil: Naamval[];
  gevonden: Naamval[];
}

const naamvalfouten: Naamvalfout[] = [];

function checkNaamvallen(zin: string | undefined, plek: string) {
  if (!zin) return;
  // Een gat in een invuloefening maakt de zin onbeoordeelbaar: wat erin komt,
  // is nu juist het antwoord.
  if (/_{2,}/.test(zin)) return;

  const tokens = zin.split(/[^\p{L}\p{N}\-]+/u).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    const vz = formKey(tokens[i]!);
    const wil = VOORZETSEL[vz];
    if (!wil) continue;

    /*
      Kijk naar het woord dat het voorzetsel regeert — en niet verder.

      Dat "niet verder" is de hele truc. De eerste versie zocht het eerste woord
      dat de catalogus kende, en sprong daarbij over alles heen wat hij niet
      kende. Zo werd «u Split vlakom» afgekeurd omdat «Split» niet in de
      catalogus staat en «vlakom» instrumentalis is: het voorzetsel werd
      beoordeeld op een woord dat er niets mee te maken had. Tien van de
      vierendertig meldingen kwamen daaruit.

      Nu geldt: onbekend woord = geen oordeel. Liever niets zeggen dan iets
      verkeerds zeggen over content die klopt.
    */
    let j = i + 1;
    while (j < tokens.length && TUSSENWOORD.test(formKey(tokens[j]!))) j++;
    if (j >= tokens.length) continue;

    const woord = formKey(tokens[j]!);
    if (!woord || /^\d/.test(woord)) continue;
    // Een telwoord neemt het regeren over; de naamval erna zegt niets over het voorzetsel.
    if (TELWOORD.test(woord)) continue;

    const lezingen = readingsFor(woord).filter((l) => l.feats.case);
    if (!lezingen.length) continue;

    const gevonden = [...new Set(lezingen.map((l) => l.feats.case!))];
    if (!gevonden.some((c) => wil.includes(c))) {
      if (naamvalOk.has(tokens.slice(i, j + 1).join(" ").toLowerCase())) continue;
      naamvalfouten.push({
        plek,
        fragment: tokens.slice(i, j + 1).join(" "),
        voorzetsel: vz,
        woord,
        wil,
        gevonden,
      });
    }
  }
}

/* Dezelfde velden als hierboven, maar nu op zinsniveau. */
function naamvallenVanOefening(e: Exercise, plek: string) {
  const velden = e.type === "choice"
    ? (keuzeIsKroatisch(e) ? (["given"] as Veld[]) : ([] as Veld[]))
    : (KROATISCH[e.type] ?? []).filter((v) => v !== "tokens" && v !== "pairs" && v !== "accepts");
  for (const veld of velden) checkNaamvallen(e[veld] as string | undefined, `${plek}:${veld}`);
}

for (const les of loadLessons()) {
  for (const sec of les.sections) {
    for (const regel of (sec.text_hr ?? "").split("\n")) checkNaamvallen(regel, `${sec.id}:tekst`);
  }
  for (const e of lessonExercises(les)) naamvallenVanOefening(e, e.id);
}
for (const m of loadModules()) {
  for (const e of moduleExercises(m)) naamvallenVanOefening(e, e.id);
}
for (const verhaal of loadStories()) {
  for (const z of storySentences(verhaal)) checkNaamvallen(z.hr, `${verhaal.slug}:${z.id}`);
  for (const e of verhaal.exercises) naamvallenVanOefening(e, e.id);
}

if (naamvalfouten.length) {
  console.log(`\nD. ${naamvalfouten.length} keer een voorzetsel met een naamval die er niet bij past:\n`);
  for (const f of naamvalfouten) {
    console.log(
      `  «${f.fragment}»\n     ${f.voorzetsel} wil ${f.wil.map((c) => NAAMVAL_NAAM[c]).join(" of ")}; ` +
        `«${f.woord}» is ${f.gevonden.map((c) => NAAMVAL_NAAM[c]).join(" of ")}   (${f.plek})`,
    );
  }
} else {
  console.log(
    `\nD. Geen enkel voorzetsel met een verkeerde naamval` +
      ` (${naamvalOk.size} eerder nagekeken uitzondering(en) overgeslagen).`,
  );
}

if (!diakriet.length) {
  console.log(`A. Geen tikfouten (${spellingOk.size} eerder nagekeken woord(en) overgeslagen).`);
}


/* ============================================== standaardkroatisch === */

/*
  De servismenpoort uit §7. CLAUDE.md eist standaardkroatisch, geen Servische
  varianten — maar tot nu toe controleerde niets dat.

  Dit is de enige controle in dit bestand die naar de Nederlandse velden óók
  kijkt: als de uitleg zegt dat het «hleb» is, is de uitleg fout, ongeacht in
  welke taal de zin eromheen staat.
*/
interface ServismeMelding {
  plek: string;
  fout: string;
  goed: string;
  soort: string;
  zeker: boolean;
}

const servismen: ServismeMelding[] = [];
const servismeOk = new Set(
  Object.keys(
    (nagekeken as { servisme_nagekeken?: Record<string, string> }).servisme_nagekeken ?? {},
  ).map((k) => k.toLowerCase()),
);

/**
 * Het Kroatisch van één oefening als één tekst.
 *
 * Als één tekst, want de contrastheuristiek hieronder heeft de hele opgave
 * nodig: bij een meerkeuzevraag staat de Servische vorm in de afleider en de
 * Kroatische in het antwoord, en pas samen laten ze zien dat het lesstof is.
 */
function kroatischVan(e: Exercise): string {
  const stukken: (string | undefined)[] = [e.answer, e.model_answer, ...(e.accepts ?? []), ...(e.distractors ?? []), ...(e.tokens ?? [])];
  if (e.type !== "translate_nl_hr" && e.type !== "word_order") stukken.push(e.given);
  for (const p of e.pairs ?? []) stukken.push(p.hr);
  for (const rij of e.table?.rows ?? []) stukken.push(...rij.cells);
  // Uit de Nederlandse uitleg alleen wat als Kroatisch gemarkeerd staat. Vet
  // eerst, want anders vangt de cursief-regex de spanne tússen twee vette
  // stukken op — en dat is Nederlands.
  for (const veld of [e.prompt_nl, e.body_nl, e.explain_nl, e.hint, e.nudge]) {
    if (!veld) continue;
    const zonderVet = veld.replace(/\*\*([^*]+)\*\*/g, (_, x: string) => {
      stukken.push(x);
      return " ";
    });
    for (const m of zonderVet.matchAll(/«([^»]+)»|\*([^*]+)\*/g)) stukken.push(m[1] ?? m[2]);
  }
  return stukken.filter(Boolean).join(" \n ");
}

/**
 * Alles wat er bij een opgave staat, Nederlands inbegrepen.
 *
 * Dit is waartegen de contrastheuristiek test, en met opzet ruimer dan wat
 * gecontroleerd wordt: de zin die verklaart dat een vorm Servisch is, staat in
 * het Nederlands. «Kafa is de Servische vorm; in Kroatië is het kava» is het
 * bewijs dat de opgave klopt, en dat bewijs staat niet in het Kroatisch.
 */
function contextVan(e: Exercise): string {
  return [
    kroatischVan(e),
    e.prompt_nl, e.body_nl, e.explain_nl, e.hint, e.nudge,
    ...(e.rubric_nl ?? []),
  ].filter(Boolean).join(" \n ");
}

/**
 * Staat de Kroatische vorm er zelf ook bij? Dan wordt de Servische vorm
 * onderwezen, niet gebruikt.
 *
 * Dit is geen slimmigheid maar de enige manier om het verschil te zien. De
 * modules zeggen letterlijk «Ko is de Servische vorm; het Kroatisch zegt tko» —
 * inhoudelijk precies goed, en zonder deze regel veertien keer afgekeurd. Een
 * poort die het beste lesmateriaal afkeurt, wordt uitgezet.
 */
function leertHetContrast(tekst: string, m: { goed: string; soort: string; fragment: string }): boolean {
  const laag = tekst.toLowerCase();
  if (m.soort === "zinsbouw") {
    // «Moram da radim» naast «Moram raditi»: hetzelfde modale werkwoord, nu met infinitief.
    const modaal = m.fragment.split(/\s+/)[0]!.toLowerCase();
    return new RegExp(`${modaal}\\s+\\p{L}+(ti|ći)\\b`, "iu").test(laag);
  }
  const stam = m.goed.slice(0, Math.max(4, m.goed.length - 2)).toLowerCase();
  return laag.includes(stam);
}

function servismenVanOefening(e: Exercise, plek: string) {
  const tekst = kroatischVan(e);
  if (!tekst) return;
  const context = contextVan(e);
  for (const m of vindServismen(tekst)) {
    if (servismeOk.has(m.fragment.toLowerCase())) continue;
    if (leertHetContrast(context, m)) continue;
    servismen.push({ plek, fout: m.fragment, goed: m.goed, soort: m.soort, zeker: m.zeker });
  }
}

function servismenVanTekst(tekst: string | undefined, plek: string) {
  if (!tekst) return;
  for (const m of vindServismen(tekst)) {
    if (servismeOk.has(m.fragment.toLowerCase())) continue;
    if (leertHetContrast(tekst, m)) continue;
    servismen.push({ plek, fout: m.fragment, goed: m.goed, soort: m.soort, zeker: m.zeker });
  }
}

for (const les of loadLessons()) {
  for (const v of les.vocab) servismenVanTekst(v.hr, `${v.id}`);
  for (const g of les.grammar) {
    // Alleen de Kroatische cellen van een paradigma: de andere kolom is de vertaling.
    for (const rij of g.paradigm?.rows ?? []) servismenVanTekst(rij.cells[0], `${g.id}:paradigma`);
  }
  for (const sec of les.sections) servismenVanTekst(sec.text_hr, `${sec.id}:tekst`);
  for (const e of lessonExercises(les)) servismenVanOefening(e, e.id);
}
for (const m of loadModules()) {
  for (const rij of m.grammar.paradigm?.rows ?? []) servismenVanTekst(rij.cells[0], `${m.code}:paradigma`);
  for (const e of moduleExercises(m)) servismenVanOefening(e, e.id);
}
for (const verhaal of loadStories()) {
  for (const z of storySentences(verhaal)) servismenVanTekst(z.hr, `${verhaal.slug}:${z.id}`);
  for (const v of verhaal.vocab) servismenVanTekst(v.hr, `${verhaal.slug}:${v.id}`);
  for (const e of verhaal.exercises) servismenVanOefening(e, e.id);
  for (const q of verhaal.comprehension ?? []) servismenVanOefening(q as Exercise, q.id);
}

const hard = servismen.filter((s) => s.zeker);
if (servismen.length) {
  console.log(`\nE. ${servismen.length} Servische vorm(en) — de leergang is standaardkroatisch:\n`);
  for (const s of servismen) {
    console.log(`  ${s.fout.padEnd(18)}→ ${s.goed.padEnd(24)}${s.soort.padEnd(11)}${s.plek}`);
  }
} else {
  console.log(
    `E. Geen Servische varianten (${SERVISMEN.length} vormen gecontroleerd, ${ZELFTEST.length} zelftests geslaagd).`,
  );
}

if (diakriet.length || naamvalfouten.length || hard.length) process.exit(1);
