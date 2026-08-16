import fs from "node:fs";
import path from "node:path";

/**
 * Een eigen rem op het tekenverbruik.
 *
 * ── Waarom dit bestaat terwijl F0 al gratis is ─────────────────────────────
 * De gratis prijsklasse van Azure kán niet in rekening worden gebracht: raakt
 * het maandquotum op, dan geeft Azure een 429 en stopt het. Er is geen meter
 * die daarna doorloopt.
 *
 * Toch staat deze rem er, om twee redenen. Ten eerste ga je 429-fouten pas
 * merken als je luisteroefening stil blijft, en dat is een rotmoment om erachter
 * te komen. Ten tweede is de enige manier waarop dit ooit geld kan kosten dat de
 * prijsklasse van de dienst verandert — en dan wil je een grens in je eigen code
 * hebben staan, niet alleen bij de leverancier.
 *
 * De rem ligt op 400.000 tekens per maand: 80% van de gratis 500.000. Alle
 * lesteksten, verhalen en oefeningen samen zijn ongeveer 60.000 tekens, en elke
 * zin wordt maar één keer opgehaald. In de praktijk kom je hier niet in de buurt.
 *
 * Boven de grens wordt er niets meer bij Azure opgehaald en valt alles terug op
 * de stem van je systeem — precies zoals wanneer er geen sleutel zou zijn.
 */

/** 80% van de gratis maandruimte. Bewust geen 100%: een marge is het punt. */
export const MONTHLY_LIMIT = 400_000;

const FILE = path.join(process.cwd(), "data", "azure-verbruik.json");

interface Usage {
  /** Maand als "2026-08", zodat het vanzelf reset. */
  month: string;
  characters: number;
  requests: number;
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function read(): Usage {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8")) as Usage;
    if (raw.month === thisMonth()) return raw;
  } catch {
    // Geen bestand of onleesbaar: dan begint deze maand op nul.
  }
  return { month: thisMonth(), characters: 0, requests: 0 };
}

function write(u: Usage): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(u, null, 2));
}

/** Past dit er nog binnen deze maand? */
export function withinBudget(chars: number): boolean {
  return read().characters + chars <= MONTHLY_LIMIT;
}

/** Boeken wat er daadwerkelijk naar Azure is gegaan — dus ná een cachemisser. */
export function recordUsage(chars: number): void {
  const u = read();
  write({ month: u.month, characters: u.characters + chars, requests: u.requests + 1 });
}

export function usage(): Usage & { limit: number; share: number } {
  const u = read();
  return { ...u, limit: MONTHLY_LIMIT, share: u.characters / MONTHLY_LIMIT };
}
