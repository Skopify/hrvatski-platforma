import { eq, inArray } from "drizzle-orm";

import type { Exercise } from "./content";
import { loadLessons } from "./content";
import { db } from "./db";
import { card, items, moduleStatus, placementAnswer, placementRun } from "./db/schema";
import { modulesByRank, type GrammarModule } from "./modules";
import { applyReview, ensureCards } from "./srs";

/*
  De plaatsingstoets.

  Het probleem dat hij oplost: het curriculum is compleet van nul tot eind, maar
  wie al Kroatisch kan, hoeft niet bij nul te beginnen. De verleiding is dan om
  te vragen "wat beheers je al?" — en dat is precies de meting die je niet moet
  doen. Bij grammatica is zelfinschatting systematisch te optimistisch, en juist
  bij de onderwerpen die het meeste opleveren (aspect, de volgorde van de korte
  woordjes) weet een leerder meestal niet dát hij ze fout doet.

  Dus: drie vragen per module, en de status volgt uit de antwoorden. Geen
  niveaucijfer, want dat middelt weg wat je wilt zien. Het profiel is naar
  verwachting grillig — sommige naamvallen goed, aspect niet — en dat grillige
  patroon ís de uitslag.

  De woordenschat werkt anders. Die kun je niet uitputtend toetsen, dus de veeg
  neemt een steekproef per band en zoekt de grens. Wat daarbuiten valt is niet
  gemeten, en dat wordt ook zo genoteerd: `card.assumed` staat op 1 voor elk
  woord dat op grond van zijn band is aangenomen. Overal waar een getal op het
  scherm komt, staan gemeten en aangenomen apart.
*/

export type ModuleStatusValue = "beheerst" | "onzeker" | "onbekend";

/** Zoveel vragen per module. Drie is genoeg om «toeval» van «kennen» te scheiden en kort genoeg om vol te houden. */
export const PROBES_PER_MODULE = 3;

/** Zoveel woorden per frequentieband. */
export const VOCAB_SAMPLE = 5;

/** Vanaf zoveel goed telt een band als gehaald. */
export const BAND_PASS = 4;

/**
 * De grens tussen de drie statussen.
 *
 * Alles goed is beheerst. Eén fout is onzeker en niet «bijna beheerst»: bij drie
 * vragen is één misser een derde van de meting, en die module hoort gewoon nog
 * langs te komen — alleen niet vooraan.
 */
export function statusFor(correct: number, total: number): ModuleStatusValue {
  if (total === 0) return "onbekend";
  if (correct === total) return "beheerst";
  if (correct >= Math.ceil(total / 2)) return "onzeker";
  return "onbekend";
}

export const STATUS_TEXT: Record<ModuleStatusValue, string> = {
  beheerst: "Alle vragen goed. Deze module staat achteraan in je pad.",
  onzeker: "Deels goed. Je komt hier langs, maar met minder herhaling.",
  onbekend: "Niet gemeten of overwegend fout. Deze module doe je helemaal.",
};

/* ------------------------------------------------------------ grammatica --- */

export interface GrammarProbe {
  moduleCode: string;
  moduleTitle: string;
  exerciseId: string;
  prompt: string;
  given?: string;
  options: string[];
  answer: string;
}

/**
 * De drie vragen van een module.
 *
 * Bewust uit de interpretatiestap: daar kies je de betekenis en niet de vorm,
 * en dat is wat je wilt toetsen. Een invulvraag meet ook typvaardigheid en
 * spelling mee, en straft iemand af die de regel wél kent maar het diakritische
 * teken vergeet. Een keuzevraag over betekenis doet dat niet.
 *
 * De keuze is deterministisch — op oefening-id gesorteerd — zodat een hertoets
 * dezelfde vragen stelt en het verschil dus echt over jou gaat.
 */
export function grammarProbes(m: GrammarModule): GrammarProbe[] {
  const geschikt: Exercise[] = [];
  for (const fase of m.phases) {
    if (fase.kind !== "interpretation") continue;
    for (const e of fase.exercises) {
      if ((e.type === "interpret" || e.type === "choice") && e.distractors?.length && e.answer) {
        geschikt.push(e);
      }
    }
  }
  // Terugval: sommige modules kunnen een magere interpretatiestap hebben.
  if (geschikt.length < PROBES_PER_MODULE) {
    for (const fase of m.phases) {
      if (fase.kind === "interpretation") continue;
      for (const e of fase.exercises) {
        if (e.type === "choice" && e.distractors?.length && e.answer) geschikt.push(e);
      }
    }
  }

  return geschikt
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, PROBES_PER_MODULE)
    .map((e) => ({
      moduleCode: m.code,
      moduleTitle: m.title_nl,
      exerciseId: e.id,
      prompt: e.prompt_nl ?? "Wat wordt hier bedoeld?",
      given: e.given,
      // Vaste volgorde, zodat het goede antwoord niet altijd op dezelfde plek staat.
      options: [e.answer as string, ...(e.distractors ?? [])].sort((a, b) =>
        a.localeCompare(b),
      ),
      answer: e.answer as string,
    }));
}

