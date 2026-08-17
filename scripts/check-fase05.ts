/**
 * Acceptatietests voor Fase 0.5 — escalerende feedback.
 * Draai met: npm run check:fase05
 *
 * De harde regel uit CLAUDE.md luidt: hint → keuze → antwoord + uitleg, nooit
 * meteen het antwoord. Die regel werd tot nu toe overal geschonden. Deze tests
 * leggen hem vast in gedrag in plaats van in een zin.
 *
 * Waarom het uitmaakt: als de eerste reactie op een fout het juiste antwoord is,
 * hoeft er niets meer opgehaald te worden — en juist dat ophalen is wat het
 * onthouden doet. Een hint die de vorm verklapt is geen hint.
 *
 * Draait tegen een kopie van de database, nooit tegen je eigen voortgang.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const REAL_DB = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-fase05-"));
const WERK_DB = path.join(TMP, "werk.db");
{
  const src = new Database(REAL_DB, { readonly: true });
  await src.backup(WERK_DB);
  src.close();
}
process.env.HRVATSKI_DB = WERK_DB;

interface Result {
  punt: string;
  naam: string;
  ok: boolean;
  detail: string;
}
const results: Result[] = [];

async function test(punt: string, naam: string, fn: () => Promise<string> | string) {
  try {
    results.push({ punt, naam, ok: true, detail: await fn() });
  } catch (err) {
    results.push({
      punt,
      naam,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/* ------------------------------------------------------- een proefkonijn --- */

/**
 * Een invuloefening zoeken waarvan het antwoord één woordvorm is die de
 * vormcatalogus kent, plus een verkeerde vorm van hetzelfde woord om in te
 * vullen. Zonder zo'n paar valt er niets over naamvalsfouten te bewijzen.
 */
async function zoekOefening() {
  const { loadLessons, lessonExercises } = await import("../src/lib/content");
  const { readingsFor, formIndex } = await import("../src/lib/forms");

  for (const les of loadLessons()) {
    for (const oef of lessonExercises(les)) {
      if (oef.type !== "cloze" || !oef.answer || oef.answer.includes(" ")) continue;
      const goed = readingsFor(oef.answer);
      if (!goed.length) continue;
      const lemma = goed[0]!.lemmaId;
      const anders = [...formIndex().values()]
        .flat()
        .filter(
          (l) => l.lemmaId === lemma && l.surface.toLowerCase() !== oef.answer!.toLowerCase(),
        );
      if (anders.length < 2) continue;
      return { oefening: oef, fout: anders[0]!.surface, lemma };
    }
  }
  throw new Error("geen geschikte invuloefening gevonden");
}

/* ═══════════════════════════════════════════ 1. nooit meteen het antwoord ══ */

await test("1", "Een eerste fout levert een hint op, niet de vorm", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening, fout } = await zoekOefening();

  const r = await submitAnswer(oefening.id, { kind: "text", value: fout }, 5000, 0);

  assert(r.correct === false, `"${fout}" werd goed gerekend`);
  assert(r.stage === "hint", `stage is "${r.stage}", verwacht "hint"`);
  assert(typeof r.hint === "string" && r.hint.length > 0, "geen hint meegekomen");
  assert(
    !r.expected,
    `het juiste antwoord lekt al bij de eerste fout: "${r.expected}"`,
  );
  assert(
    !r.hint!.toLowerCase().includes(oefening.answer!.toLowerCase()),
    `de hint bevat het antwoord: "${r.hint}"`,
  );
  assert(!r.explain_nl, "de uitleg lekt al bij de eerste fout");

  return `"${fout}" → hint zonder antwoord: "${r.hint!.slice(0, 60)}…"`;
});

