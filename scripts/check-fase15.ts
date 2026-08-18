/**
 * Acceptatietests voor Fase 1.5 — de plaatsingstoets.
 * Draai met: npm run check:fase15
 *
 * Wat hier bewezen moet worden is één ding, en het staat in CLAUDE.md:
 * modulestatus volgt uit prestatie, nooit uit zelfinschatting. Dat is makkelijk
 * op te schrijven en makkelijk te overtreden — een enkele knop "ik ken dit al"
 * is een kleine wijziging met grote gevolgen. Deze tests staan er om die
 * wijziging te laten opvallen.
 *
 * Daarnaast de tweede regel: een meting die iets niet weet, zegt dat. De
 * woordenschatveeg neemt een steekproef, en de woorden die hij niet gezien
 * heeft moeten aantoonbaar apart geteld worden.
 *
 * Draait tegen een kopie van de database, nooit tegen je eigen voortgang.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const REAL_DB = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-fase15-"));
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
  } catch (e) {
    results.push({ punt, naam, ok: false, detail: (e as Error).message });
  }
}

function eis(voorwaarde: unknown, bericht: string): asserts voorwaarde {
  if (!voorwaarde) throw new Error(bericht);
}

const P = await import("../src/lib/placement");
const { modulesByRank } = await import("../src/lib/modules");
const { db } = await import("../src/lib/db");
const schema = await import("../src/lib/db/schema");
const { knownItemIds, storyCoverage } = await import("../src/lib/coverage");
const { loadStories } = await import("../src/lib/content");
const { eq } = await import("drizzle-orm");

/* ------------------------------------------------------------------ 1 --- */

await test("1", "Elke module levert drie diagnostische vragen", () => {
  const modules = modulesByRank();
  const zonder: string[] = [];
  for (const m of modules) {
    const probes = P.grammarProbes(m);
    if (probes.length !== P.PROBES_PER_MODULE) zonder.push(`${m.code} (${probes.length})`);
  }
  eis(zonder.length === 0, `modules zonder drie vragen: ${zonder.join(", ")}`);
  return `${modules.length} modules × ${P.PROBES_PER_MODULE} = ${P.fullProbeSet().length} vragen`;
});

await test("1", "De vragen zijn betekenisvragen, geen invulvragen", () => {
  const probes = P.fullProbeSet();
  const fout = probes.filter((p) => p.options.length < 2 || !p.options.includes(p.answer));
  eis(fout.length === 0, `${fout.length} vragen zonder bruikbare keuzes`);
  const gem = probes.reduce((n, p) => n + p.options.length, 0) / probes.length;
  return `alle ${probes.length} vragen hebben keuzes, gemiddeld ${gem.toFixed(1)} per vraag`;
});

await test("1", "Twee afnames stellen dezelfde vragen", () => {
  const m = modulesByRank()[0];
  const a = P.grammarProbes(m).map((p) => p.exerciseId);
  const b = P.grammarProbes(m).map((p) => p.exerciseId);
  eis(JSON.stringify(a) === JSON.stringify(b), "de vraagkeuze is niet deterministisch");
  return `${m.code}: ${a.join(", ")}`;
});

/* ------------------------------------------------------------------ 2 --- */

await test("2", "Status volgt uit het aantal goede antwoorden", () => {
  const gevallen: [number, number, string][] = [
    [3, 3, "beheerst"],
    [2, 3, "onzeker"],
    [1, 3, "onbekend"],
    [0, 3, "onbekend"],
    [0, 0, "onbekend"],
  ];
  for (const [c, t, verwacht] of gevallen) {
    const uit = P.statusFor(c, t);
    eis(uit === verwacht, `${c}/${t} gaf ${uit} in plaats van ${verwacht}`);
  }
  return gevallen.map(([c, t, s]) => `${c}/${t} → ${s}`).join(" · ");
});

await test("2", "Er is geen enkele weg om een status zonder antwoorden te zetten", () => {
  const bron = fs.readFileSync(path.join(process.cwd(), "src/lib/placement.ts"), "utf-8");
  const inserts = [...bron.matchAll(/insert\(moduleStatus\)/g)].length;
  eis(inserts === 1, `${inserts} plekken schrijven een status weg; dat moet er één zijn`);
  eis(
    /statusFor\(t\.correct, t\.total\)/.test(bron),
    "de status wordt niet uit de tellingen afgeleid",
  );
  return "één schrijfpad, en dat leest de tellingen van de afname";
});

