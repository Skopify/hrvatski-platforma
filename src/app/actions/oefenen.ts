"use server";
import { antwoordtijd, binnen } from "@/lib/valideer";
import { eq } from "drizzle-orm";
import { findExercise } from "@/lib/content";
import { choicesFor, classifyError, hintFor, recordError } from "@/lib/errors";
import { checkFree } from "@/lib/freecheck";
import { db } from "@/lib/db";
import { beoordeel } from "@/lib/schrijven";
import { items, profile } from "@/lib/db/schema";
import { type GradeResult, gradeChoice, gradeMatch, gradeText, gradeWordOrder, xpFor } from "@/lib/grading";
import { applyReview, ensureCards, ratingFor } from "@/lib/srs";
import { type AnswerPayload, type Feedback, addXp, bumpStreak, ratingForStage, record } from "@/lib/leerlogboek";

/**
 * Een antwoord inleveren.
 *
 * `stage` is de trede waarop de leerder staat: 0 bij de eerste poging, 1 nadat
 * hij een hint kreeg, 2 nadat hij een keuze kreeg. De client houdt hem bij; de
 * server bepaalt wat er op die trede gedeeld mag worden.
 *
 * Bij een fout op trede 0 en 1 wordt er bewust géén poging weggeschreven en géén
 * herhaling ingepland. Een oefening telt één keer, op het moment dat hij is
 * opgelost — anders zou de accuratesse kelderen door het escaleren zelf, en zou
 * een woord drie keer als "fout" de planning in gaan terwijl je het uiteindelijk
 * gewoon wist. De missers zelf gaan wel het foutenlogboek in: dáár horen ze.
 */
export async function submitAnswer(
  exerciseId: string,
  payload: AnswerPayload,
  durationMs: number,
  stage = 0,
): Promise<Feedback> {
  durationMs = antwoordtijd(durationMs);
  stage = binnen(stage, 0, 10, 0);
  const found = findExercise(exerciseId);
  if (!found) throw new Error(`Onbekende oefening: ${exerciseId}`);
  const { exercise, lesson } = found;

  if (exercise.type === "free_production") {
    const geschreven = payload.kind === "text" ? payload.value : "";
    const report = checkFree(exercise, geschreven);

    // Is élk criterium mechanisch, dan hoeft er niets meer beoordeeld te worden:
    // het programma weet het antwoord al. Anders blijft het oordeel bij de
    // leerder, en zijn de controles hooguit een hulpmiddel.
    if (report.volledig) {
      return await selfAssess(exerciseId, report.geslaagd, geschreven, durationMs, report);
    }

    return {
      correct: true,
      nearMiss: false,
      verdict: "exact",
      message: "Vergelijk je antwoord met het model en beoordeel jezelf eerlijk.",
      expected: exercise.model_answer ?? "",
      xp: 0,
      totalXp: db.select({ xp: profile.xp }).from(profile).where(eq(profile.id, 1)).get()?.xp ?? 0,
      stage: "selfAssess",
      selfAssess: { model_answer: exercise.model_answer, rubric_nl: exercise.rubric_nl },
      report,
    };
  }

  let result: GradeResult;
  let given = "";
  switch (payload.kind) {
    case "choice":
      given = payload.value;
      result = gradeChoice(exercise, payload.value);
      break;
    case "match":
      given = Object.entries(payload.value)
        .map(([k, v]) => `${k}→${v}`)
        .join(", ");
      result = gradeMatch(exercise, payload.value);
      break;
    case "order":
      given = payload.value.join(" ");
      result = gradeWordOrder(exercise, payload.value);
      break;
    default:
      given = payload.value;
      result = gradeText(exercise, payload.value);
  }

  const targets = exercise.targets ?? [];
  const huidigeXp = () =>
    db.select({ xp: profile.xp }).from(profile).where(eq(profile.id, 1)).get()?.xp ?? 0;

  /* ── Nog niet opgelost: escaleren in plaats van het antwoord geven ── */
  if (!result.correct && stage < 2) {
    const ctx = {
      exerciseId,
      type: exercise.type,
      targets,
      expected: result.expected,
      given,
      nudge: exercise.nudge,
    };
    const ontleding = classifyError(ctx);
    recordError(ontleding, ctx);

    if (stage === 0) {
      return {
        correct: false,
        nearMiss: false,
        verdict: result.verdict,
        message: "Nog niet — kijk hier eens naar.",
        expected: "",
        xp: 0,
        totalXp: huidigeXp(),
        stage: "hint",
        hint: hintFor(ontleding),
      };
    }

    // Trede 2 heeft alleen zin met plausibele afleiders. Zijn die er niet — een
    // antwoord van meerdere woorden bijvoorbeeld — dan is een keuze uit
    // willekeurige woorden erger dan geen keuze, en gaan we door naar trede 3.
    const opties = choicesFor(ontleding, result.expected, given);
    if (opties.length >= 2) {
      return {
        correct: false,
        nearMiss: false,
        verdict: result.verdict,
        message: "Nog niet. Welke van deze vormen hoort hier?",
        expected: "",
        xp: 0,
        totalXp: huidigeXp(),
        stage: "choice",
        hint: hintFor(ontleding),
        options: opties,
      };
    }
  }

  /* ── Opgelost, of de escalatie is op: vastleggen en inplannen ── */
  const xp = xpFor(exercise, result, stage);
  const opgelostOp = result.correct ? stage : 3;

  record(
    exerciseId,
    lesson.number,
    exercise.type,
    exercise.mode ?? "receptive",
    result,
    given,
    durationMs,
    xp,
    targets,
    opgelostOp,
  );

  const kaarten = ensureCards(targets);
  const rating = ratingForStage(result, exercise, durationMs, stage);
  for (const kaartId of kaarten) applyReview(kaartId, rating, durationMs);

  bumpStreak();
  const totalXp = addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    verdict: result.verdict,
    message: result.correct ? result.message : "Nog niet. Dit was het antwoord.",
    expected: result.expected,
    explain_nl: exercise.explain_nl,
    xp,
    totalXp,
    stage: result.correct ? "correct" : "answer",
  };
}

