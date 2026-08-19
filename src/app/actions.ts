"use server";

import { eq, sql } from "drizzle-orm";

import {
  findExercise,
  loadCaseUsage,
  loadStory,
  type Exercise,
  type VocabEntry,
} from "@/lib/content";
import { recordStoryEncounters } from "@/lib/coverage";
import { choicesFor, classifyError, hintFor, recordError } from "@/lib/errors";
import { checkFree } from "@/lib/freecheck";
import { highestActiveLesson } from "@/lib/stats";
import { db } from "@/lib/db";
import type { DrillFeedback, DrillKind, DrillQuestion } from "@/lib/drills";
import { brojAccepts, brojHr } from "@/lib/numbers";
import {
  bewaarOordeel,
  stand,
  verwijderOordeel,
  volgendeBatch,
  type ReviewStatus,
  type Stand,
  type Zin,
} from "@/lib/nakijken";
import { resetProgress } from "@/lib/progress-reset";
import {
  beoordeel,
  bewaarWerk,
  loadOpdracht,
  type Schrijfoordeel,
} from "@/lib/schrijven";
import {
  attempts,
  attemptTargets,
  card,
  items,
  lessonProgress,
  profile,
  srs,
  storyProgress,
  studySessions,
} from "@/lib/db/schema";
import {
  gradeChoice,
  gradeMatch,
  gradeText,
  gradeWordOrder,
  xpFor,
  type GradeResult,
} from "@/lib/grading";
import { applyReview, dueCards, ensureCards, newCards, ratingFor } from "@/lib/srs";
import {
  checkLeech,
  promoteIfReady,
  questionFor,
  restore,
  type StageQuestion,
} from "@/lib/stages";
import { Rating, type Grade } from "ts-fsrs";

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

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bumpStreak(): number {
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

function addXp(amount: number): number {
  db.update(profile)
    .set({ xp: sql`${profile.xp} + ${amount}` })
    .where(eq(profile.id, 1))
    .run();
  return db.select({ xp: profile.xp }).from(profile).where(eq(profile.id, 1)).get()?.xp ?? 0;
}

function record(
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
 * De FSRS-beoordeling, met de trede erin verwerkt.
 *
 * Een vorm die je pas uit drie opties herkent, ken je niet — herkennen is iets
 * anders dan oproepen. Daarom telt "goed na de keuze" als een misser voor de
 * planning, net als het antwoord krijgen. "Goed na de hint" is milder: je hebt
 * hem zelf opgeroepen, alleen met een duwtje.
 */
function ratingForStage(
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

/* ------------------------------------------------------------------ drills --- */

/**
 * Eerlijk schudden (Fisher-Yates).
 *
 * `sort(() => Math.random() - 0.5)` lijkt hetzelfde maar is het niet: een
 * vergelijkingsfunctie die geen consistente ordening geeft, laat elementen
 * gemiddeld dicht bij hun beginpositie liggen. In een drill betekent dat dat de
 * eerste woorden van de lijst structureel vaker langskomen dan de laatste.
 */
function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Kandidaatwoorden voor een drill: alleen woorden van jouw niveau (lessen die
 * open zijn of af), zodat een drill nooit toekomstige stof verklapt.
 */
function drillPool(kind: DrillKind): { id: string; lesson: number; v: VocabEntry }[] {
  const maxLesson = db
    .select({ lesson: lessonProgress.lesson })
    .from(lessonProgress)
    .where(sql`${lessonProgress.status} in ('done', 'in_progress', 'available')`)
    .all()
    .reduce((n, r) => Math.max(n, r.lesson), 1);

  const rows = db
    .select({ id: items.id, lesson: items.lesson, payload: items.payload })
    .from(items)
    .where(sql`${items.kind} = 'vocab' and ${items.lesson} <= ${maxLesson}`)
    .all();

  return rows
    .map((r) => ({ id: r.id, lesson: r.lesson, v: r.payload as VocabEntry }))
    .filter(({ v }) => {
      switch (kind) {
        case "rod":
          return v.pos === "noun" && !!v.gender;
        case "genitiv":
          return v.pos === "noun" && !!v.gen_sg && v.gen_sg !== v.hr;
        case "mnozina":
          return v.pos === "noun" && !!v.nom_pl && v.nom_pl !== v.hr;
        case "glagol":
          return v.pos === "verb" && !!v.present_1sg && v.present_1sg !== v.hr;
        case "diktat":
          return /[čćđšž]/i.test(v.hr) && !v.hr.includes(" ");
        default:
          return false;
      }
    });
}

const GENDER_LABEL: Record<string, string> = { m: "muški", f: "ženski", n: "srednji" };

/** Een portie vragen, geschud, zonder antwoorden. */
export async function drillBatch(kind: DrillKind, count = 12): Promise<DrillQuestion[]> {
  if (kind === "oblik") {
    // Gelijk verdeeld over de naamvallen. Zomaar trekken uit de hele bak zou de
    // drill laten scheefgroeien naar wat er het meest van is; per naamval een
    // even groot deel trekken houdt alle zeven in beeld.
    //
    // Het trekken gebeurt in SQL. Er zijn duizenden vormkaarten, en die alleen
    // maar inladen om er twaalf van te houden kost meer dan de hele drill waard
    // is. De filters horen dus in de query:
    //   json_extract(...form) != ...lemma  — sluit "žaba → nominatief enkelvoud"
    //   uit, waar het antwoord al in de vraag staat.
    const maxLesson = highestActiveLesson();
    const topics = db
      .select({ topic: items.topic })
      .from(items)
      .where(sql`${items.kind} = 'form' and ${items.lesson} <= ${maxLesson}`)
      .groupBy(items.topic)
      .all()
      .map((r) => r.topic);
    if (topics.length === 0) return [];

    const perTopic = Math.max(1, Math.ceil(count / topics.length));
    const picked: DrillQuestion[] = [];
    for (const topic of shuffled(topics)) {
      const rows = db
        .select({ id: items.id, payload: items.payload })
        .from(items)
        .where(
          sql`${items.kind} = 'form' and ${items.lesson} <= ${maxLesson}
              and ${items.topic} = ${topic}
              and json_extract(${items.payload}, '$.form')
                  != json_extract(${items.payload}, '$.lemma')`,
        )
        .orderBy(sql`random()`)
        .limit(perTopic)
        .all();
      for (const r of rows) {
        const p = r.payload as { lemma: string; description: string };
        picked.push({ ref: r.id, prompt: p.lemma, sub: p.description });
      }
    }
    return shuffled(picked).slice(0, count);
  }

  if (kind === "padezi") {
    const usage = loadCaseUsage();
    const maxLesson = highestActiveLesson();
    // Alleen zinnen waarvan de naamval al is geïntroduceerd; de keuzelijst groeit
    // dus mee met je niveau in plaats van meteen zeven opties te tonen.
    const available = usage.items.filter((i) => i.lesson <= Math.max(maxLesson, 5));
    const cases = usage.cases.filter((c) => c.lesson <= Math.max(maxLesson, 5));
    if (available.length === 0 || cases.length < 2) return [];

    const labels = cases.map((c) => c.label);
    return shuffled(available)
      .slice(0, count)
      .map((i) => ({
        ref: i.id,
        prompt: i.sentence_hr,
        sub: i.sentence_nl,
        focus: i.focus,
        audio: i.sentence_hr,
        choices: labels,
      }));
  }

  if (kind === "brojevi") {
    // Elke portie mengt makkelijk (0-20) en samengesteld (21-100).
    const seen = new Set<number>();
    const out: DrillQuestion[] = [];
    while (out.length < count && seen.size < 100) {
      const n =
        out.length % 3 === 2
          ? 21 + Math.floor(Math.random() * 80)
          : Math.floor(Math.random() * 21);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push({ ref: String(n), prompt: String(n) });
    }
    return out;
  }

  const pool = shuffled(drillPool(kind)).slice(0, count);
  return pool.map(({ id, v }) => {
    switch (kind) {
      case "rod":
      case "genitiv":
      case "mnozina":
      case "glagol":
        return { ref: id, prompt: v.hr, sub: v.nl };
      default:
        // diktat: het woord gaat alleen als audio mee, de vertaling volgt pas
        // in de feedback zodat het oor het werk doet.
        return { ref: id, prompt: "", audio: v.hr };
    }
  });
}

/** Nakijken + attempt + SRS. `ref` is het item-id (of het getal bij brojevi). */
export async function submitDrill(
  kind: DrillKind,
  ref: string,
  answer: string,
  durationMs: number,
): Promise<DrillFeedback> {
  let expected: string;
  let accepts: string[];
  let nl = "";
  let targets: string[] = [];
  let lesson = 0;
  let mode: "receptive" | "productive" = "productive";
  let explain: string | undefined;

  if (kind === "oblik") {
    const row = db.select().from(items).where(eq(items.id, ref)).get();
    if (!row) throw new Error(`Onbekende vorm: ${ref}`);
    const p = row.payload as { lemma: string; form: string; description: string };
    expected = p.form;
    accepts = [expected];
    lesson = row.lesson;
    targets = [ref];
    explain = `${p.description} van ${p.lemma}.`;
  } else if (kind === "padezi") {
    const usage = loadCaseUsage();
    const item = usage.items.find((i) => i.id === ref);
    if (!item) throw new Error(`Onbekende zin: ${ref}`);
    expected = usage.cases.find((c) => c.key === item.case)?.label ?? item.case;
    accepts = [expected];
    lesson = item.lesson;
    mode = "receptive";
    // De uitleg ís hier het leerpunt, dus die reist mee terug naar de client.
    explain = item.contrast_nl ? `${item.why_nl} ${item.contrast_nl}` : item.why_nl;
  } else if (kind === "brojevi") {
    const n = Number(ref);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error(`Ongeldig getal: ${ref}`);
    expected = brojHr(n);
    accepts = brojAccepts(n);
    lesson = n <= 10 ? 0 : 17;
  } else {
    const row = db.select().from(items).where(eq(items.id, ref)).get();
    if (!row) throw new Error(`Onbekend item: ${ref}`);
    const v = row.payload as VocabEntry;
    lesson = row.lesson;
    nl = v.nl;
    targets = [ref];

    switch (kind) {
      case "rod":
        expected = GENDER_LABEL[v.gender ?? ""] ?? "";
        accepts = [expected];
        mode = "receptive";
        break;
      case "genitiv": {
        expected = v.gen_sg!;
        accepts = [expected];
        // De geseedde vormkaart bestaat voor leswoorden — die is het echte doel.
        const formId = `f.${ref.replace(/^v\.[^.]+\./, "")}.gen.sg`;
        if (db.select({ id: items.id }).from(items).where(eq(items.id, formId)).get()) {
          targets = [formId, ref];
        }
        break;
      }
      case "mnozina": {
        expected = v.nom_pl!;
        accepts = [expected];
        const formId = `f.${ref.replace(/^v\.[^.]+\./, "")}.nom.pl`;
        if (db.select({ id: items.id }).from(items).where(eq(items.id, formId)).get()) {
          targets = [formId, ref];
        }
        break;
      }
      case "glagol":
        // Bij wederkerende werkwoorden staat se in de brondata mee ("vratim se").
        // Zonder se ook goed rekenen: de vervoeging is wat hier geoefend wordt.
        expected = v.present_1sg!;
        accepts = [expected, expected.replace(/\s+se$/, "")];
        break;
      default:
        expected = v.hr;
        accepts = [expected];
    }
  }

  // Dezelfde beoordelingsladder als de lessen: exact / diakritisch / tikfout.
  const fake = {
    id: `drill.${kind}.${ref}`,
    type: "cloze",
    prompt_nl: "",
    answer: expected,
    accepts,
    mode,
    difficulty: 1,
  } as Exercise;

  const result =
    kind === "rod" || kind === "padezi" ? gradeChoice(fake, answer) : gradeText(fake, answer);
  // Drills zijn korter en kaler dan lesoefeningen; zelfde ladder, lagere koers —
  // anders wordt drillen de goedkoopste weg naar XP en zegt het totaal niets meer.
  const xp = Math.max(1, Math.round(xpFor(fake, result) * 0.6));

  record(fake.id, lesson, `drill_${kind}`, mode, result, answer, durationMs, xp, targets);
  if (targets.length) {
    const kaarten = ensureCards(targets);
    const rating = ratingFor(result, fake, durationMs);
    for (const kaartId of kaarten) applyReview(kaartId, rating, durationMs);
  }
  bumpStreak();
  addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    message: result.message,
    expected: nl && kind === "diktat" ? `${expected} — ${nl}` : expected,
    xp,
    explain,
  };
}

/* ---------------------------------------------------------------- verhalen --- */

/**
 * Een opgezocht woord in de herhaling zetten.
 *
 * Dit is bewust een aparte handeling en geen bijwerking van het aantikken: een
 * woord waar je even naar kijkt is iets anders dan een woord dat je wilt leren.
 * Pas als je hier op drukt, krijgt het een FSRS-kaart.
 */
export async function collectWord(slug: string, itemId: string): Promise<{ added: boolean }> {
  const exists = db.select({ id: items.id }).from(items).where(eq(items.id, itemId)).get();
  if (!exists) return { added: false };

  // Had dit woord al een kaart? Zo ja, dan is het geen nieuwe aanwinst maar een
  // woord dat je nog eens opzoekt — dat verdient geen "toegevoegd"-melding.
  const already = db
    .select({ id: card.id })
    .from(card)
    .innerJoin(srs, eq(srs.cardId, card.id))
    .where(eq(card.itemId, itemId))
    .get();
  ensureCards([itemId]);

  db.insert(storyProgress)
    .values({ slug, lookups: 1 })
    .onConflictDoUpdate({
      target: storyProgress.slug,
      set: { lookups: sql`${storyProgress.lookups} + 1` },
    })
    .run();

  return { added: !already };
}

/**
 * Een verhaal als gelezen markeren. Levert eenmalig XP op — lezen is werk, maar
 * hetzelfde verhaal tien keer openen is dat niet.
 */
export async function markStoryRead(
  slug: string,
): Promise<{ xp: number; first: boolean; encountered: number }> {
  const row = db.select().from(storyProgress).where(eq(storyProgress.slug, slug)).get();
  const first = !row?.readAt;

  db.insert(storyProgress)
    .values({ slug, readAt: Date.now() })
    .onConflictDoUpdate({ target: storyProgress.slug, set: { readAt: Date.now() } })
    .run();

  // Elke keer lezen is één blootstelling — ook een herlezing telt, want juist
  // herhaald tegenkomen is wat een woord laat beklijven.
  const story = loadStory(slug);
  const encountered = story ? recordStoryEncounters(story) : 0;

  if (!first) return { xp: 0, first: false, encountered };

  const xp = 20;
  record(
    `story:${slug}`,
    0,
    "story_read",
    "receptive",
    { correct: true, nearMiss: false, verdict: "exact", expected: "", diffPositions: [], message: "" },
    "",
    0,
    xp,
    [],
  );
  bumpStreak();
  addXp(xp);
  return { xp, first: true, encountered };
}

export async function markStoryQuizDone(slug: string): Promise<void> {
  db.insert(storyProgress)
    .values({ slug, quizDoneAt: Date.now() })
    .onConflictDoUpdate({ target: storyProgress.slug, set: { quizDoneAt: Date.now() } })
    .run();
}

export async function startSession(kind: string, lesson: number | null): Promise<number> {
  const row = db
    .insert(studySessions)
    .values({ kind, lesson, startedAt: Date.now() })
    .returning({ id: studySessions.id })
    .get();
  if (kind === "lesson" && lesson !== null) await markLessonStarted(lesson);
  return row.id;
}

export async function endSession(
  sessionId: number,
  stats: { xp: number; correct: number; total: number },
): Promise<void> {
  db.update(studySessions)
    .set({ endedAt: Date.now(), xp: stats.xp, correct: stats.correct, total: stats.total })
    .where(eq(studySessions.id, sessionId))
    .run();
}

/**
 * Onthoudt dat deze stap gehad is, zodat "Les hervatten" verdergaat in plaats
 * van opnieuw te beginnen.
 *
 * Er wordt een lijst met oefening-id's bijgehouden en geen positie in de rij.
 * Dat is met opzet: de laatste sectie van een les mengt er vervallen items van
 * vroeger doorheen, en welke dat zijn hangt af van je herhaalplanning. Die rij
 * ziet er morgen dus anders uit, en een opgeslagen index zou je dan midden in
 * iets anders laten landen.
 */
export async function markStepDone(lesson: number, exerciseId: string): Promise<void> {
  const row = db.select().from(lessonProgress).where(eq(lessonProgress.lesson, lesson)).get();
  if (!row || row.status === "done") return;

  const done = new Set((row.sectionsDone as string[] | null) ?? []);
  if (done.has(exerciseId)) return;
  done.add(exerciseId);

  db.update(lessonProgress)
    .set({ sectionsDone: [...done] })
    .where(eq(lessonProgress.lesson, lesson))
    .run();
}

export async function completeLesson(lesson: number): Promise<void> {
  // sectionsDone leegmaken: de les is af, dus wie hem opnieuw doet begint
  // vooraan in plaats van meteen op het eindscherm te belanden.
  db.insert(lessonProgress)
    .values({ lesson, status: "done", sectionsDone: [], completedAt: Date.now() })
    .onConflictDoUpdate({
      target: lessonProgress.lesson,
      set: { status: "done", sectionsDone: [], completedAt: Date.now() },
    })
    .run();

  // Volgende les openzetten als die bestaat.
  const next = db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.lesson, lesson + 1))
    .get();
  if (next && next.status === "locked") {
    db.update(lessonProgress)
      .set({ status: "available" })
      .where(eq(lessonProgress.lesson, lesson + 1))
      .run();
  }
}

