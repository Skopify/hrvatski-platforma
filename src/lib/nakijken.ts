import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import {
  lessonExercises,
  loadLessons,
  loadStories,
  storySentences,
  type Exercise,
  type ExerciseType,
} from "./content";
import { db } from "./db";
import { zinReview } from "./db/schema";
import { FUNCTION_WORDS, formKey, readingsFor } from "./forms";
import { loadModules, moduleExercises } from "./modules";

/**
 * De nakijkstroom: al het Kroatisch dat ik zelf geschreven heb, klaargelegd om
 * door een moedertaalspreker beoordeeld te worden.
 *
 * Waarom dit nodig is naast `npm run check:taal`: die controle kijkt of woorden
 * bestaan en of voorzetsels de goede naamval krijgen, en dat is alles wat een
 * machine kan. Of een zin natuurlijk klinkt, of het aspect klopt, of de
 * woordvolgorde is wat een Kroaat zou zeggen — daar is geen regel voor. Dat
 * moet iemand lezen.
 *
 * De eenheid is de zin, niet de oefening. Negenhonderd zinnen van gemiddeld zes
 * woorden is twee uur werk in blokjes van twintig; elfhonderd oefeningen los
 * beoordelen is dat niet, en wat niet af komt, is niet nagekeken.
 */

export type Herkomst = "module" | "les" | "verhaal";

export interface Zin {
  hash: string;
  hr: string;
  /** De Nederlandse kant, als die er is: vertaling of opdracht. */
  nl?: string;
  herkomst: Herkomst;
  /** Waar hij vandaan komt, voor als de nakijker context wil. */
  plek: string;
  /** Woorden die het platform niet kent — het meest waarschijnlijke probleem. */
  onbekend: string[];
}

export type ReviewStatus = "goedgekeurd" | "fout" | "twijfel";

/**
 * De sleutel van een zin.
 *
 * Genormaliseerd op spaties en hoofdletters zodat een zin die op twee plekken
 * net anders is uitgelijnd, één keer wordt nagekeken. Níét genormaliseerd op
 * diakrieten of leestekens: dat zijn juist de dingen waar het oordeel over gaat.
 */
export function zinHash(hr: string): string {
  const genormaliseerd = hr.trim().replace(/\s+/g, " ").normalize("NFC");
  return crypto.createHash("sha1").update(genormaliseerd).digest("hex").slice(0, 12);
}

/**
 * Is deze regel Kroatisch?
 *
 * Dit werd eerst per veld beslist — `given` is Kroatisch bij een leesoefening,
 * Nederlands bij een vertaling — en dat hield geen stand. Bij meerkeuze staat
 * de situatie in het Nederlands in `given` en de te beoordelen zin in `answer`;
 * bij interpretatie staan er twee Nederlandse betekenissen in `given`. Zo
 * kwamen «Ik heb hem gisteren op het strand gezien» en «Je wilt dat een vriend
 * niet zoveel werkt» boven aan de nakijkstapel te staan, en die hoeft geen
 * Kroaat te lezen.
 *
 * De vraag is dus niet in welk veld iets staat maar wat er staat. Kroatisch
 * herkent zich aan zijn eigen woorden: het merendeel van de tokens komt voor in
 * de vormcatalogus of in de gesloten klasse functiewoorden. Een Nederlandse zin
 * haalt dat nooit.
 */
/**
 * Nederlandse functiewoorden die géén Kroatisch woord zijn.
 *
 * Met opzet zonder «je», «na», «to», «dan» en «a»: die bestaan in beide talen
 * en zouden Kroatische zinnen als Nederlands wegzetten.
 */
const NL_STOPWOORDEN = new Set([
  "de", "het", "een", "en", "van", "is", "dat", "niet", "met", "op", "in", "voor",
  "aan", "om", "ook", "als", "maar", "er", "bij", "uit", "naar", "wordt", "worden",
  "heeft", "hebben", "was", "waren", "omdat", "want", "deze", "dit", "die", "wat",
  "hoe", "waarom", "wel", "geen", "nog", "veel", "twee", "drie", "hier", "daar",
  "staat", "komt", "gaat", "krijgt", "zegt", "betekent", "dus", "altijd", "nooit",
  "jij", "wij", "zij", "ik", "hij", "hun", "haar", "zijn", "eindigt", "woord",
]);