/**
 * Vrije productie kan niet betrouwbaar automatisch nagekeken worden. In plaats van
 * te doen alsof, krijgt de leerder het modelantwoord plus de criteria en beoordeelt
 * hij zichzelf. Dat oordeel voedt de SRS net zo hard als een automatische score.
 */
export async function selfAssess(
  exerciseId: string,
  ok: boolean,
  answer: string,
  durationMs: number,
  /** Meegegeven wanneer het programma zelf heeft nagekeken. */
  report?: import("@/lib/freecheck").FreeReport,
): Promise<Feedback> {
  durationMs = antwoordtijd(durationMs);
  const found = findExercise(exerciseId);
  if (!found) throw new Error(`Onbekende oefening: ${exerciseId}`);
  const { exercise, lesson } = found;

  const result: GradeResult = {
    correct: ok,
    nearMiss: false,
    verdict: ok ? "exact" : "wrong",
    expected: exercise.model_answer ?? "",
    diffPositions: [],
    message: report
      ? ok
        ? "Nagekeken — alles waar het om ging staat erin."
        : "Nagekeken — er ontbreekt nog iets."
      : ok
        ? "Genoteerd."
        : "Genoteerd — dit item komt eerder terug.",
  };

  const xp = xpFor(exercise, result);
  const targets = exercise.targets ?? [];

  record(
    exerciseId,
    lesson.number,
    exercise.type,
    exercise.mode ?? "productive",
    result,
    answer,
    durationMs,
    xp,
    targets,
  );

  const kaarten = ensureCards(targets);
  const rating = ratingFor(result, exercise, durationMs);
  for (const kaartId of kaarten) applyReview(kaartId, rating, durationMs);

  bumpStreak();
  const totalXp = addXp(xp);

  // Zelfbeoordeling is altijd het eindpunt: er is niets meer om naartoe te
  // escaleren als de leerder zelf het oordeel geeft. Heeft het programma zelf
  // nagekeken, dan gaat de uitslag mee terug zodat je ziet waaróp.
  return {
    ...result,
    explain_nl: exercise.explain_nl,
    xp,
    totalXp,
    stage: "correct",
    report,
  };
}

/**
 * Een uitlegmoment: geen beoordeling, wel worden de betrokken items nu inplanbaar.
 * De poging wordt wél weggeschreven, anders zou de XP van vandaag achterlopen op
 * het profieltotaal. Statistieken over accuratesse filteren dit type eruit.
 */
export async function acknowledgeTeaching(exerciseId: string): Promise<{ totalXp: number }> {
  const found = findExercise(exerciseId);
  if (!found) return { totalXp: 0 };
  const { exercise, lesson } = found;

  record(
    exerciseId,
    lesson.number,
    "teaching_moment",
    "receptive",
    {
      correct: true,
      nearMiss: false,
      verdict: "exact",
      expected: "",
      diffPositions: [],
      message: "",
    },
    "",
    0,
    2,
    [],
  );

  ensureCards(exercise.targets ?? []);
  bumpStreak();
  return { totalXp: addXp(2) };
}
