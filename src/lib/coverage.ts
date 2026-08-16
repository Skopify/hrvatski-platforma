import { eq, inArray } from "drizzle-orm";
import { State } from "ts-fsrs";

import { glossKey, loadLessons, loadStories, storySentences, type Story } from "./content";
import { db } from "./db";
import { card, encounters, items, srs } from "./db/schema";
import { analyze } from "./analyze";
import { FUNCTION_WORDS } from "./forms";
import { retrievability, type SrsRow } from "./srs";

/*
  Lexicale dekking.

  Hu & Nation: je moet ongeveer 95% van de lopende woorden in een tekst kennen
  voor minimaal begrip, en 98% om een tekst echt te volgen én onbekende woorden
  uit de context te kunnen raden. Onder die grens is lezen zwoegen zonder
  opbrengst — je zoekt zoveel op dat er geen verhaal overblijft.

  Dat is normaal niet te meten, want geen enkele app weet welke woorden jij kent.
  Dit platform weet dat wél: elk woord heeft een FSRS-kaart met een geschatte
  retentie. Daarmee wordt "welk verhaal moet ik nu lezen" een meting in plaats
  van een gok.
*/

/** Vanaf welke geschatte retentie een woord meetelt als "gekend". */
const KNOWN_AT = 0.5;

/** Na zoveel ontmoetingen in context blijft een woord vanzelf hangen. */
export const ENCOUNTERS_TARGET = 8;

/* --------------------------------------------------------------- index --- */

let formIndex: Map<string, string> | null = null;

/**
 * Elke woordvorm die de brondata expliciet geeft → het item waar hij bij hoort.
 * Alleen vormen die er écht staan; er wordt niets verbogen.
 */
function vocabForms(): Map<string, string> {
  if (formIndex) return formIndex;
  const map = new Map<string, string>();
  const add = (form: string | null | undefined, id: string) => {
    if (!form) return;
    const key = glossKey(form);
    if (key && !map.has(key)) map.set(key, id);
  };
  for (const lesson of loadLessons()) {
    for (const v of lesson.vocab) {
      add(v.hr, v.id);
      add(v.gen_sg, v.id);
      add(v.nom_pl, v.id);
      add(v.present_1sg, v.id);
    }
  }
  for (const story of loadStories()) {
    for (const v of story.vocab) {
      add(v.hr, v.id);
      add(v.gen_sg, v.id);
      add(v.nom_pl, v.id);
      add(v.present_1sg, v.id);
    }
  }
  formIndex = map;
  return map;
}


export type WordClass =
  | { kind: "content"; itemId: string }
  /** Eigennaam — hoef je niet te leren, telt in Nations methode als bekend. */
  | { kind: "proper" }
  /** Functiewoord of grammaticale vorm; komt met de grammatica mee, niet als woordje. */
  | { kind: "function" }
  /** Niemand kent dit woord: geen glossary, geen vormcatalogus, geen functiewoord. */
  | { kind: "unknown" };

/**
 * Waar hoort deze woordvorm uit een verhaal toe?
 *
 * Let op de laatste tak. Tot voor kort viel alles wat níet in de glossary stond
 * en geen functiewoord was, stilzwijgend in de bak "functiewoord" — en die telt
 * als bekend. Dat maakte de dekking systematisch te hoog: gemeten over de vijf
 * verhalen kregen 24 van de 566 lopende woorden zo gratis een vinkje, waaronder
 * gewone inhoudswoorden als «problem», «sekundi» en «litre». Vier procent klinkt
 * klein, maar het is precies het verschil tussen 95% en 99% — de twee getallen
 * waar de hele leesvolgorde op draait.
 *
 * Nu wordt de vormcatalogus als tweede kans geraadpleegd, en wat ook die niet
 * kent heet onbekend. Onbekend telt niet als bekend.
 */
export function classify(story: Story, token: string): WordClass | null {
  const key = glossKey(token);
  if (!key) return null;

  // Functiewoorden gaan vóór alles: ook als er een woordkaart voor bestaat,
  // maken ze een tekst niet moeilijker.
  if (FUNCTION_WORDS.has(key)) return { kind: "function" };

  const gloss = story.glossary[key];
  if (gloss) {
    if (gloss.item) return { kind: "content", itemId: gloss.item };

    const index = vocabForms();
    for (const candidate of [gloss.lemma, gloss.hr, key]) {
      if (!candidate) continue;
      const hit = index.get(glossKey(candidate));
      if (hit) return { kind: "content", itemId: hit };
    }

    // Hoofdletter in de woordenboekvorm betekent een naam: Nina, Zagreb, Dolac.
    if (gloss.hr && gloss.hr[0] !== gloss.hr[0].toLowerCase()) return { kind: "proper" };
  }

  // Geen glossary-ingang: nog één kans via de vormcatalogus, dan is het op.
  const [ontleed] = analyze(token);
  if (ontleed && !ontleed.unknown) {
    if (ontleed.klasse === "proper") return { kind: "proper" };
    if (ontleed.klasse === "function") return { kind: "function" };
    if (ontleed.lemmaId) return { kind: "content", itemId: ontleed.lemmaId };
  }

  return { kind: "unknown" };
}

/* ------------------------------------------------------------- dekking --- */

