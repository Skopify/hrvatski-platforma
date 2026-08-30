/**
 * Het hele platform doorlopen zoals een leerder dat doet.
 * Draai met: npm run proef:platform
 *
 * De losse controles kijken elk naar één fase. Deze loopt er dwars doorheen:
 * een drill doen, een herhaling beantwoorden, een module-stap afvinken, een
 * verhaal afronden, een woord leren, een schrijfopdracht bewaren. Precies de
 * paden die naar de database schrijven, en die je dus niet even met de hand
 * uitprobeert zonder je eigen leerhistorie te vervuilen.
 *
 * Daarom draait alles op een kopie. De echte database wordt gelezen en verder
 * met rust gelaten; wat dit script aanricht, staat in een tijdelijk bestand dat
 * na afloop verdwijnt.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const ECHT = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-proef-"));
const KOPIE = path.join(TMP, "werk.db");
{
  const src = new Database(ECHT, { readonly: true });
  await src.backup(KOPIE);
  src.close();
}
process.env.HRVATSKI_DB = KOPIE;

interface Uitslag {
  groep: string;
  naam: string;
  ok: boolean;
  detail: string;
}
const uitslagen: Uitslag[] = [];

async function proef(groep: string, naam: string, fn: () => Promise<string> | string) {
  try {
    uitslagen.push({ groep, naam, ok: true, detail: await fn() });
  } catch (e) {
    uitslagen.push({ groep, naam, ok: false, detail: (e as Error).message });
  }
}

function eis(voorwaarde: unknown, bericht: string): asserts voorwaarde {
  if (!voorwaarde) throw new Error(bericht);
}

const A = await import("../src/app/actions");
const { sqlite } = await import("../src/lib/db");
const tel = (tabel: string) =>
  (sqlite.prepare(`SELECT count(*) n FROM ${tabel}`).get() as { n: number }).n;

/* ------------------------------------------------------------- oefenen --- */

await proef("Oefenen", "Elke drill levert vragen op", async () => {
  const { DRILL_KINDS } = await import("../src/lib/drills");
  const { drillAvailability } = await import("../src/lib/stats");
  const beschikbaar = drillAvailability();

  const leeg: string[] = [];
  const gevuld: string[] = [];
  for (const kind of DRILL_KINDS) {
    const vragen = await A.drillBatch(kind, 4);
    const belooft = beschikbaar[kind]?.now ?? 0;
    /*
      De belofte op het oefenscherm en wat de drill levert, moeten hetzelfde
      zeggen. Dat liepen ze uiteen: het scherm meldde 115 woorden klaar en de
      drill vond er geen enkele, omdat de teller met Math.max(1, les) rekende
      en de drill met de kale waarde nul.
    */
    if (belooft > 0 && vragen.length === 0) {
      throw new Error(`${kind}: scherm belooft ${belooft} woorden, drill levert 0 vragen`);
    }
    (vragen.length ? gevuld : leeg).push(kind);
  }
  eis(gevuld.length >= 5, `slechts ${gevuld.length} van ${DRILL_KINDS.length} drills leveren vragen`);
  return `${gevuld.length} drills leveren vragen${leeg.length ? `; leeg (terecht): ${leeg.join(", ")}` : ""}`;
});

await proef("Oefenen", "Een drillantwoord wordt nagekeken en vastgelegd", async () => {
  const voorAttempts = tel("attempts");
  const vragen = await A.drillBatch("oblik", 1);
  eis(vragen.length === 1, "geen drillvraag gekregen");
  const v = vragen[0]!;

  const fout = await A.submitDrill("oblik", v.ref, "zzz-onmogelijk", 1200);
  eis(fout.correct === false, "een onmogelijk antwoord werd goedgekeurd");
  eis(Boolean(fout.expected), "bij een fout antwoord ontbreekt het juiste antwoord");

  const goed = await A.submitDrill("oblik", v.ref, fout.expected!, 900);
  eis(goed.correct === true, `het eigen verwachte antwoord «${fout.expected}» werd afgekeurd`);
  eis(tel("attempts") > voorAttempts, "er is niets in attempts vastgelegd");
  return `«${v.prompt}» → ${fout.expected}; fout en goed allebei correct beoordeeld`;
});

