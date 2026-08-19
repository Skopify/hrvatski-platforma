import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "./db";
import { schrijfwerk } from "./db/schema";
import { checkFree, type CheckUitkomst, type FreeCheck } from "./freecheck";
import { controleer, type Tekstbevindingen } from "./tekstcontrole";
import { highestActiveLesson } from "./stats";

/**
 * De schrijfsectie.
 *
 * De andere drie secties vragen je iets te herkennen of in te vullen; hier moet
 * je het zelf bedenken. Dat is de enige plek waar blijkt of je het Kroatisch
 * echt hebt of alleen kunt aanwijzen — en tegelijk de plek waar een programma
 * het minst kan oordelen.
 *
 * De oplossing is niet doen alsof. Wat mechanisch vast te stellen is, stelt het
 * programma vast: hoeveel zinnen, staat de verleden tijd erin, hoeveel woorden
 * in de locatief, welke woorden kent het platform niet, welk voorzetsel krijgt
 * de verkeerde naamval, staan er Servische vormen in. Dat is meer dan het
 * lijkt, en het is precies het soort fout waar een leerder alleen niet uitkomt.
 *
 * Wat een oordeel vraagt — klinkt dit natuurlijk, is dit een goed verhaal —
 * blijft bij jou, met het modelantwoord ernaast. Er is geen dienst die dat per
 * aanroep beoordeelt en die komt er ook niet.
 */

export type Soort = "zinnen" | "tekst" | "bericht" | "verhaal";

export interface Opdracht {
  id: string;
  rank: number;
  niveau: string;
  requires_lesson: number;
  soort: Soort;
  titel_nl: string;
  opdracht_nl: string;
  motief?: string;
  hulp_nl: string[];
  model_nl: string;
  rubriek_nl: string[];
  checks: FreeCheck[];
  auto_check: boolean;
}

let cache: Opdracht[] | null = null;

export function loadOpdrachten(): Opdracht[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const bestand = path.join(process.cwd(), "content", "schrijven", "opdrachten.json");
  const raw = JSON.parse(fs.readFileSync(bestand, "utf8")) as { opdrachten: Opdracht[] };
  cache = raw.opdrachten.slice().sort((a, b) => a.rank - b.rank);
  return cache;
}

export function loadOpdracht(id: string): Opdracht | undefined {
  return loadOpdrachten().find((o) => o.id === id);
}

export const SOORT_LABEL: Record<Soort, string> = {
  zinnen: "Losse zinnen",
  tekst: "Korte tekst",
  bericht: "Bericht",
  verhaal: "Eigen verhaal",
};

/* -------------------------------------------------------------- opslag --- */

export interface Werk {
  opdracht: string;
  tekst: string;
  klaar: boolean;
  woorden: number;
  bijgewerkt: number;
  afgerond: number | null;
}

export function werkVoor(id: string): Werk | undefined {
  const rij = db.select().from(schrijfwerk).where(eq(schrijfwerk.opdracht, id)).get();
  if (!rij) return undefined;
  return { ...rij, klaar: rij.klaar === 1 };
}

export function alleWerk(): Map<string, Werk> {
  return new Map(
    db
      .select()
      .from(schrijfwerk)
      .all()
      .map((r) => [r.opdracht, { ...r, klaar: r.klaar === 1 }]),
  );
}

export function telWoorden(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length;
}

export function bewaarWerk(id: string, tekst: string, klaar: boolean): void {
  const nu = Date.now();
  const bestaand = werkVoor(id);
  const rij = {
    opdracht: id,
    tekst,
    klaar: klaar ? 1 : 0,
    woorden: telWoorden(tekst),
    bijgewerkt: nu,
    // Wanneer het af verklaard is, blijft staan; opnieuw opslaan verzet dat niet.
    afgerond: klaar ? (bestaand?.afgerond ?? nu) : null,
  };
  db.insert(schrijfwerk).values(rij).onConflictDoUpdate({ target: schrijfwerk.opdracht, set: rij }).run();
}

/* ------------------------------------------------------------ nakijken --- */

export interface Schrijfoordeel {
  /** De criteria die het programma kan vaststellen. */
  checks: CheckUitkomst[];
  /** Dekken die álle criteria? Zo niet, dan beslis jij of het af is. */
  volledig: boolean;
  /** Alle mechanische criteria gehaald. */
  geslaagd: boolean;
  /** Spelling, naamvallen, servismen. */
  taal: Tekstbevindingen;
  woorden: number;
  zinnen: number;
  alineas: number;
}

export function beoordeel(opdracht: Opdracht, tekst: string): Schrijfoordeel {
  // checkFree werkt op een Exercise; de velden die het gebruikt zijn dezelfde.
  const rapport = checkFree(
    { id: opdracht.id, type: "free_production", prompt_nl: "", checks: opdracht.checks, auto_check: opdracht.auto_check },
    tekst,
  );

  return {
    checks: rapport.checks,
    volledig: rapport.volledig,
    geslaagd: rapport.geslaagd,
    taal: controleer(tekst),
    woorden: telWoorden(tekst),
    zinnen: tekst.split(/[.!?]+/).filter((z) => z.trim().length > 1).length,
    alineas: tekst.split(/\n\s*\n/).filter((p) => p.trim()).length,
  };
}

/* -------------------------------------------------------------- overzicht --- */

export interface OpdrachtStand extends Opdracht {
  /** Ligt deze opdracht voorbij waar je in de lessen bent? */
  voorbij: boolean;
  /** Hoe ver de leerder is, voor de melding erbij. */
  huidigeLes: number;
  werk?: Werk;
}

/**
 * De lijst met opdrachten, met per stuk of hij bij je niveau past.
 *
 * Niet op slot. Dat was de eerste opzet — een opdracht ging pas open als je de
 * bijbehorende les had gehad — en daarmee stond de hele sectie dicht, ook de
 * eerste opdracht van drie zinnen over jezelf.
 *
 * Bij lezen is een slot verdedigbaar: een tekst waarvan je een derde niet kent,
 * is niet moeilijk maar zinloos. Bij schrijven ligt dat anders. Je kunt een
 * schrijfopdracht niet verliezen. Wie het te moeilijk vindt, merkt dat en komt
 * terug — en wie meer kan dan de lessen laten zien, hoeft daar niet op te
 * wachten. Dus: een melding erbij, geen muur ervoor.
 */
export function opdrachtenMetStand(): OpdrachtStand[] {
  const werk = alleWerk();
  const huidigeLes = highestActiveLesson();
  return loadOpdrachten().map((o) => ({
    ...o,
    voorbij: o.requires_lesson > huidigeLes,
    huidigeLes,
    werk: werk.get(o.id),
  }));
}
