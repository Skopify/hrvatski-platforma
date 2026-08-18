/**
 * Contentvalidatie. Draai met: npm run check:content
 *
 * Vangt de fouten die pas in de app zichtbaar zouden worden: dubbele id's,
 * oefeningen die naar een niet-bestaand item verwijzen, antwoorden die ontbreken,
 * en tekens die in Kroatische tekst niet thuishoren (bijvoorbeeld Cyrillisch dat
 * per ongeluk uit een kopieeractie is meegekomen).
 */
import {
  glossKey,
  lessonExercises,
  loadLessons,
  loadStories,
  loadSyllabus,
  storySentences,
  SKILL_LABEL,
  type Exercise,
} from "../src/lib/content";
import { conjugateVerb, declineNoun } from "../src/lib/morphology";
import { loadModules, moduleExercises } from "../src/lib/modules";

const problems: string[] = [];
const note = (msg: string) => problems.push(msg);

const lessons = loadLessons();
const syllabus = loadSyllabus();

/* ------------------------------------------------------- id's en targets --- */

const itemIds = new Set<string>();
const exerciseIds = new Set<string>();

for (const lesson of lessons) {
  for (const g of lesson.grammar) {
    if (itemIds.has(g.id)) note(`Dubbele grammatica-id: ${g.id}`);
    itemIds.add(g.id);
  }
  for (const v of lesson.vocab) {
    if (itemIds.has(v.id)) note(`Dubbele vocab-id: ${v.id}`);
    itemIds.add(v.id);
  }
  for (const e of lessonExercises(lesson)) {
    if (exerciseIds.has(e.id)) note(`Dubbele oefening-id: ${e.id}`);
    exerciseIds.add(e.id);
  }
}

/*
  De grammaticamodules horen hier ook bij.

  Ze stonden er niet in, en dat was een gat met scherpe randen: hun
  grammaticapunten worden wél als item geseed, dus een verhaal dat naar
  g.mod.conditional wijst wérkt in de app — maar deze controle noemde hem
  onbekend. Een validator die correcte content afkeurt, leert je hem negeren.
*/
for (const m of loadModules()) {
  if (itemIds.has(m.grammar.id)) note(`Dubbele grammatica-id: ${m.grammar.id}`);
  itemIds.add(m.grammar.id);
  for (const e of moduleExercises(m)) {
    if (exerciseIds.has(e.id)) note(`Dubbele oefening-id: ${e.id}`);
    exerciseIds.add(e.id);
  }
}

for (const lesson of lessons) {
  for (const e of lessonExercises(lesson)) {
    for (const t of e.targets ?? []) {
      if (!itemIds.has(t)) note(`${e.id} verwijst naar onbekend item: ${t}`);
    }

    if (e.type === "teaching_moment") {
      if (!e.body_nl) note(`${e.id}: uitlegmoment zonder body_nl`);
      continue;
    }
    if (e.type === "free_production") {
      if (!e.model_answer) note(`${e.id}: vrije productie zonder modelantwoord`);
      continue;
    }
    if (e.type === "match") {
      if (!e.pairs?.length) note(`${e.id}: koppeloefening zonder paren`);
      continue;
    }
    if (e.type === "choice" && !e.distractors?.length) {
      note(`${e.id}: meerkeuze zonder afleiders`);
    }
    if (e.type === "word_order" && !e.tokens?.length) {
      note(`${e.id}: woordvolgorde zonder tokens`);
    }
    if (!e.answer) note(`${e.id}: geen antwoord`);
    if (e.answer && e.accepts && !e.accepts.length) {
      note(`${e.id}: lege accepts-lijst`);
    }
    if (!e.mode) note(`${e.id}: geen mode (receptive/productive)`);
    if (!e.targets?.length) note(`${e.id}: geen targets — voedt de SRS niet`);
  }
}

/* ------------------------------------------------------------ woordvormen --- */

// Cyrillisch, Griekse letters en andere tekens die in Kroatische tekst niet horen.
const SUSPECT = /[Ѐ-ӿͰ-Ͽ]/;

function scan(label: string, text: string) {
  if (SUSPECT.test(text)) {
    const bad = [...text].filter((c) => SUSPECT.test(c)).join("");
    note(`${label}: verdachte tekens «${bad}» in "${text.slice(0, 60)}"`);
  }
}

for (const lesson of lessons) {
  for (const v of lesson.vocab) {
    scan(v.id + " (id)", v.id);
    scan(v.id, v.hr);
    if (v.gen_sg) scan(v.id + ".gen", v.gen_sg);
    if (v.nom_pl) scan(v.id + ".pl", v.nom_pl);
    if (v.pos === "noun" && !v.gender) note(`${v.id}: zelfstandig naamwoord zonder geslacht`);
    if (v.pos === "noun" && !v.animacy) note(`${v.id}: zelfstandig naamwoord zonder animacy`);
  }
  for (const g of lesson.grammar) {
    for (const row of g.paradigm?.rows ?? []) {
      for (const cell of row.cells) scan(g.id, cell);
    }
  }
  for (const e of lessonExercises(lesson)) {
    if (e.answer) scan(e.id, e.answer);
    if (e.given) scan(e.id, e.given);
  }
}