export async function markLessonStarted(lesson: number): Promise<void> {
  const row = db.select().from(lessonProgress).where(eq(lessonProgress.lesson, lesson)).get();
  if (!row || row.status === "done") return;
  db.update(lessonProgress)
    .set({ status: "in_progress", startedAt: row.startedAt ?? Date.now() })
    .where(eq(lessonProgress.lesson, lesson))
    .run();
}

/* -------------------------------------------------------------- opnieuw --- */

/**
 * Alle voortgang wissen.
 *
 * Er wordt eerst een kopie van de database weggeschreven; zie
 * src/lib/progress-reset.ts voor wat er precies verdwijnt en wat blijft staan.
 * Het bevestigingswoord komt van de client mee zodat één misklik nooit genoeg
 * is — de knop alleen kan de sessiegeschiedenis van maanden niet wissen.
 */
export async function resetAllProgress(
  confirmation: string,
): Promise<{ ok: boolean; backup?: string; message: string }> {
  if (confirmation.trim().toUpperCase() !== "RESET") {
    return { ok: false, message: "Bevestiging klopt niet — er is niets gewist." };
  }
  const { backup } = resetProgress();
  return {
    ok: true,
    backup,
    message: `Voortgang gewist. Er staat een kopie in ${backup}.`,
  };
}