/* ------------------------------------------------------------------ 3 --- */

await test("3", "Een afname legt per module een status vast", () => {
  const runId = P.startRun("volledig");
  const modules = modulesByRank();
  // Eerste module alles goed, tweede twee van drie, derde alles fout.
  const script: [number, number][] = [
    [3, 3],
    [2, 3],
    [0, 3],
  ];
  for (let i = 0; i < script.length; i++) {
    const m = modules[i];
    const probes = P.grammarProbes(m);
    const [goed] = script[i];
    probes.forEach((p, j) => P.recordGrammar(runId, m.code, p.exerciseId, j < goed, 4000));
  }
  const uit = P.finishRun(runId);
  const kaart = new Map(uit.modules.map((m) => [m.code, m]));
  eis(kaart.get(modules[0].code)?.status === "beheerst", "3/3 gaf geen beheerst");
  eis(kaart.get(modules[1].code)?.status === "onzeker", "2/3 gaf geen onzeker");
  eis(kaart.get(modules[2].code)?.status === "onbekend", "0/3 gaf geen onbekend");

  const opgeslagen = P.moduleStatuses();
  eis(opgeslagen.get(modules[0].code)?.status === "beheerst", "status niet bewaard");
  eis(opgeslagen.get(modules[0].code)?.total === 3, "teller niet bewaard");
  return `${modules[0].code} beheerst 3/3 · ${modules[1].code} onzeker 2/3 · ${modules[2].code} onbekend 0/3`;
});

await test("3", "De ruwe antwoorden blijven bewaard bij de status", () => {
  const runs = db.select().from(schema.placementRun).all();
  const laatste = runs[runs.length - 1];
  const antw = db
    .select()
    .from(schema.placementAnswer)
    .where(eq(schema.placementAnswer.runId, laatste.id))
    .all();
  eis(antw.length === 9, `${antw.length} antwoorden bewaard in plaats van 9`);
  eis(laatste.finishedAt !== null, "de afname is niet afgesloten");
  return `afname ${laatste.id}: ${antw.length} antwoorden, elk met oefening-id en tijd`;
});

await test("3", "Een hertoets overschrijft de status van één module", () => {
  const m = modulesByRank()[0];
  eis(P.moduleStatuses().get(m.code)?.status === "beheerst", "vooraf niet beheerst");
  const runId = P.startRun("module", m.code);
  for (const p of P.grammarProbes(m)) P.recordGrammar(runId, m.code, p.exerciseId, false, 3000);
  P.finishRun(runId);
  const na = P.moduleStatuses().get(m.code);
  eis(na?.status === "onbekend", `hertoets liet de status op ${na?.status}`);
  eis(na?.source === "hertoets", `bron staat op ${na?.source}`);
  return `${m.code}: beheerst → onbekend, bron "hertoets"`;
});

/* ------------------------------------------------------------------ 4 --- */

await test("4", "De veeg zoekt de grens in plaats van alles af te lopen", () => {
  const banden = P.vocabBands();
  eis(banden.length === 5, `${banden.length} banden`);
  eis(
    banden.every((b) => b.itemIds.length > P.VOCAB_SAMPLE),
    "een band is kleiner dan de steekproef",
  );
  // Alles goed: omhoog. Alles fout: omlaag. Precies op de grens: stoppen.
  eis(P.nextBandIndex(3, 5, [3]) === 4, "5 goed ging niet omhoog");
  eis(P.nextBandIndex(3, 0, [3]) === 2, "0 goed ging niet omlaag");
  eis(P.nextBandIndex(3, 3, [3]) === null, "3 goed stopte niet");
  eis(P.nextBandIndex(5, 5, [5]) === null, "boven de hoogste band ging hij door");
  eis(P.nextBandIndex(3, 5, [3, 4]) === null, "een bezochte band werd opnieuw gekozen");
  const groottes = banden.map((b) => b.itemIds.length).join("/");
  return `5 banden van ${groottes} woorden, steekproef ${P.VOCAB_SAMPLE}, start op band ${P.START_BAND}`;
});