export interface Coverage {
  totalWords: number;
  knownWords: number;
  /** 0-1, vergelijkbaar met de drempels van Hu & Nation. */
  coverage: number;
  /** Inhoudswoorden in dit verhaal die je nog niet kent. */
  unknownItems: string[];
  /** Inhoudswoorden die nog onder de acht ontmoetingen zitten. */
  freshItems: string[];
  /** Hoeveel lopende woorden aan een woordkaart gekoppeld konden worden. */
  contentWords: number;
  /** Woorden die niemand thuis kon brengen. Tellen als niet-bekend. */
  unrecognisedWords: number;
}

export type CoverageVerdict = "ideaal" | "goed" | "pittig" | "hoog";

export function verdictOf(coverage: number): CoverageVerdict {
  if (coverage >= 0.98) return "ideaal";
  if (coverage >= 0.95) return "goed";
  if (coverage >= 0.9) return "pittig";
  return "hoog";
}

export const VERDICT_TEXT: Record<CoverageVerdict, string> = {
  ideaal: "Je kent bijna alles — hier leer je woorden vanzelf uit de context.",
  goed: "Goed leesbaar. Je zoekt af en toe iets op, maar het verhaal blijft staan.",
  pittig: "Pittig. Je gaat regelmatig opzoeken; lees het gerust, maar neem de tijd.",
  hoog: "Boven je niveau. Je zult veel moeten opzoeken — leerzaam, maar geen vlot lezen.",
};

/** De verzameling items die je op dit moment kent. */
export function knownItemIds(): Set<string> {
  const now = new Date();
  const rows = db
    .select({
      itemId: card.itemId,
      due: srs.due,
      stability: srs.stability,
      difficulty: srs.difficulty,
      elapsedDays: srs.elapsedDays,
      scheduledDays: srs.scheduledDays,
      reps: srs.reps,
      lapses: srs.lapses,
      state: srs.state,
      learningSteps: srs.learningSteps,
      lastReview: srs.lastReview,
    })
    .from(srs)
    .innerJoin(card, eq(card.id, srs.cardId))
    .all();

  const known = new Set<string>();
  for (const r of rows) {
    if (r.state === State.New) continue;
    if (retrievability(r as SrsRow, now) >= KNOWN_AT) known.add(r.itemId);
  }
  return known;
}

/** Aantal ontmoetingen per item, als map. */
export function encounterCounts(): Map<string, number> {
  return new Map(
    db
      .select({ itemId: encounters.itemId, count: encounters.count })
      .from(encounters)
      .all()
      .map((r) => [r.itemId, r.count]),
  );
}

export function storyCoverage(
  story: Story,
  known: Set<string>,
  seenCounts?: Map<string, number>,
): Coverage {
  let total = 0;
  let knownWords = 0;
  let contentWords = 0;
  let onherkend = 0;
  const unknown = new Set<string>();
  const fresh = new Set<string>();

  for (const sentence of storySentences(story)) {
    for (const token of sentence.hr.split(/\s+/)) {
      const cls = classify(story, token);
      if (!cls) continue;
      total++;

      if (cls.kind === "content") {
        contentWords++;
        if (known.has(cls.itemId)) knownWords++;
        else unknown.add(cls.itemId);
        if ((seenCounts?.get(cls.itemId) ?? 0) < ENCOUNTERS_TARGET) fresh.add(cls.itemId);
      } else if (cls.kind === "unknown") {
        // Niet thuis te brengen. Dit is waar de meting eerlijk moet blijven: als
        // onbekend gratis als bekend telt, meet je jezelf een te hoge dekking aan
        // en krijg je teksten die te zwaar zijn.
        onherkend++;
      } else {
        // Eigennamen en functiewoorden tellen als bekend: die hoef je niet als
        // woordje te leren, en Nations drempels zijn over álle lopende woorden.
        knownWords++;
      }
    }
  }

  return {
    totalWords: total,
    knownWords,
    coverage: total ? knownWords / total : 0,
    unknownItems: [...unknown],
    freshItems: [...fresh],
    contentWords,
    unrecognisedWords: onherkend,
  };
}

/** Dekking voor alle verhalen in één keer — één query voor de hele index. */
export function allCoverage(): Map<string, Coverage> {
  const known = knownItemIds();
  const seen = encounterCounts();
  return new Map(loadStories().map((s) => [s.slug, storyCoverage(s, known, seen)]));
}

/* --------------------------------------------------------- ontmoetingen --- */

/**
 * Eén ontmoeting bijschrijven voor elk inhoudswoord in een verhaal. Wordt
 * aangeroepen als je een verhaal als gelezen markeert — één keer per keer lezen,
 * want de tekst één keer doorlopen is precies één blootstelling.
 */
export function recordStoryEncounters(story: Story): number {
  const seen = new Set<string>();
  for (const sentence of storySentences(story)) {
    for (const token of sentence.hr.split(/\s+/)) {
      const cls = classify(story, token);
      if (cls?.kind === "content") seen.add(cls.itemId);
    }
  }
  if (seen.size === 0) return 0;

  // Alleen items die echt bestaan; een gloss kan naar een woord uit een les
  // wijzen die nog niet geseed is.
  const existing = new Set(
    db
      .select({ id: items.id })
      .from(items)
      .where(inArray(items.id, [...seen]))
      .all()
      .map((r) => r.id),
  );

  const now = Date.now();
  for (const id of seen) {
    if (!existing.has(id)) continue;
    const row = db.select().from(encounters).where(eq(encounters.itemId, id)).get();
    if (row) {
      db.update(encounters)
        .set({ count: row.count + 1, lastAt: now })
        .where(eq(encounters.itemId, id))
        .run();
    } else {
      db.insert(encounters).values({ itemId: id, count: 1, lastAt: now }).run();
    }
  }
  return existing.size;
}