/* ------------------------------------------------------ woordenschat --- */

/**
 * De woordenschatsessie: herhalingen eerst, dan een gedoseerde portie nieuw.
 *
 * De cap op nieuw materiaal is geen versiering. §8 noemt overbelasting de
 * belangrijkste reden dat SRS-systemen sneuvelen: zonder rem groeit de
 * herhaalschuld sneller dan je hem inloopt, en dan stopt iemand ermee. Daarom
 * krijgen herhalingen voorrang en staat er een dagplafond op nieuw.
 */
export async function vocabQueue(
  limit = 20,
  nieuwPerDag = 8,
): Promise<{ questions: StageQuestion[]; due: number; nieuw: number }> {
  const vervallen = dueCards(new Date(), limit);
  const ruimte = Math.max(0, limit - vervallen.length);
  const verse = ruimte > 0 ? newCards(Math.min(ruimte, nieuwPerDag)) : [];

  const questions: StageQuestion[] = [];
  for (const kaart of [...vervallen, ...verse]) {
    const vraag = questionFor(kaart.cardId);
    // Een kaart zonder vraag hoort niet in de sessie. Dat kan gebeuren bij een
    // clozekaart waarvan de bronzin uit de content is verdwenen.
    if (vraag) questions.push(vraag);
  }

  return { questions, due: vervallen.length, nieuw: verse.length };
}