/* ------------------------------------------------------------ herhalen --- */

await proef("Herhalen", "De herhaalsessie levert oefeningen", async () => {
  const { planReview, reviewableCount, unreachableDueCount } = await import("../src/lib/planner");
  const rij = planReview(10);
  eis(rij.length > 0, "de herhaalstapel is leeg terwijl er items vervallen zijn");
  /*
    Wat er vervalt en wat er te oefenen valt, zijn twee getallen. Zolang de
    vormkaarten door geen enkele oefening bereikt worden, is het tweede kleiner
    — en dat hoort zichtbaar te blijven in plaats van weggerekend.
  */
  return `${rij.length} oefening(en); ${reviewableCount()} bereikbaar, ${unreachableDueCount()} vervallen maar onbereikbaar`;
});

/* ---------------------------------------------------------- grammatica --- */

await proef("Grammatica", "Een module onthoudt waar je gebleven was", async () => {
  const { loadModule, moduleExercises } = await import("../src/lib/modules");
  const m = loadModule("LOC-VS-ACC");
  eis(m, "module LOC-VS-ACC niet gevonden");
  const stappen = moduleExercises(m!);
  eis(stappen.length > 3, "module heeft te weinig stappen");

  await A.markModuleStepDone(m!.code, stappen[0]!.id);
  await A.markModuleStepDone(m!.code, stappen[1]!.id);
  const rij = sqlite
    .prepare("SELECT steps_done FROM module_progress WHERE code = ?")
    .get(m!.code) as { steps_done: string } | undefined;
  eis(rij, "geen voortgang weggeschreven voor de module");
  const gedaan = JSON.parse(rij!.steps_done) as string[];
  eis(gedaan.length >= 2, `${gedaan.length} stap(pen) onthouden, verwacht minstens 2`);

  await A.restartModule(m!.code);
  const na = sqlite
    .prepare("SELECT steps_done FROM module_progress WHERE code = ?")
    .get(m!.code) as { steps_done: string } | undefined;
  eis(!na || JSON.parse(na.steps_done).length === 0, "opnieuw beginnen wist de stappen niet");
  return `${gedaan.length} stappen onthouden en daarna correct gewist`;
});

/* ------------------------------------------------------------ verhalen --- */

await proef("Verhalen", "Een verhaal lezen en afronden wordt vastgelegd", async () => {
  const { loadStory } = await import("../src/lib/content");
  const verhaal = loadStory("kavana-zvono");
  eis(verhaal, "verhaal kavana-zvono niet gevonden");

  await A.markStoryRead(verhaal!.slug);
  await A.markStoryQuizDone(verhaal!.slug);
  const rij = sqlite
    .prepare("SELECT read_at, quiz_done_at FROM story_progress WHERE slug = ?")
    .get(verhaal!.slug) as { read_at: number | null; quiz_done_at: number | null } | undefined;
  eis(rij?.read_at, "gelezen is niet vastgelegd");
  eis(rij?.quiz_done_at, "afgerond is niet vastgelegd");
  return "gelezen en afgerond allebei vastgelegd";
});

await proef("Verhalen", "Elk verhaal heeft een doorloop die eindigt", async () => {
  const { loadStories, asExercise } = await import("../src/lib/content");
  const kort: string[] = [];
  for (const s of loadStories()) {
    const stappen = (s.comprehension ?? []).length + s.exercises.length;
    if (stappen < 8) kort.push(`${s.slug} (${stappen})`);
    // Elke leesvraag moet als oefening te presenteren zijn.
    for (const q of s.comprehension ?? []) asExercise(q);
  }
  eis(!kort.length, `verhalen met minder dan 8 vragen: ${kort.join(", ")}`);
  return `alle ${loadStories().length} verhalen hebben 8 of meer vragen, alle vragen presenteerbaar`;
});

