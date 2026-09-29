import { eq, sql } from "drizzle-orm";
import { type Exercise } from "@/lib/content";
import { classifyError, recordError } from "@/lib/errors";
import { db } from "@/lib/db";
import { attemptTargets, attempts, profile } from "@/lib/db/schema";
import { type GradeResult } from "@/lib/grading";
import { ratingFor } from "@/lib/srs";
import { type Grade, Rating } from "ts-fsrs";

/**
 * Waar je in de escalatie staat.
 *
 *   correct     opgelost — op welke trede dan ook
 *   hint        eerste misser: een metalinguïstische aanwijzing, geen vorm
 *   choice      tweede misser: kiezen uit echte vormen van hetzelfde woord
 *   answer      derde misser: het antwoord met uitleg
 *   selfAssess  vrije productie; die kent geen tredes
 */
export type FeedbackStage = "correct" | "hint" | "choice" | "answer" | "selfAssess";

export interface Feedback {
  correct: boolean;
  nearMiss: boolean;
  verdict: GradeResult["verdict"];
  message: string;
  /**
   * Het juiste antwoord — leeg zolang de escalatie loopt.
   *
   * Dat is de kern van deze fase. Zolang hier iets in staat, staat het ook in de
   * netwerkrespons, en dan is de hint een formaliteit: je hoeft alleen maar te
   * kijken. Pas op trede 3 wordt dit gevuld.
   */
  expected: string;
  explain_nl?: string;
  xp: number;
  totalXp: number;
  stage: FeedbackStage;
  /** Trede 1: benoemt de categorie van de fout, nooit de vorm. */
  hint?: string;
  /** Trede 2: het juiste antwoord tussen plausibele afleiders. Leeg = overslaan. */
  options?: string[];
  /** Alleen bij vrije productie: de leerder beoordeelt zichzelf. */
  selfAssess?: { model_answer?: string; rubric_nl?: string[] };
  /**
   * Wat het programma zelf heeft kunnen vaststellen aan een geschreven antwoord.
   * Staat er ook `selfAssess` bij, dan is dit een hulpmiddel; staat het er niet
   * bij, dan is de opdracht hiermee nagekeken. Zie src/lib/freecheck.ts.
   */
  report?: import("@/lib/freecheck").FreeReport;
}

export type AnswerPayload =
  | { kind: "text"; value: string }
  | { kind: "choice"; value: string }
  | { kind: "match"; value: Record<string, string> }
  | { kind: "order"; value: string[] };

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function bumpStreak(): number {
  const row = db.select().from(profile).where(eq(profile.id, 1)).get();
  if (!row) return 0;
  const today = todayKey();
  if (row.lastStudyDate === today) return row.streakCurrent;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const next = row.lastStudyDate === todayKey(yesterday) ? row.streakCurrent + 1 : 1;

  db.update(profile)
    .set({
      lastStudyDate: today,
      streakCurrent: next,
      streakLongest: Math.max(next, row.streakLongest),
    })
    .where(eq(profile.id, 1))
    .run();
  return next;
}

export function addXp(amount: number): number {
  db.update(profile)
    .set({ xp: sql`${profile.xp} + ${amount}` })
    .where(eq(profile.id, 1))
    .run();
  return db.select({ xp: profile.xp }).from(profile).where(eq(profile.id, 1)).get()?.xp ?? 0;
}

export function record(
  exerciseId: string,
  lesson: number,
  type: string,
  mode: string,
  result: GradeResult,
  given: string,
  durationMs: number,
  xp: number,
  targets: string[],
  stage = 0,
): void {
  const inserted = db
    .insert(attempts)
    .values({
      exerciseId,
      lesson,
      type,
      mode,
      correct: result.correct ? 1 : 0,
      nearMiss: result.nearMiss ? 1 : 0,
      answerGiven: given,
      expected: result.expected,
      durationMs,
      xp,
      stage,
      createdAt: Date.now(),
    })
    .returning({ id: attempts.id })
    .get();

  for (const itemId of targets) {
    db.insert(attemptTargets).values({ attemptId: inserted.id, itemId }).run();
  }

  // Een fout wordt niet alleen geteld maar ontleed. Uitlegmomenten en het lezen
  // van een tekst vallen erbuiten: daar valt niets fout te doen.
  if (!result.correct && type !== "teaching_moment" && type !== "reading" && given) {
    const ctx = {
      exerciseId,
      type,
      targets,
      expected: result.expected,
      given,
      attemptId: inserted.id,
    };
    recordError(classifyError(ctx), ctx);
  }
}

/**
 * De FSRS-beoordeling, met de trede erin verwerkt.
 *
 * Een vorm die je pas uit drie opties herkent, ken je niet — herkennen is iets
 * anders dan oproepen. Daarom telt "goed na de keuze" als een misser voor de
 * planning, net als het antwoord krijgen. "Goed na de hint" is milder: je hebt
 * hem zelf opgeroepen, alleen met een duwtje.
 */
export function ratingForStage(
  result: GradeResult,
  exercise: Exercise,
  durationMs: number,
  stage: number,
): Grade {
  if (!result.correct) return Rating.Again;
  if (stage === 0) return ratingFor(result, exercise, durationMs);
  if (stage === 1) return Rating.Hard;
  return Rating.Again;
}

/**
 * Eerlijk schudden (Fisher-Yates).
 *
 * `sort(() => Math.random() - 0.5)` lijkt hetzelfde maar is het niet: een
 * vergelijkingsfunctie die geen consistente ordening geeft, laat elementen
 * gemiddeld dicht bij hun beginpositie liggen. In een drill betekent dat dat de
 * eerste woorden van de lijst structureel vaker langskomen dan de laatste.
 */
export function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