export interface VocabFeedback {
  correct: boolean;
  nearMiss: boolean;
  message: string;
  expected: string;
  xp: number;
  /** Naar welk stadium dit woord is doorgeschoven, als dat gebeurde. */
  promoted?: string;
  /** Waar is dit woord uit de rotatie gehaald wegens te veel missers. */
  leech?: boolean;
}

export async function submitVocab(
  cardId: number,
  answer: string,
  durationMs: number,
): Promise<VocabFeedback> {
  const vraag = questionFor(cardId);
  if (!vraag) throw new Error(`Onbekende kaart: ${cardId}`);

  const fake = {
    id: `vocab.${cardId}`,
    type: "cloze",
    prompt_nl: vraag.prompt,
    answer: vraag.answer,
    accepts: vraag.accepts,
    mode: vraag.mode,
    difficulty: 1,
  } as Exercise;

  const result = gradeText(fake, answer);
  const xp = xpFor(fake, result);

  record(
    fake.id,
    0,
    `vocab_${vraag.kind.toLowerCase()}`,
    vraag.mode,
    result,
    answer,
    durationMs,
    xp,
    [vraag.itemId],
  );

  const rating = ratingFor(result, fake, durationMs, `vocab_${vraag.kind.toLowerCase()}`);
  applyReview(cardId, rating, durationMs);

  // Volgorde telt: eerst kijken of dit een leech werd, want een geschorste kaart
  // hoort niet ook nog gepromoveerd te worden.
  const leech = checkLeech(cardId);
  const promoted = leech ? null : promoteIfReady(cardId);

  bumpStreak();
  addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    message: result.message,
    expected: vraag.answer,
    xp,
    promoted: promoted ?? undefined,
    leech: leech || undefined,
  };
}