function lijktKroatisch(regel: string): boolean {
  const tokens = regel
    .replace(/[*_]/g, "")
    .split(/[^\p{L}\p{N}\-]+/u)
    .map(formKey)
    .filter((t) => t && !/^\d/.test(t));
  if (tokens.length < 2) return false;

  /*
    Nederlands eerst uitsluiten, en pas daarna naar het Kroatisch kijken.

    Andersom werkte niet. De eerste versie zag één Kroatische letter als bewijs
    genoeg, en zette daarmee elke uitleg die een woord aanhaalt bovenaan de
    stapel: «Omdat noć een vrouwelijk woord op een medeklinker is» is
    Nederlands met één Kroatisch woord erin, en dat is precies wat een
    Nederlandse uitleg hoort te zijn.
  */
  const nlAandeel = tokens.filter((t) => NL_STOPWOORDEN.has(t)).length / tokens.length;
  if (nlAandeel >= 0.2) return false;

  const herkend = tokens.filter((t) => FUNCTION_WORDS.has(t) || readingsFor(t).length).length;
  // Letters die het Nederlands niet kent, zijn bij de rest genoeg bewijs.
  if (/[čćšžđ]/i.test(regel) && nlAandeel === 0) return true;
  // Bij twee woorden is een aandeel geen bewijs: «Te voet» haalde de helft,
  // want «te» is óók een Kroatisch woord. Dan moeten ze allebei kloppen.
  if (tokens.length < 3) return herkend === tokens.length;
  return herkend / tokens.length >= 0.4;
}

/**
 * De velden waar Kroatisch in kán staan. Ruim genomen: wat er werkelijk in
 * staat, beslist `lijktKroatisch` hierboven.
 *
 * Eén uitzondering blijft hard: bij een verbeteroefening is `given` de zin mét
 * de fout. Die is met opzet fout en hoort niet nagekeken te worden.
 */
function kandidaten(e: Exercise): string[] {
  const uit: (string | undefined)[] = [e.answer, e.model_answer];
  if (e.type !== "error_correction") uit.push(e.given);
  return uit.filter((x): x is string => Boolean(x));
}

function nlVan(e: Exercise): string | undefined {
  if (e.type === "translate_nl_hr") return e.given ?? e.prompt_nl;
  if (e.type === "translate_hr_nl") return e.answer ?? e.prompt_nl;
  return e.prompt_nl;
}

/** Woorden in een zin die het platform niet thuis kan brengen. */
function onbekendeWoorden(hr: string): string[] {
  const uit: string[] = [];
  for (const ruw of hr.replace(/[*_]/g, "").split(/[^\p{L}\p{N}\-]+/u)) {
    const k = formKey(ruw);
    if (!k || /^\d/.test(k)) continue;
    if (FUNCTION_WORDS.has(k)) continue;
    if (readingsFor(k).length) continue;
    uit.push(ruw);
  }
  return [...new Set(uit)];
}

let cache: Zin[] | null = null;

/**
 * Alles wat nagekeken moet worden.
 *
 * Wat er níét in zit: de oefeningen die letterlijk uit het leerboek komen. Die
 * dragen een `source` als «udzbenik p.27» en zijn al door een uitgever en een
 * redactie gegaan. Die opnieuw laten nakijken kost de nakijker tijd die aan
 * mijn eigen zinnen besteed moet worden — en dat is de schaarse bron hier.
 */
export function alleZinnen(): Zin[] {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const gezien = new Set<string>();
  const uit: Zin[] = [];

  const voegToe = (hr: string | undefined, nl: string | undefined, herkomst: Herkomst, plek: string) => {
    if (!hr) return;
    /*
      Regel voor regel. De opmerkfase van een module zet zes of zeven
      voorbeelden onder elkaar in één veld; als één brok aangeboden is dat
      onnakijkbaar — de nakijker kan niet zeggen dát er iets mis is zonder te
      kunnen aanwijzen wáár. Los beoordeeld is elke regel een zin van vier
      woorden, en dat leest in seconden.
    */
    for (const regel of hr.split("\n")) {
      // Het keuzelabel hoort niet bij de zin. Zonder label valt «A: Idem u
      // kino» samen met dezelfde zin elders, en blijft «A: grad» over als het
      // losse woord dat het is — en dat is geen zin om na te kijken.
      const schoon = regel.trim().replace(/^[A-D]\s*[:.)]\s*/, "").replace(/\s+/g, " ");
      // Gaten, losse woorden en fragmenten zijn niet als zin te beoordelen.
      if (!schoon || /_{2,}/.test(schoon)) continue;
      if (schoon.split(" ").length < 2) continue;
      if (!lijktKroatisch(schoon)) continue;
      const hash = zinHash(schoon);
      if (gezien.has(hash)) continue;
      gezien.add(hash);
      uit.push({ hash, hr: schoon, nl: nl?.trim(), herkomst, plek, onbekend: onbekendeWoorden(schoon) });
    }
  };

  const uitOefening = (e: Exercise, herkomst: Herkomst, plek: string) => {
    for (const tekst of kandidaten(e)) voegToe(tekst, nlVan(e), herkomst, plek);
  };

  for (const m of loadModules()) {
    for (const e of moduleExercises(m)) uitOefening(e, "module", m.title_nl);
  }
  for (const les of loadLessons()) {
    for (const e of lessonExercises(les)) {
      if (e.source !== "aangevuld") continue;
      uitOefening(e, "les", `Les ${les.number} — ${les.title_nl}`);
    }
  }
  for (const verhaal of loadStories()) {
    for (const z of storySentences(verhaal)) voegToe(z.hr, z.nl, "verhaal", verhaal.title_nl);
    for (const e of verhaal.exercises) uitOefening(e, "verhaal", verhaal.title_nl);
  }

  cache = uit;
  return uit;
}