await test("4", "De steekproef is gespreid en herhaalbaar", () => {
  const band = P.vocabBands()[2];
  const a = P.sampleFor(band);
  const b = P.sampleFor(band);
  eis(JSON.stringify(a) === JSON.stringify(b), "de steekproef is niet deterministisch");
  eis(new Set(a).size === a.length, "de steekproef bevat dubbele woorden");
  const posities = a.map((id) => band.itemIds.indexOf(id));
  eis(
    posities[posities.length - 1] > band.itemIds.length / 2,
    "de steekproef zit alleen vooraan in de band",
  );
  return `posities ${posities.join(", ")} uit ${band.itemIds.length}`;
});

/* ------------------------------------------------------------------ 5 --- */

await test("5", "Gemeten en aangenomen woorden worden apart geteld", () => {
  const voor = P.vocabOrigin();
  const runId = P.startRun("volledig");
  const band = P.vocabBands()[0];
  for (const id of P.sampleFor(band)) P.recordVocab(runId, band.n, id, true, 2500);
  const uit = P.finishRun(runId);

  eis(uit.grens === band.n, `grens kwam op ${uit.grens} in plaats van ${band.n}`);
  eis(uit.gemeten === P.VOCAB_SAMPLE, `${uit.gemeten} gemeten in plaats van ${P.VOCAB_SAMPLE}`);
  eis(uit.aangenomen > 0, "geen enkel woord aangenomen bij een geslaagde band");

  const na = P.vocabOrigin();
  eis(
    na.aangenomen - voor.aangenomen === uit.aangenomen,
    "de aangenomen kaarten staan niet als aangenomen in de database",
  );
  return `${uit.gemeten} gemeten, ${uit.aangenomen} aangenomen — apart opgeslagen en apart telbaar`;
});

await test("5", "Een gezakte band neemt niets aan", () => {
  const voor = P.vocabOrigin();
  const runId = P.startRun("volledig");
  const band = P.vocabBands()[4];
  P.sampleFor(band).forEach((id, i) => P.recordVocab(runId, band.n, id, i === 0, 2000));
  const uit = P.finishRun(runId);
  eis(uit.grens === null, `grens kwam op ${uit.grens} terwijl de band niet gehaald werd`);
  eis(uit.aangenomen === 0, `${uit.aangenomen} woorden aangenomen na een gezakte band`);
  const na = P.vocabOrigin();
  eis(na.aangenomen === voor.aangenomen, "er zijn toch aangenomen kaarten bijgekomen");
  return "1 van 5 goed → geen grens, geen aannames, alleen de vijf gemeten woorden";
});

/* ------------------------------------------------------------------ 6 --- */

await test("6", "De leesdekking verandert meetbaar mee", () => {
  const verhaal = loadStories()[0];
  const voorKnown = knownItemIds();
  const voor = storyCoverage(verhaal, voorKnown);

  const runId = P.startRun("volledig");
  for (const band of P.vocabBands().slice(0, 3)) {
    for (const id of P.sampleFor(band)) P.recordVocab(runId, band.n, id, true, 2000);
  }
  P.finishRun(runId);

  const na = storyCoverage(verhaal, knownItemIds());
  eis(
    na.coverage > voor.coverage,
    `dekking bleef op ${(voor.coverage * 100).toFixed(1)}% staan`,
  );
  return `${verhaal.slug}: ${(voor.coverage * 100).toFixed(1)}% → ${(na.coverage * 100).toFixed(1)}%`;
});

/* ---------------------------------------------------------------- uitvoer -- */

const TITELS: Record<string, string> = {
  "1": "Diagnostisch per grammaticapunt",
  "2": "Status uit prestatie, niet uit zelfinschatting",
  "3": "Een afname legt vast wat ze gemeten heeft",
  "4": "Woordenschat als adaptieve veeg",
  "5": "Gemeten is niet hetzelfde als aangenomen",
  "6": "De dekkingsmeter beweegt mee",
};

const perPunt = new Map<string, Result[]>();
for (const r of results) {
  const lijst = perPunt.get(r.punt);
  if (lijst) lijst.push(r);
  else perPunt.set(r.punt, [r]);
}

console.log("\nAcceptatie Fase 1.5 — plaatsingstoets\n" + "─".repeat(64));
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