/** Een woord dat uit de rotatie was, terugzetten met een schone lei. */
export async function restoreLeech(cardId: number): Promise<void> {
  restore(cardId);
}

/* ------------------------------------------------------- plaatsingstoets --- */

export interface PlacementModuleBlock {
  code: string;
  title: string;
  rank: number;
  probes: import("@/lib/placement").GrammarProbe[];
}

export interface PlacementPlan {
  runId: number;
  modules: PlacementModuleBlock[];
  bands: { n: number; label: string; probes: import("@/lib/placement").VocabProbe[] }[];
  startBand: number;
}

/**
 * De toets klaarzetten.
 *
 * Alles wordt in één keer meegegeven, ook de banden die je misschien nooit te
 * zien krijgt. Dat is geen verspilling maar een keuze: de adaptieve stappen
 * gebeuren in de browser, zodat er tussen twee vragen geen wachttijd zit. Bij
 * een toets is dat belangrijker dan bij een oefening — wachten nodigt uit tot
 * nadenken, en dan meet je iets anders dan wat je wilde meten.
 */
export async function beginPlacement(scope?: string): Promise<PlacementPlan> {
  const P = await import("@/lib/placement");
  const { modulesByRank, loadModule } = await import("@/lib/modules");

  const lijst = scope ? [loadModule(scope)].filter(Boolean) : modulesByRank();
  const runId = P.startRun(scope ? "module" : "volledig", scope);

  return {
    runId,
    modules: lijst.map((m) => ({
      code: m!.code,
      title: m!.title_nl,
      rank: m!.rank,
      probes: P.grammarProbes(m!),
    })),
    // Bij een hertoets van één module blijft de woordenschat buiten beschouwing.
    bands: scope
      ? []
      : P.vocabBands().map((b) => ({ n: b.n, label: b.label, probes: P.vocabProbes(b) })),
    startBand: P.START_BAND,
  };
}