await test("1", "De tweede fout geeft een keuze, nog steeds niet de vorm", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening, fout } = await zoekOefening();

  const r = await submitAnswer(oefening.id, { kind: "text", value: fout }, 5000, 1);

  assert(r.stage === "choice", `stage is "${r.stage}", verwacht "choice"`);
  assert(Array.isArray(r.options) && r.options.length >= 2, "geen keuzes meegekomen");
  assert(!r.expected, `het antwoord lekt bij de tweede fout: "${r.expected}"`);
  assert(
    r.options!.some((o) => o.toLowerCase() === oefening.answer!.toLowerCase()),
    "het juiste antwoord zit niet tussen de keuzes",
  );

  return `${r.options!.length} keuzes: ${r.options!.join(" · ")}`;
});

await test("1", "De afleiders zijn echte vormen van hetzelfde woord", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { readingsFor } = await import("../src/lib/forms");
  const { oefening, fout, lemma } = await zoekOefening();

  const r = await submitAnswer(oefening.id, { kind: "text", value: fout }, 5000, 1);
  assert(r.options, "geen keuzes");

  // §7: afleiders moeten plausibel zijn — echte verkeerde naamvalsvormen van
  // hetzelfde woord, geen willekeurige woorden. Anders is kiezen geen toets maar
  // een spelletje uitsluiten.
  for (const optie of r.options!) {
    const lezingen = readingsFor(optie);
    assert(lezingen.length > 0, `"${optie}" is geen bestaande woordvorm`);
    assert(
      lezingen.some((l) => l.lemmaId === lemma),
      `"${optie}" hoort niet bij hetzelfde woord — dat maakt de keuze te makkelijk`,
    );
  }
  return `alle ${r.options!.length} keuzes zijn vormen van hetzelfde lemma`;
});

/* ══════════════════════════════════════════ 2. na drie tredes wél het antwoord ══ */

await test("2", "De derde fout geeft het antwoord met uitleg", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening, fout } = await zoekOefening();

  const r = await submitAnswer(oefening.id, { kind: "text", value: fout }, 5000, 2);

  assert(r.stage === "answer", `stage is "${r.stage}", verwacht "answer"`);
  assert(
    r.expected?.toLowerCase() === oefening.answer!.toLowerCase(),
    `verwacht antwoord ontbreekt of klopt niet: "${r.expected}"`,
  );
  return `trede 3 → "${r.expected}"${r.explain_nl ? " met uitleg" : ""}`;
});

/* ═════════════════════════════════ 3. elke trede wordt vastgelegd ══ */

await test("3", "Goed-na-hint is te onderscheiden van goed-in-één-keer", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening, fout } = await zoekOefening();

  const d0 = new Database(WERK_DB, { readonly: true });
  const voor = (
    d0.prepare("SELECT count(*) n FROM attempts WHERE exercise_id = ?").get(oefening.id) as {
      n: number;
    }
  ).n;
  d0.close();

  // Eerst fout (trede 0 → hint), dan goed op trede 1.
  await submitAnswer(oefening.id, { kind: "text", value: fout }, 4000, 0);
  const goed = await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 4000, 1);
  assert(goed.correct, "het juiste antwoord werd fout gerekend");

  const d = new Database(WERK_DB, { readonly: true });
  const rijen = d
    .prepare("SELECT correct, stage FROM attempts WHERE exercise_id = ? ORDER BY id DESC")
    .all(oefening.id) as { correct: number; stage: number }[];
  d.close();

  // Eén poging per opgeloste oefening, niet één per trede — anders zou de
  // accuratesse kelderen door het escaleren zelf.
  assert(
    rijen.length === voor + 1,
    `${rijen.length - voor} pogingen weggeschreven, verwacht 1 (één per oplossing, niet per trede)`,
  );
  assert(rijen[0]!.correct === 1, "de oplossing is niet als goed vastgelegd");
  assert(rijen[0]!.stage === 1, `stage is ${rijen[0]!.stage}, verwacht 1 (goed na hint)`);

  return `goed na hint → attempts.stage = 1, één poging vastgelegd`;
});