/** Alle grammaticavragen van de hele toets, in de volgorde van het curriculum. */
export function fullProbeSet(): GrammarProbe[] {
  return modulesByRank().flatMap(grammarProbes);
}

/* ---------------------------------------------------------- woordenschat --- */

export interface Band {
  n: number;
  label: string;
  itemIds: string[];
}

/**
 * De frequentiebanden.
 *
 * De spec vraagt om banden uit een frequentielijst vanaf rang 1000. Die lijst is
 * er niet: wat er ligt is een gecureerde top honderd die zichzelf expliciet geen
 * meting noemt. Daarom banden uit de leergang zelf — de volgorde van de lessen
 * is wél een echte ordening, gemaakt door mensen die de taal onderwijzen.
 *
 * Wat dat betekent voor de uitslag staat er op het scherm bij: boven de
 * woordenschat van de leergang kan deze toets niets meten, en hij beweert het
 * ook niet.
 */
export function vocabBands(): Band[] {
  const groepen: { n: number; label: string; van: number; tot: number }[] = [
    { n: 1, label: "les 0–3 — de eerste woorden", van: 0, tot: 3 },
    { n: 2, label: "les 4–7 — dagelijkse dingen", van: 4, tot: 7 },
    { n: 3, label: "les 8–11 — praten over jezelf", van: 8, tot: 11 },
    { n: 4, label: "les 12–15 — plannen en werk", van: 12, tot: 15 },
    { n: 5, label: "les 16–20 — het laatste kwart", van: 16, tot: 20 },
  ];

  const perLes = new Map<number, string[]>();
  for (const les of loadLessons()) {
    perLes.set(
      les.number,
      les.vocab.map((v) => v.id),
    );
  }

  return groepen.map((g) => {
    const ids: string[] = [];
    for (let l = g.van; l <= g.tot; l++) ids.push(...(perLes.get(l) ?? []));
    return { n: g.n, label: g.label, itemIds: ids };
  });
}

/** Waar de veeg begint: in het midden, zodat hij twee kanten op kan. */
export const START_BAND = 3;

/**
 * Een vaste steekproef uit een band.
 *
 * Deterministisch en gespreid: elke n-de woord in plaats van de eerste vijf,
 * want de eerste woorden van een les zijn niet representatief voor de les.
 */
export function sampleFor(band: Band, size = VOCAB_SAMPLE): string[] {
  const ids = band.itemIds;
  if (ids.length <= size) return [...ids];
  const stap = ids.length / size;
  const uit: string[] = [];
  for (let i = 0; i < size; i++) uit.push(ids[Math.floor(i * stap)]);
  return uit;
}

/**
 * De volgende band, op grond van wat er net gebeurde.
 *
 * Vier of vijf goed → een band hoger. Twee of minder → een band lager. Precies
 * drie goed betekent dat je op de grens zit, en dan is er niets meer te vinden:
 * de veeg stopt.
 */
export function nextBandIndex(
  huidig: number,
  correct: number,
  bezocht: number[],
  aantalBanden = 5,
): number | null {
  let volgend: number | null = null;
  if (correct >= BAND_PASS) volgend = huidig + 1;
  else if (correct <= VOCAB_SAMPLE - BAND_PASS) volgend = huidig - 1;
  if (volgend === null) return null;
  if (volgend < 1 || volgend > aantalBanden) return null;
  if (bezocht.includes(volgend)) return null;
  return volgend;
}

export interface VocabProbe {
  band: number;
  itemId: string;
  hr: string;
  answer: string;
  options: string[];
}

/**
 * De vragen van één band: Kroatisch woord, kies de betekenis.
 *
 * Receptief en met keuzes, om dezelfde reden als bij de grammatica — een
 * invulvraag meet spelling mee, en dat is hier niet wat je wilt weten. De
 * afleiders komen uit andere banden, zodat ze niet toevallig op elkaar lijken.
 */