/* --------------------------------------------------------- afgeleide vormen --- */

/*
  De verbuigingsmotor maakt duizenden vormen die niemand met de hand nakijkt.
  Twee vangnetten daarvoor.

  1. Een fonotactische zeef. Kroatisch kent geen čč, šš, žž, en geen sč of zč.
     Komt zo'n rij eruit, dan heeft een regel op de verkeerde stam gewerkt —
     zo kwamen *ručče, *polasče en *pisče aan het licht.

  2. Een lijst met de vallen zelf. Elke regel hieronder is een fout die er ooit
     in zat; als iemand een regel versoepelt of een woord aanpast, valt hier
     meteen om welk woord het gaat.
*/
const IMPOSSIBLE = /(čč|ćć|šš|žž|đđ|sč|zč|sš|zž)/;

const EXPECTED: [string, string, string][] = [
  // Landen zijn adjectivisch: u Hrvatskoj, niet *u Hrvatsci.
  ["Hrvatska", "loc.sg", "Hrvatskoj"],
  ["Nizozemska", "loc.sg", "Nizozemskoj"],
  // Onzijdig op -e krijgt -em, ook als de stam op een harde medeklinker eindigt.
  ["more", "ins.sg", "morem"],
  ["kazalište", "ins.sg", "kazalištem"],
  ["selo", "ins.sg", "selom"],
  ["jaje", "ins.sg", "jajetom"],
  // Vluchtige a keert terug in de genitief meervoud.
  ["sastanak", "gen.pl", "sastanaka"],
  ["dvorac", "gen.pl", "dvoraca"],
  ["pas", "gen.pl", "pasa"],
  // Eindcluster krijgt een tussen-a, behalve na st.
  ["student", "gen.pl", "studenata"],
  ["turist", "gen.pl", "turista"],
  ["bicikl", "gen.pl", "bicikala"],
  // Sibilarisatie slaat toe — en waar ze uitblijft.
  ["majka", "dat.sg", "majci"],
  ["knjiga", "loc.sg", "knjizi"],
  ["mačka", "dat.sg", "mački"],
  ["Talijanka", "dat.sg", "Talijanki"],
  ["baka", "dat.sg", "baki"],
  // Vocatief: alleen bij levende wezens, en met de juiste palatalisatie.
  ["pisac", "voc.sg", "pišče"],
  ["otac", "voc.sg", "oče"],
  ["čovjek", "voc.sg", "čovječe"],
];

const nouns = new Map(
  lessons.flatMap((l) => l.vocab).filter((v) => v.pos === "noun").map((v) => [v.hr, v]),
);

for (const lesson of lessons) {
  for (const v of lesson.vocab) {
    const derived = v.pos === "noun" ? declineNoun(v) : conjugateVerb(v);
    for (const f of derived) {
      if (IMPOSSIBLE.test(f.form)) {
        note(`${v.id}: onmogelijke klankreeks in afgeleide vorm «${f.form}» (${f.suffix})`);
      }
    }
  }
}

for (const [lemma, suffix, want] of EXPECTED) {
  const v = nouns.get(lemma);
  if (!v) {
    note(`vormcontrole: woord «${lemma}» staat niet meer in de lessen`);
    continue;
  }
  const got = declineNoun(v).find((f) => f.suffix === suffix)?.form;
  if (got !== want) {
    note(`vormcontrole ${lemma} ${suffix}: verwacht «${want}», kreeg «${got ?? "niets"}»`);
  }
}

/* ---------------------------------------------------------------- verhalen --- */

const stories = loadStories();

// Dezelfde oefeningcontroles als bij lessen, plus wat alleen verhalen hebben:
// een dekkend glossarium (elk woord in de tekst is aantikbaar) en kloppende
// item-verwijzingen vanuit de glossen.
function checkExercise(e: Exercise, ownIds: Set<string>) {
  if (exerciseIds.has(e.id)) note(`Dubbele oefening-id: ${e.id}`);
  exerciseIds.add(e.id);
  for (const t of e.targets ?? []) {
    if (!itemIds.has(t) && !ownIds.has(t)) note(`${e.id} verwijst naar onbekend item: ${t}`);
  }
  if (e.type === "free_production") {
    if (!e.model_answer) note(`${e.id}: vrije productie zonder modelantwoord`);
    return;
  }
  if (!e.answer) note(`${e.id}: geen antwoord`);
  if (e.type === "choice" && !e.distractors?.length) note(`${e.id}: meerkeuze zonder afleiders`);
  if (e.type === "word_order" && !e.tokens?.length) note(`${e.id}: woordvolgorde zonder tokens`);
  if (!e.mode) note(`${e.id}: geen mode (receptive/productive)`);
}