export async function answerPlacementGrammar(
  runId: number,
  moduleCode: string,
  exerciseId: string,
  correct: boolean,
  durationMs: number,
): Promise<void> {
  const P = await import("@/lib/placement");
  P.recordGrammar(runId, moduleCode, exerciseId, correct, durationMs);
}

export async function answerPlacementVocab(
  runId: number,
  band: number,
  itemId: string,
  correct: boolean,
  durationMs: number,
): Promise<void> {
  const P = await import("@/lib/placement");
  P.recordVocab(runId, band, itemId, correct, durationMs);
}

export async function endPlacement(
  runId: number,
): Promise<import("@/lib/placement").PlacementResult> {
  const P = await import("@/lib/placement");
  return P.finishRun(runId);
}

/** Een module terugzetten op ongemeten — de weg terug uit "beheerst". */
export async function clearPlacement(code: string): Promise<void> {
  const P = await import("@/lib/placement");
  P.clearModuleStatus(code);
}

/* ------------------------------------------------ voortgang per module --- */

/**
 * Vastleggen dat deze stap gehad is, vóór het doorschakelen.
 *
 * Spiegelbeeld van `markStepDone` voor lessen. Zonder dit begon een module na
 * het sluiten van het tabblad weer bij stap één — inclusief de uitleg die je al
 * gelezen had, en dat is precies waar iemand afhaakt.
 */