await test("3", "Elke misser komt in error_log, ook als je hem daarna goed hebt", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening, fout } = await zoekOefening();

  const d0 = new Database(WERK_DB, { readonly: true });
  const voor = (
    d0.prepare("SELECT count(*) n FROM error_log WHERE exercise_id = ?").get(oefening.id) as {
      n: number;
    }
  ).n;
  d0.close();

  await submitAnswer(oefening.id, { kind: "text", value: fout }, 4000, 0);
  await submitAnswer(oefening.id, { kind: "text", value: fout }, 4000, 1);
  await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 4000, 2);

  const d = new Database(WERK_DB, { readonly: true });
  const na = (
    d.prepare("SELECT count(*) n FROM error_log WHERE exercise_id = ?").get(oefening.id) as {
      n: number;
    }
  ).n;
  d.close();

  assert(na === voor + 2, `${na - voor} fouten gelogd, verwacht 2`);
  return `2 missers vastgelegd, oplossing op trede 3`;
});

await test("3", "Later toegeven levert minder op dan meteen goed", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening } = await zoekOefening();

  const meteen = await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 9999, 0);
  const naHint = await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 9999, 1);
  const naKeuze = await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 9999, 2);

  assert(
    meteen.xp > naHint.xp && naHint.xp > naKeuze.xp,
    `XP loopt niet af: ${meteen.xp} / ${naHint.xp} / ${naKeuze.xp}`,
  );
  return `XP per trede: ${meteen.xp} → ${naHint.xp} → ${naKeuze.xp}`;
});

/* ═══════════════════════════════════════ 4. geen regressie ══ */

await test("4", "In één keer goed gedraagt zich precies als voorheen", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { oefening } = await zoekOefening();

  const r = await submitAnswer(oefening.id, { kind: "text", value: oefening.answer! }, 3000, 0);

  assert(r.correct === true, "het juiste antwoord werd fout gerekend");
  assert(r.stage === "correct", `stage is "${r.stage}", verwacht "correct"`);
  assert(r.xp > 0, "geen XP toegekend");
  assert(!r.hint, "een goed antwoord kreeg een hint");
  return `goed in één keer → ${r.xp} XP, geen escalatie`;
});

await test("4", "Vrije productie blijft zelfbeoordeling, zonder tredes", async () => {
  const { submitAnswer } = await import("../src/app/actions");
  const { loadLessons, lessonExercises } = await import("../src/lib/content");

  let vrij: { id: string } | null = null;
  for (const les of loadLessons()) {
    const gevonden = lessonExercises(les).find((e) => e.type === "free_production");
    if (gevonden) {
      vrij = gevonden;
      break;
    }
  }
  assert(vrij, "geen vrije-productieoefening gevonden");

  const r = await submitAnswer(vrij.id, { kind: "text", value: "iets" }, 4000, 0);
  assert(r.selfAssess, "vrije productie geeft geen zelfbeoordeling meer");
  assert(r.stage === "selfAssess", `stage is "${r.stage}", verwacht "selfAssess"`);
  return "ongewijzigd: modelantwoord plus criteria";
});

/* ═══════════════════════════════════════════════════ verslag ══ */

fs.rmSync(TMP, { recursive: true, force: true });

const TITELS: Record<string, string> = {
  "1": "Nooit meteen het antwoord",
  "2": "Na drie tredes is het antwoord er wel",
  "3": "Elke trede wordt vastgelegd",
  "4": "Geen regressie op wat al werkte",
};

const perPunt = new Map<string, Result[]>();
for (const r of results) {
  const lijst = perPunt.get(r.punt);
  if (lijst) lijst.push(r);
  else perPunt.set(r.punt, [r]);
}

console.log("\nAcceptatie Fase 0.5 — escalerende feedback\n" + "─".repeat(64));
for (const [punt, lijst] of [...perPunt].sort()) {
  console.log(`\n${punt}. ${TITELS[punt] ?? ""}`);
  for (const r of lijst) {
    console.log(`   ${r.ok ? "✓" : "✗"} ${r.naam}`);
    console.log(`     ${r.detail.replace(/\n/g, "\n     ")}`);
  }
}

const gezakt = results.filter((r) => !r.ok);
console.log("\n" + "─".repeat(64));
console.log(`${results.length - gezakt.length} van ${results.length} geslaagd.`);
if (gezakt.length) process.exit(1);