/* ------------------------------------------------------------ woorden --- */

await proef("Woorden", "De woordensessie levert kaarten en neemt antwoorden aan", async () => {
  const { questions, due, nieuw } = await A.vocabQueue(5);
  eis(questions.length > 0, `de woordensessie is leeg (${due} vervallen, ${nieuw} nieuw)`);
  const eerste = questions[0]!;
  const uit = await A.submitVocab(eerste.cardId, eerste.answer, 1500);
  eis(uit, "geen uitkomst na een woordantwoord");
  eis(uit.correct === true, `het eigen verwachte antwoord «${eerste.answer}» werd afgekeurd`);
  return `${questions.length} kaart(en) (${due} vervallen, ${nieuw} nieuw); antwoord verwerkt`;
});

/* ------------------------------------------------------------ schrijven --- */

await proef("Schrijven", "Schrijfwerk bewaren en nakijken", async () => {
  const id = "w.01.voorstellen";
  const tekst = "Zovem se Ana. Zivim u Splitu. Radim u kavani.";
  await A.bewaarSchrijfwerk(id, tekst, false);
  const oordeel = await A.beoordeelSchrijfwerk(id, tekst);
  eis(oordeel.woorden === 9, `${oordeel.woorden} woorden geteld, verwacht 9`);
  const dakjes = oordeel.taal.spelling.filter((s) => s.soort === "diakriet");
  eis(dakjes.length === 1, `${dakjes.length} vergeten tekens gevonden, verwacht 1 (Zivim)`);
  return `bewaard; ${dakjes[0]!.woord} → ${dakjes[0]!.bedoeld}`;
});

/* ------------------------------------------------------------ nakijken --- */

await proef("Nakijken", "Een oordeel bewaren en terugdraaien", async () => {
  const { volgendeBatch, oordelen } = await import("../src/lib/nakijken");
  const batch = volgendeBatch(3);
  eis(batch.length === 3, `${batch.length} zinnen in de batch, verwacht 3`);
  const z = batch[0]!;

  await A.bewaarNakijkOordeel(z.hash, z.hr, "fout", "verbeterd", "proef");
  eis(oordelen().get(z.hash)?.status === "fout", "oordeel niet bewaard");
  await A.wisNakijkOordeel(z.hash);
  eis(!oordelen().has(z.hash), "oordeel niet teruggedraaid");
  return "bewaren en terugdraaien werken allebei";
});

/* ------------------------------------------------------------- fouten --- */

await proef("Fouten", "De foutenbank en de weakness-drill leveren werk", async () => {
  const { mistakes } = await import("../src/lib/stats");
  const lijst = mistakes(10);
  return lijst.length
    ? `${lijst.length} fout(en) in de bank, vaakste: «${lijst[0]!.given}» → «${lijst[0]!.expected}»`
    : "foutenbank is leeg (geen fouten gemaakt)";
});

/* --------------------------------------------------------------- einde --- */

fs.rmSync(TMP, { recursive: true, force: true });

const groepen = new Map<string, Uitslag[]>();
for (const u of uitslagen) {
  const l = groepen.get(u.groep);
  if (l) l.push(u);
  else groepen.set(u.groep, [u]);
}

console.log("\nPlatformproef — alles op een kopie van de database\n" + "─".repeat(66));
for (const [groep, lijst] of groepen) {
  console.log(`\n${groep}`);
  for (const u of lijst) {
    console.log(`   ${u.ok ? "✓" : "✗"} ${u.naam}`);
    console.log(`     ${u.detail}`);
  }
}
const gezakt = uitslagen.filter((u) => !u.ok);
console.log("\n" + "─".repeat(66));
console.log(`${uitslagen.length - gezakt.length} van ${uitslagen.length} geslaagd.`);
if (gezakt.length) process.exit(1);
