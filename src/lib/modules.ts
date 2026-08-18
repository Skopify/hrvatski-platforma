import fs from "node:fs";
import path from "node:path";

import type { Exercise, GrammarPoint } from "./content";

/**
 * Een grammaticamodule: één punt, in zeven stappen doorlopen.
 *
 * Het verschil met een les is de vórm, niet de inhoud. Een les is een hoofdstuk
 * uit het boek en gaat over vijf dingen tegelijk. Een module gaat over één punt
 * en doorloopt altijd dezelfde weg: eerst kijken, dan de regel, dan de betekenis
 * interpreteren, dan geblokt oefenen, dan door elkaar, dan in lopende tekst.
 *
 * Die vaste vorm is het punt. De stap die in de meeste cursussen ontbreekt is de
 * derde: de betekenis kiezen zonder iets te hoeven produceren. Daar wordt de
 * koppeling tussen vorm en betekenis gelegd, en zonder die stap leer je de tabel
 * in plaats van de taal.
 */

export type PhaseKind =
  | "noticing"
  | "rule"
  | "interpretation"
  | "blocked"
  | "interleaved"
  | "context";

export interface ModulePhase {
  step: number;
  kind: PhaseKind;
  title_nl: string;
  /** Eén regel voor de leerder: waaróm deze stap er is. */
  why_nl: string;
  text_hr?: string;
  translation_nl?: string;
  exercises: Exercise[];
}

export interface GrammarModule {
  code: string;
  /**
   * Moeilijkheid, oplopend. Bewust een eigen getal en niet het CEFR-niveau:
   * dat is te grof (de helft staat op A2) en zegt niets over de voorkennis.
   * Deze volgorde respecteert de prerequisites — aspect vóór de verleden
   * tijd, verleden tijd vóór de clitica en de conditionalis.
   */
  rank: number;
  /** De groep waarin de module op het overzicht staat. */
  band: string;
  title_hr: string;
  title_nl: string;
  cefr: string;
  blurb_nl: string;
  prerequisites: string[];
  can_do_nl: string[];
  grammar: GrammarPoint;
  phases: ModulePhase[];
  source?: string;
}

const DIR = path.join(process.cwd(), "content", "modules");

let cache: GrammarModule[] | null = null;

/** Alle modules, van makkelijk naar moeilijk. */
export function modulesByRank(): GrammarModule[] {
  return [...loadModules()].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

/** De modules gegroepeerd per moeilijkheidsband, in volgorde. */
export function modulesByBand(): { band: string; modules: GrammarModule[] }[] {
  const out: { band: string; modules: GrammarModule[] }[] = [];
  for (const m of modulesByRank()) {
    const laatste = out[out.length - 1];
    if (laatste && laatste.band === m.band) laatste.modules.push(m);
    else out.push({ band: m.band, modules: [m] });
  }
  return out;
}

export function loadModules(): GrammarModule[] {
  // In ontwikkeling niet cachen: wie een module toevoegt, wil hem zien zonder
  // de server te herstarten. In productie wél, want dan verandert content niet.
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(DIR)) return (cache = []);
  cache = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) as GrammarModule);
  return cache;
}

export function loadModule(code: string): GrammarModule | undefined {
  return loadModules().find((m) => m.code.toLowerCase() === code.toLowerCase());
}

/** Alle oefeningen van een module, plat — voor de index en het nakijken. */
export function moduleExercises(m: GrammarModule): Exercise[] {
  return m.phases.flatMap((p) => p.exercises);
}

export function moduleStepCount(m: GrammarModule): number {
  return m.phases.reduce((n, p) => n + p.exercises.length + (p.text_hr ? 1 : 0), 0);
}