export function vocabProbes(band: Band, size = VOCAB_SAMPLE): VocabProbe[] {
  const ids = sampleFor(band, size);
  if (!ids.length) return [];

  const alle = db.select({ id: items.id, payload: items.payload }).from(items).all();
  const betekenis = new Map<string, { hr: string; nl: string }>();
  for (const r of alle) {
    const v = r.payload as { hr?: string; nl?: string };
    if (v?.hr && v?.nl) betekenis.set(r.id, { hr: v.hr, nl: v.nl });
  }

  const pool = [...betekenis.entries()].filter(([id]) => !band.itemIds.includes(id));

  return ids.flatMap((id, i) => {
    const woord = betekenis.get(id);
    if (!woord) return [];
    const afleiders: string[] = [];
    // Vaste greep uit de pool, gespreid, zodat een hertoets hetzelfde vraagt.
    for (let k = 1; afleiders.length < 3 && k < pool.length; k++) {
      const kandidaat = pool[(i * 97 + k * 31) % pool.length][1].nl;
      if (kandidaat !== woord.nl && !afleiders.includes(kandidaat)) afleiders.push(kandidaat);
    }
    return [
      {
        band: band.n,
        itemId: id,
        hr: woord.hr,
        answer: woord.nl,
        options: [woord.nl, ...afleiders].sort((a, b) => a.localeCompare(b)),
      },
    ];
  });
}

/* ------------------------------------------------------------- afnemen --- */

export function startRun(kind: "volledig" | "module", scope?: string): number {
  const rij = db
    .insert(placementRun)
    .values({ kind, scope: scope ?? null, startedAt: Date.now() })
    .returning({ id: placementRun.id })
    .get();
  return rij.id;
}

export function recordGrammar(
  runId: number,
  moduleCode: string,
  exerciseId: string,
  correct: boolean,
  durationMs: number,
): void {
  db.insert(placementAnswer)
    .values({
      runId,
      kind: "grammatica",
      moduleCode,
      exerciseId,
      correct: correct ? 1 : 0,
      durationMs,
      createdAt: Date.now(),
    })
    .run();
}

export function recordVocab(
  runId: number,
  band: number,
  itemId: string,
  correct: boolean,
  durationMs: number,
): void {
  db.insert(placementAnswer)
    .values({
      runId,
      kind: "woord",
      band,
      itemId,
      correct: correct ? 1 : 0,
      durationMs,
      createdAt: Date.now(),
    })
    .run();
}

export interface PlacementResult {
  runId: number;
  modules: { code: string; status: ModuleStatusValue; correct: number; total: number }[];
  /** De hoogste band waarvan de steekproef geslaagd is, of null als geen enkele band haalde. */
  grens: number | null;
  gemeten: number;
  aangenomen: number;
}

/**
 * De toets afsluiten: van antwoorden naar conclusies.
 *
 * Twee dingen gebeuren hier, en ze zijn met opzet gescheiden gehouden.
 *
 * De modulestatus is een pure afleiding uit de antwoorden van déze afname. Er
 * wordt niets meegewogen uit eerdere sessies; wie de toets overdoet, krijgt de
 * uitslag van vandaag.
 *
 * De woordenschat wordt wél in de kaarten geschreven, want anders verandert er
 * niets aan wat je te zien krijgt. Elk woord dat de toets zelf heeft gezien
 * krijgt een echte review. De rest van een geslaagde band krijgt er ook een,
 * maar met `assumed = 1` — aangenomen, niet gemeten. Dat onderscheid moet
 * overal zichtbaar blijven waar een dekkingsgetal getoond wordt.
 */