const slugs = new Set<string>();
for (const story of stories) {
  if (slugs.has(story.slug)) note(`Dubbele verhaal-slug: ${story.slug}`);
  slugs.add(story.slug);

  const ownIds = new Set(story.vocab.map((v) => v.id));
  for (const v of story.vocab) {
    if (itemIds.has(v.id)) note(`${story.slug}: vocab-id botst met een les: ${v.id}`);
    scan(v.id, v.hr);
    if (v.pos === "noun" && !v.gender) note(`${v.id}: zelfstandig naamwoord zonder geslacht`);
  }

  // Glossariumdekking: elk woord in de tekst moet een gloss hebben — een
  // onaantikbaar woord is precies het woord waarop het lezen vastloopt.
  const glossKeys = new Set(Object.keys(story.glossary));
  const usedKeys = new Set<string>();
  for (const s of storySentences(story)) {
    scan(story.slug, s.hr);
    for (const token of s.hr.split(/\s+/)) {
      const key = glossKey(token);
      if (!key) continue;
      usedKeys.add(key);
      if (!glossKeys.has(key)) note(`${story.slug}: geen gloss voor «${token}»`);
    }
  }
  for (const key of glossKeys) {
    if (!usedKeys.has(key)) note(`${story.slug}: ongebruikte gloss «${key}»`);
  }
  for (const [key, gloss] of Object.entries(story.glossary)) {
    if (gloss.item && !ownIds.has(gloss.item) && !itemIds.has(gloss.item)) {
      note(`${story.slug}: gloss «${key}» verwijst naar onbekend item ${gloss.item}`);
    }
  }

  for (const e of story.exercises) checkExercise(e, ownIds);

  // Begrijpend lezen heeft eigen eisen: elke vraag draagt een vaardigheid en
  // een uitleg. Die uitleg is hier geen extraatje maar het leerpunt zelf —
  // zonder «waarom dit het antwoord is» leert een leesvraag je niets.
  for (const q of story.comprehension ?? []) {
    if (exerciseIds.has(q.id)) note(`Dubbele vraag-id: ${q.id}`);
    exerciseIds.add(q.id);
    if (!SKILL_LABEL[q.skill]) note(`${q.id}: onbekende leesvaardigheid «${q.skill}»`);
    if (!q.explain_nl) note(`${q.id}: begrijpend-lezenvraag zonder uitleg`);
    if (q.type === "free_production") {
      if (!q.model_answer) note(`${q.id}: vrije vraag zonder modelantwoord`);
      if (!q.rubric_nl?.length) note(`${q.id}: vrije vraag zonder criteria`);
    } else {
      if (!q.answer) note(`${q.id}: geen antwoord`);
      if (q.type === "choice" && !q.distractors?.length) {
        note(`${q.id}: meerkeuze zonder afleiders`);
      }
    }
  }
}

/* ----------------------------------------------------------- syllabusmatch --- */

for (const lesson of lessons) {
  const entry = syllabus.lessons.find((l) => l.number === lesson.number);
  if (!entry) {
    note(`Les ${lesson.number} staat niet in de syllabus`);
    continue;
  }
  if (entry.title_hr !== lesson.title_hr) {
    note(`Les ${lesson.number}: titel wijkt af van de syllabus ("${entry.title_hr}")`);
  }
  if (entry.cefr !== lesson.cefr) {
    note(`Les ${lesson.number}: CEFR wijkt af van de syllabus (${entry.cefr})`);
  }
}

/* -------------------------------------------------------------- rapportage --- */

const totals = lessons.map((l) => ({
  nr: l.number,
  vocab: l.vocab.length,
  grammar: l.grammar.length,
  ex: lessonExercises(l).filter((e) => e.type !== "teaching_moment").length,
  teach: lessonExercises(l).filter((e) => e.type === "teaching_moment").length,
}));

console.log("les  woorden  grammatica  oefeningen  uitleg");
for (const t of totals) {
  console.log(
    `${String(t.nr).padStart(3)}  ${String(t.vocab).padStart(7)}  ${String(t.grammar).padStart(10)}  ${String(t.ex).padStart(10)}  ${String(t.teach).padStart(6)}`,
  );
}
console.log(
  `tot  ${String(totals.reduce((n, t) => n + t.vocab, 0)).padStart(7)}  ` +
    `${String(totals.reduce((n, t) => n + t.grammar, 0)).padStart(10)}  ` +
    `${String(totals.reduce((n, t) => n + t.ex, 0)).padStart(10)}  ` +
    `${String(totals.reduce((n, t) => n + t.teach, 0)).padStart(6)}`,
);

if (stories.length) {
  console.log("\nverhalen:");
  for (const s of stories) {
    const words = storySentences(s).reduce((n, x) => n + x.hr.split(/\s+/).length, 0);
    console.log(
      `  ${s.slug} — ${words} woorden, ${Object.keys(s.glossary).length} glossen, ` +
        `${s.vocab.length} vocab, ${s.comprehension?.length ?? 0} leesvragen, ` +
        `${s.exercises.length} taalvragen (na les ${s.requires_lesson})`,
    );
  }
}

if (problems.length) {
  console.log(`\n${problems.length} probleem(en):`);
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("\nContent is consistent.");
