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
import { highestActiveLesson } from "@/lib/stats";
import { db } from "@/lib/db";
import type { DrillFeedback, DrillKind, DrillQuestion } from "@/lib/drills";
import { brojAccepts, brojHr } from "@/lib/numbers";
import {
  attempts,
  attemptTargets,
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
import { applyReview, ensureCards, ratingFor } from "@/lib/srs";

export interface Feedback {
  correct: boolean;
  nearMiss: boolean;
  verdict: GradeResult["verdict"];
  message: string;
  expected: string;
  explain_nl?: string;
  xp: number;
  totalXp: number;
  /** Alleen bij vrije productie: de leerder beoordeelt zichzelf. */
  selfAssess?: { model_answer?: string; rubric_nl?: string[] };
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
      createdAt: Date.now(),
    })
    .returning({ id: attempts.id })
    .get();

  for (const itemId of targets) {
    db.insert(attemptTargets).values({ attemptId: inserted.id, itemId }).run();
  }
}

export async function submitAnswer(
  exerciseId: string,
  payload: AnswerPayload,
  durationMs: number,
): Promise<Feedback> {
  const found = findExercise(exerciseId);
  if (!found) throw new Error(`Onbekende oefening: ${exerciseId}`);
  const { exercise, lesson } = found;

  if (exercise.type === "free_production") {
    return {
      correct: true,
      nearMiss: false,
      verdict: "exact",
      message: "Vergelijk je antwoord met het model en beoordeel jezelf eerlijk.",
      expected: exercise.model_answer ?? "",
      xp: 0,
      totalXp: db.select({ xp: profile.xp }).from(profile).where(eq(profile.id, 1)).get()?.xp ?? 0,
      selfAssess: { model_answer: exercise.model_answer, rubric_nl: exercise.rubric_nl },
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

  const xp = xpFor(exercise, result);
  const targets = exercise.targets ?? [];

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
  );

  ensureCards(targets);
  const rating = ratingFor(result, exercise, durationMs);
  for (const itemId of targets) applyReview(itemId, rating, durationMs);

  bumpStreak();
  const totalXp = addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    verdict: result.verdict,
    message: result.message,
    expected: result.expected,
    explain_nl: exercise.explain_nl,
    xp,
    totalXp,
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
    message: ok ? "Genoteerd." : "Genoteerd — dit item komt eerder terug.",
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

  ensureCards(targets);
  const rating = ratingFor(result, exercise, durationMs);
  for (const itemId of targets) applyReview(itemId, rating, durationMs);

  bumpStreak();
  const totalXp = addXp(xp);

  return { ...result, explain_nl: exercise.explain_nl, xp, totalXp };
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
    ensureCards(targets);
    const rating = ratingFor(result, fake, durationMs);
    for (const t of targets) applyReview(t, rating, durationMs);
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

  const already = db.select({ id: srs.itemId }).from(srs).where(eq(srs.itemId, itemId)).get();
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

export async function completeLesson(lesson: number): Promise<void> {
  db.insert(lessonProgress)
    .values({ lesson, status: "done", sectionsDone: [], completedAt: Date.now() })
    .onConflictDoUpdate({
      target: lessonProgress.lesson,
      set: { status: "done", completedAt: Date.now() },
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