export async function markModuleStepDone(code: string, exerciseId: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  const row = db.select().from(moduleProgress).where(eq(moduleProgress.code, code)).get();

  if (!row) {
    db.insert(moduleProgress)
      .values({ code, stepsDone: [exerciseId], startedAt: Date.now(), completedAt: null })
      .run();
    return;
  }
  if (row.completedAt) {
    // Opnieuw begonnen na afronden: de teller loopt van voren af aan.
    db.update(moduleProgress)
      .set({ stepsDone: [exerciseId], startedAt: Date.now(), completedAt: null })
      .where(eq(moduleProgress.code, code))
      .run();
    return;
  }

  const done = new Set((row.stepsDone as string[] | null) ?? []);
  if (done.has(exerciseId)) return;
  done.add(exerciseId);
  db.update(moduleProgress)
    .set({ stepsDone: [...done] })
    .where(eq(moduleProgress.code, code))
    .run();
}

/** De module is uit. De stappenlijst wordt geleegd, zodat opnieuw ook echt opnieuw is. */
export async function completeModule(code: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  db.insert(moduleProgress)
    .values({ code, stepsDone: [], startedAt: Date.now(), completedAt: Date.now() })
    .onConflictDoUpdate({
      target: moduleProgress.code,
      set: { stepsDone: [], completedAt: Date.now() },
    })
    .run();
}

/** Opnieuw beginnen bij stap één, zonder de module af te ronden. */
export async function restartModule(code: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  db.insert(moduleProgress)
    .values({ code, stepsDone: [], startedAt: Date.now(), completedAt: null })
    .onConflictDoUpdate({
      target: moduleProgress.code,
      set: { stepsDone: [], startedAt: Date.now(), completedAt: null },
    })
    .run();
}

/* ---------------------------------------------------------------- nakijken --- */

/**
 * Eén oordeel van de nakijker vastleggen.
 *
 * Schrijft naar `zin_review` en verder nergens heen. De content blijft staan
 * zoals ze staat, ook als de nakijker zegt dat er iets fout is — een correctie
 * is soms «dit woord moet anders» en soms «zo zegt niemand dat», en dat
 * verschil kan geen automaat wegen. `npm run nakijk-oogst` legt de oordelen
 * naast de contentbestanden zodat ik ze met de hand verwerk.
 */
export async function bewaarNakijkOordeel(
  hash: string,
  hr: string,
  status: ReviewStatus,
  correctie?: string,
  opmerking?: string,
): Promise<void> {
  bewaarOordeel(hash, hr, status, correctie, opmerking);
}

/** Een oordeel terugdraaien — de nakijker die zich vergist heeft. */
export async function wisNakijkOordeel(hash: string): Promise<void> {
  verwijderOordeel(hash);
}

/** De volgende stapel, nadat de vorige af is. */
export async function volgendeNakijkBatch(grootte = 20): Promise<{ zinnen: Zin[]; stand: Stand }> {
  return { zinnen: volgendeBatch(grootte), stand: stand() };
}

/* --------------------------------------------------------------- schrijven --- */

export async function bewaarSchrijfwerk(id: string, tekst: string, klaar: boolean): Promise<void> {
  bewaarWerk(id, tekst, klaar);
}

/**
 * Nakijken wat na te kijken is.
 *
 * Draait op de server omdat de vormcatalogus daar staat: vijfduizend vormen
 * meesturen naar de browser om drie spelfouten te vinden is de verkeerde ruil.
 */
export async function beoordeelSchrijfwerk(id: string, tekst: string): Promise<Schrijfoordeel> {
  const opdracht = loadOpdracht(id);
  if (!opdracht) throw new Error(`Onbekende schrijfopdracht: ${id}`);
  return beoordeel(opdracht, tekst);
}
