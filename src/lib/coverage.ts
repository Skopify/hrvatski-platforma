import { eq, inArray } from "drizzle-orm";
import { State } from "ts-fsrs";

import { glossKey, loadLessons, loadStories, storySentences, type Story } from "./content";
import { db } from "./db";
import { encounters, items, srs } from "./db/schema";
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

/**
 * Kroatische functiewoorden — gesloten klasse.
 *
 * Deze lijst is nodig voor een eerlijke meting. Sommige voorzetsels en
 * voornaamwoorden staan óók in de woordenlijst van een les, en zonder deze lijst
 * zou een verhaal dat toevallig veel «u» en «i» bevat lager scoren dan een veel
 * moeilijkere tekst. Dat is precies wat er gebeurde: het A1.2-verhaal kwam
 * onder het A2.2-verhaal uit.
 *
 * Functiewoorden zijn niet wat een tekst zwaar maakt — ze komen met de
 * grammatica mee en herhalen zich zo vaak dat ze vanzelf blijven zitten. Nation
 * rekent zijn drempels over álle lopende woorden, met de aanname dat de
 * structuurwoorden bekend zijn. Deze lijst maakt die aanname expliciet.
 */
const FUNCTION_WORDS = new Set<string>([
  // voorzetsels
  "u", "na", "s", "sa", "iz", "od", "do", "za", "po", "pred", "kod", "prije", "poslije",
  "blizu", "o", "pri", "prema", "bez", "nakon", "pokraj", "iznad", "ispod", "između", "zbog",
  // voegwoorden en signaalwoorden
  "i", "a", "ali", "ili", "da", "jer", "nego", "kad", "kada", "dok", "zato", "pa", "te",
  // persoonlijke en wederkerende voornaamwoorden
  "ja", "ti", "on", "ona", "ono", "mi", "vi", "oni", "one", "me", "te", "ga", "ju", "nas",
  "vas", "ih", "mu", "joj", "nam", "vam", "im", "se", "sebe", "si", "njoj", "njemu", "njima",
  "mene", "tebe", "njega", "nje",
  // bezittelijk en aanwijzend
  "moj", "moja", "moje", "mog", "moju", "mojim", "tvoj", "tvoja", "njegov", "njegova",
  "njezin", "njezina", "njezinu", "naš", "naša", "vaš", "njihov", "svoj", "svoja", "svojim",
  "ovo", "to", "ovaj", "ova", "taj", "ta", "onaj",
  // vraagwoorden
  "tko", "što", "koji", "koja", "koje", "koju", "kojim", "gdje", "zašto", "kako", "kakav",
  // biti, htjeti en hun ontkenningen
  "sam", "si", "je", "smo", "ste", "su", "bio", "bila", "bilo", "bili", "bile", "biti",
  "nisam", "nisi", "nije", "nismo", "niste", "nisu", "bit", "budem",
  "ću", "ćeš", "će", "ćemo", "ćete", "hoću", "hoćeš",
  // partikels en ontkenning
  "ne", "ni", "li", "već", "još", "samo", "tek", "baš",
  // onbepaalde woorden
  "sve", "svaki", "svaka", "neki", "nešto", "netko", "nekoliko", "nikada", "ništa",
]);

export type WordClass =
  | { kind: "content"; itemId: string }
  /** Eigennaam — hoef je niet te leren, telt in Nations methode als bekend. */
  | { kind: "proper" }
  /** Functiewoord of grammaticale vorm; komt met de grammatica mee, niet als woordje. */
  | { kind: "function" };

/** Waar hoort deze woordvorm uit een verhaal toe? */
export function classify(story: Story, token: string): WordClass | null {
  const key = glossKey(token);
  if (!key) return null;

  // Functiewoorden gaan vóór alles: ook als er een woordkaart voor bestaat,
  // maken ze een tekst niet moeilijker.
  if (FUNCTION_WORDS.has(key)) return { kind: "function" };

  const gloss = story.glossary[key];
  if (!gloss) return { kind: "function" };

  if (gloss.item) return { kind: "content", itemId: gloss.item };

  const index = vocabForms();
  for (const candidate of [gloss.lemma, gloss.hr, key]) {
    if (!candidate) continue;
    const hit = index.get(glossKey(candidate));
    if (hit) return { kind: "content", itemId: hit };
  }

  // Hoofdletter in de woordenboekvorm betekent een naam: Nina, Zagreb, Dolac.
  if (gloss.hr && gloss.hr[0] !== gloss.hr[0].toLowerCase()) return { kind: "proper" };
  return { kind: "function" };
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
      itemId: srs.itemId,
      due: srs.due,
      stability: srs.stability,
      difficulty: srs.difficulty,
      elapsedDays: srs.elapsedDays,
      scheduledDays: srs.scheduledDays,
      reps: srs.reps,
      lapses: srs.lapses,
      state: srs.state,
      lastReview: srs.lastReview,
    })
    .from(srs)
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