/**
 * De volgorde waarin nagekeken wordt.
 *
 * Niet willekeurig en niet op alfabet, maar op waar de kans op een fout het
 * grootst is: eerst de zinnen met woorden die het platform niet kent, daarna de
 * lange zinnen. Wie halverwege stopt — en iedereen stopt halverwege — heeft dan
 * het deel gehad dat het meest opleverde.
 */
function risico(z: Zin): number {
  return z.onbekend.length * 20 + z.hr.split(" ").length;
}

export interface Oordeel {
  status: ReviewStatus;
  correctie: string | null;
  opmerking: string | null;
}

export function oordelen(): Map<string, Oordeel> {
  const rijen = db.select().from(zinReview).all();
  return new Map(
    rijen.map((r) => [
      r.hash,
      { status: r.status as ReviewStatus, correctie: r.correctie, opmerking: r.opmerking },
    ]),
  );
}

export function volgendeBatch(grootte = 20): Zin[] {
  const gedaan = oordelen();
  return alleZinnen()
    .filter((z) => !gedaan.has(z.hash))
    .sort((a, b) => risico(b) - risico(a) || a.hash.localeCompare(b.hash))
    .slice(0, grootte);
}

export function bewaarOordeel(
  hash: string,
  hr: string,
  status: ReviewStatus,
  correctie?: string,
  opmerking?: string,
): void {
  const rij = {
    hash,
    hr,
    status,
    correctie: correctie?.trim() || null,
    opmerking: opmerking?.trim() || null,
    nagekekenOp: Date.now(),
  };
  db.insert(zinReview)
    .values(rij)
    .onConflictDoUpdate({ target: zinReview.hash, set: rij })
    .run();
}

export function verwijderOordeel(hash: string): void {
  db.delete(zinReview).where(eq(zinReview.hash, hash)).run();
}

export interface Stand {
  totaal: number;
  goedgekeurd: number;
  fout: number;
  twijfel: number;
  open: number;
  perHerkomst: { herkomst: Herkomst; totaal: number; nagekeken: number }[];
}

export function stand(): Stand {
  const zinnen = alleZinnen();
  const gedaan = oordelen();
  const tel = (s: ReviewStatus) => [...gedaan.values()].filter((o) => o.status === s).length;

  const perHerkomst = (["module", "les", "verhaal"] as Herkomst[]).map((h) => {
    const eigen = zinnen.filter((z) => z.herkomst === h);
    return {
      herkomst: h,
      totaal: eigen.length,
      nagekeken: eigen.filter((z) => gedaan.has(z.hash)).length,
    };
  });

  return {
    totaal: zinnen.length,
    goedgekeurd: tel("goedgekeurd"),
    fout: tel("fout"),
    twijfel: tel("twijfel"),
    open: zinnen.filter((z) => !gedaan.has(z.hash)).length,
    perHerkomst,
  };
}

/**
 * Wat er uit het nakijken gekomen is, klaar om in de contentbestanden te
 * verwerken. Zie `npm run nakijk-oogst`.
 *
 * Bewust géén automatische verwerking. Een correctie van een moedertaalspreker
 * is soms «dit woord moet anders» en soms «zo zegt niemand dat, herschrijf de
 * hele opgave», en dat verschil kan geen script zien. De oogst is een lijst om
 * te lezen, niet een knop om in te drukken.
 */
export function oogst(): { zin: Zin | undefined; hash: string; hr: string; oordeel: Oordeel }[] {
  const zinnen = new Map(alleZinnen().map((z) => [z.hash, z]));
  return db
    .select()
    .from(zinReview)
    .all()
    .filter((r) => r.status !== "goedgekeurd")
    .map((r) => ({
      hash: r.hash,
      hr: r.hr,
      zin: zinnen.get(r.hash),
      oordeel: {
        status: r.status as ReviewStatus,
        correctie: r.correctie,
        opmerking: r.opmerking,
      },
    }));
}