export function finishRun(runId: number, now = new Date()): PlacementResult {
  const antwoorden = db
    .select()
    .from(placementAnswer)
    .where(eq(placementAnswer.runId, runId))
    .all();

  const run = db.select().from(placementRun).where(eq(placementRun.id, runId)).get();
  const bron = run?.kind === "module" ? "hertoets" : "plaatsingstoets";

  /* -- grammatica -- */
  const perModule = new Map<string, { correct: number; total: number }>();
  for (const a of antwoorden) {
    if (a.kind !== "grammatica" || !a.moduleCode) continue;
    const t = perModule.get(a.moduleCode) ?? { correct: 0, total: 0 };
    t.total++;
    if (a.correct) t.correct++;
    perModule.set(a.moduleCode, t);
  }

  const modules: PlacementResult["modules"] = [];
  for (const [code, t] of perModule) {
    const status = statusFor(t.correct, t.total);
    db.insert(moduleStatus)
      .values({
        code,
        status,
        correct: t.correct,
        total: t.total,
        source: bron,
        runId,
        measuredAt: now.getTime(),
      })
      .onConflictDoUpdate({
        target: moduleStatus.code,
        set: {
          status,
          correct: t.correct,
          total: t.total,
          source: bron,
          runId,
          measuredAt: now.getTime(),
        },
      })
      .run();
    modules.push({ code, status, correct: t.correct, total: t.total });
  }

  /* -- woordenschat -- */
  const perBand = new Map<number, { correct: number; total: number }>();
  let gemeten = 0;
  for (const a of antwoorden) {
    if (a.kind !== "woord" || !a.itemId || a.band === null) continue;
    const t = perBand.get(a.band) ?? { correct: 0, total: 0 };
    t.total++;
    if (a.correct) t.correct++;
    perBand.set(a.band, t);

    const [cardId] = ensureCards([a.itemId], "LEX_RECOG", now);
    if (cardId) {
      applyReview(cardId, a.correct ? 3 : 1, a.durationMs, now);
      gemeten++;
    }
  }

  let grens: number | null = null;
  for (const [n, t] of perBand) {
    if (t.correct >= BAND_PASS && (grens === null || n > grens)) grens = n;
  }

  let aangenomen = 0;
  if (grens !== null) {
    const banden = vocabBands();
    const gezien = new Set(
      antwoorden.filter((a) => a.kind === "woord" && a.itemId).map((a) => a.itemId as string),
    );
    // Alles tot en met de grens: de geslaagde band en alles eronder.
    for (const band of banden.filter((b) => b.n <= grens!)) {
      const rest = band.itemIds.filter((id) => !gezien.has(id));
      if (!rest.length) continue;
      const nieuw = ensureCards(rest, "LEX_RECOG", now);
      for (const cardId of nieuw) applyReview(cardId, 3, 0, now);
      // Alleen de kaarten die déze toets heeft aangelegd krijgen de vlag; een
      // kaart die je al had is echte historie en blijft dat.
      if (nieuw.length) {
        db.update(card).set({ assumed: 1 }).where(inArray(card.id, nieuw)).run();
        aangenomen += nieuw.length;
      }
    }
  }

  db.update(placementRun)
    .set({ finishedAt: now.getTime() })
    .where(eq(placementRun.id, runId))
    .run();

  return { runId, modules, grens, gemeten, aangenomen };
}

/* --------------------------------------------------------------- lezen --- */

export interface StoredStatus {
  code: string;
  status: ModuleStatusValue;
  correct: number;
  total: number;
  source: string;
  measuredAt: number;
}

export function moduleStatuses(): Map<string, StoredStatus> {
  return new Map(
    db
      .select()
      .from(moduleStatus)
      .all()
      .map((r) => [
        r.code,
        {
          code: r.code,
          status: r.status as ModuleStatusValue,
          correct: r.correct,
          total: r.total,
          source: r.source,
          measuredAt: r.measuredAt,
        },
      ]),
  );
}

/** Hoeveel woorden gemeten zijn en hoeveel aangenomen — nooit als één getal. */
export function vocabOrigin(): { gemeten: number; aangenomen: number } {
  const rijen = db.select({ assumed: card.assumed }).from(card).all();
  let gemeten = 0;
  let aangenomen = 0;
  for (const r of rijen) (r.assumed ? aangenomen++ : gemeten++);
  return { gemeten, aangenomen };
}

/** Een module terugzetten op onbekend — de weg terug uit "beheerst". */
export function clearModuleStatus(code: string): void {
  db.delete(moduleStatus).where(eq(moduleStatus.code, code)).run();
}

/**
 * Heeft er ooit een volledige toets gedrááid — dus ook afgemaakt?
 *
 * Alleen op `kind` afgaan zou fout zijn: de afname wordt aangemaakt zodra je de
 * pagina opent, en wie hem meteen weer wegklikt heeft niets gemeten. Zo'n lege
 * rij mag nooit tot de mededeling leiden dat er een uitslag is.
 */
export function hasPlacement(): boolean {
  return db
    .select({ id: placementRun.id, finishedAt: placementRun.finishedAt })
    .from(placementRun)
    .where(eq(placementRun.kind, "volledig"))
    .all()
    .some((r) => r.finishedAt !== null);
}

/** Het aantal items in de leergang, voor de eerlijke noemer op het scherm. */
export function vocabTotal(): number {
  return db.select({ id: items.id }).from(items).where(eq(items.kind, "vocab")).all().length;
}
