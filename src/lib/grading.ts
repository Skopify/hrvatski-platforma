import type { Exercise } from "./content";

export type Verdict = "exact" | "diacritic" | "typo" | "wrong";

export interface GradeResult {
  correct: boolean;
  /** Goed gerekend, maar met een kanttekening — telt zwaarder in de SRS. */
  nearMiss: boolean;
  verdict: Verdict;
  expected: string;
  /** Posities in het verwachte antwoord waar de leerder afweek (voor markering). */
  diffPositions: number[];
  message: string;
}

const DIACRITICS: Record<string, string> = {
  č: "c", ć: "c", š: "s", ž: "z", đ: "d",
  Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "D",
};

export function stripDiacritics(s: string): string {
  return s.replace(/[čćšžđČĆŠŽĐ]/g, (m) => DIACRITICS[m] ?? m);
}

/**
 * Normaliseert voor vergelijking: unicode-normalisatie, kleine letters, witruimte
 * samengetrokken, en leestekens aan het eind weg. Interpunctie binnen de zin
 * blijft staan — een ontbrekende komma is geen fout die we willen straffen, maar
 * we willen ook geen "Ja sam student" gelijkstellen aan "Ja, sam student!".
 */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[„""'']/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s*([,;:])\s*/g, "$1 ")
    .replace(/[.!?…]+\s*$/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function diffPositions(expected: string, given: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (expected[i]?.toLowerCase() !== given[i]?.toLowerCase()) out.push(i);
  }
  return out;
}

/**
 * De beoordelingsladder. Bewust drie treden in plaats van goed/fout:
 *
 *   exact      — precies goed
 *   diacritic  — alleen č/ć/š/ž/đ mis. Goed gerekend, maar aangemerkt: het is de
 *                fout die Nederlandstaligen structureel maken, en als je hem
 *                wegpoetst leer je hem nooit af.
 *   typo       — één tekenafstand van goed. Goed gerekend, wel aangemerkt.
 *   wrong      — fout.
 *
 * diacritic en typo geven FSRS-rating "Hard" in plaats van "Good", zodat het item
 * eerder terugkomt zonder als volledige fout te tellen.
 */
export function gradeText(exercise: Exercise, given: string): GradeResult {
  const candidates = exercise.accepts?.length
    ? exercise.accepts
    : exercise.answer
      ? [exercise.answer]
      : [];

  const primary = exercise.answer ?? candidates[0] ?? "";
  const g = normalize(given);

  if (!g) {
    return {
      correct: false,
      nearMiss: false,
      verdict: "wrong",
      expected: primary,
      diffPositions: [],
      message: "Er is nog niets ingevuld.",
    };
  }

  for (const c of candidates) {
    if (normalize(c) === g) {
      return {
        correct: true,
        nearMiss: false,
        verdict: "exact",
        expected: c,
        diffPositions: [],
        message: "Točno!",
      };
    }
  }

  for (const c of candidates) {
    if (stripDiacritics(normalize(c)) === stripDiacritics(g)) {
      return {
        correct: true,
        nearMiss: true,
        verdict: "diacritic",
        expected: c,
        diffPositions: diffPositions(c, given),
        message:
          "Goed — maar let op de diakritische tekens. In het Kroatisch zijn č, ć, š, ž en đ eigen letters, geen versiering: ze veranderen de betekenis.",
      };
    }
  }

  for (const c of candidates) {
    const n = normalize(c);
    if (n.length > 4 && levenshtein(n, g) === 1) {
      return {
        correct: true,
        nearMiss: true,
        verdict: "typo",
        expected: c,
        diffPositions: diffPositions(c, given),
        message: "Goed — er zat één tikfout in.",
      };
    }
  }

  return {
    correct: false,
    nearMiss: false,
    verdict: "wrong",
    expected: primary,
    diffPositions: diffPositions(primary, given),
    message: "Nog niet.",
  };
}

export function gradeChoice(exercise: Exercise, chosen: string): GradeResult {
  const correct = normalize(chosen) === normalize(exercise.answer ?? "");
  return {
    correct,
    nearMiss: false,
    verdict: correct ? "exact" : "wrong",
    expected: exercise.answer ?? "",
    diffPositions: [],
    message: correct ? "Točno!" : "Nog niet.",
  };
}

export function gradeMatch(exercise: Exercise, mapping: Record<string, string>): GradeResult {
  const pairs = exercise.pairs ?? [];
  const wrong = pairs.filter((p) => normalize(mapping[p.hr] ?? "") !== normalize(p.nl));
  const correct = wrong.length === 0;
  return {
    correct,
    nearMiss: false,
    verdict: correct ? "exact" : "wrong",
    expected: pairs.map((p) => `${p.hr} — ${p.nl}`).join(" · "),
    diffPositions: [],
    message: correct
      ? "Alles goed gekoppeld."
      : `${wrong.length} van de ${pairs.length} nog niet goed.`,
  };
}

export function gradeWordOrder(exercise: Exercise, tokens: string[]): GradeResult {
  return gradeText(exercise, tokens.join(" "));
}

/* ------------------------------------------------------------------- XP --- */

/**
 * Productief oefenen levert ruim het dubbele op van receptief. Dat is geen
 * willekeurige knop: herkennen is aantoonbaar makkelijker dan produceren, en een
 * XP-systeem dat dat verschil wegpoetst beloont precies het gedrag waarop
 * Duolingo-achtige apps stukloopt.
 */
export function xpFor(exercise: Exercise, result: GradeResult): number {
  if (exercise.type === "teaching_moment") return 2;
  const base = exercise.mode === "productive" ? 10 : 4;
  const difficulty = exercise.difficulty ?? 1;
  const multiplier = 1 + (difficulty - 1) * 0.25;
  if (!result.correct) return 1; // inspanningscrediet — fout maken is ook leren
  const earned = Math.round(base * multiplier);
  return result.nearMiss ? Math.round(earned * 0.7) : earned;
}
