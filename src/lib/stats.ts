import { and, desc, eq, gte, sql } from "drizzle-orm";
import { State } from "ts-fsrs";

import { findExercise, loadCaseUsage } from "./content";
import { db } from "./db";
import {
  attempts,
  attemptTargets,
  card,
  defaultCardJoin,
  items,
  lessonProgress,
  moduleProgress,
  profile,
  srs,
  storyProgress,
  studySessions,
} from "./db/schema";
import { retrievability, type SrsRow } from "./srs";

/* --------------------------------------------------------------- profiel --- */

export interface Rank {
  code: string;
  label: string;
  from: number;
  to: number | null;
  /**
   * Richtlijn begeleide lesuren om dit niveau te bereiken, cumulatief.
   *
   * Deze getallen komen uit de gangbare CEFR-schattingen (A1 ±100 uur, A2 ±200,
   * B1 ±400) en staan er bewust naast de XP. XP meet wat je gedaan hebt binnen
   * dit platform; uren meten hoeveel werk een niveau werkelijk kost. Dat tweede
   * getal is ontnuchterend, en juist daarom eerlijk: geen app levert die uren
   * in zijn eentje.
   */
  hours: number;
}

/**
 * Rangen volgen het CEFR-pad van de bron (A1 → A2+ → B1). XP is een
 * inspanningsmaat, geen vaardigheidsmaat — daarom staat naast de rang altijd
 * hoeveel je daadwerkelijk beheerst.
 */
export const RANKS: Rank[] = [
  { code: "A1.1", label: "Eerste woorden", from: 0, to: 1200, hours: 50 },
  { code: "A1.2", label: "Basiszinnen", from: 1200, to: 3500, hours: 100 },
  { code: "A2.1", label: "Naamvallen in gebruik", from: 3500, to: 7500, hours: 150 },
  { code: "A2.2", label: "Zelfstandig in alledaagse situaties", from: 7500, to: 14000, hours: 200 },
  { code: "B1", label: "Drempelniveau", from: 14000, to: null, hours: 400 },
];

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  const idx = Math.max(
    0,
    RANKS.findLastIndex((r) => xp >= r.from),
  );
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const span = (rank.to ?? xp) - rank.from || 1;
  const progress = next ? Math.min(1, (xp - rank.from) / span) : 1;
  return { rank, next, progress };
}

export function getProfile() {
  return db.select().from(profile).where(eq(profile.id, 1)).get()!;
}

/* ------------------------------------------------------------ beheersing --- */

export interface TopicMastery {
  topic: string;
  itemCount: number;
  seen: number;
  /** Gemiddelde geschatte retentie over geziene items (0-1). */
  mastery: number;
  attempts: number;
  correct: number;
  accuracy: number;
}

export function topicMastery(): TopicMastery[] {
  const rows = db
    .select({
      id: items.id,
      topic: items.topic,
      due: srs.due,
      stability: srs.stability,
      difficulty: srs.difficulty,
      elapsedDays: srs.elapsedDays,
      scheduledDays: srs.scheduledDays,
      reps: srs.reps,
      lapses: srs.lapses,
      state: srs.state,
      learningSteps: srs.learningSteps,
      lastReview: srs.lastReview,
    })
    .from(items)
    .leftJoin(card, defaultCardJoin)
    .leftJoin(srs, eq(srs.cardId, card.id))
    .all();

  const acc = db
    .select({
      topic: items.topic,
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(${attempts.correct})`,
    })
    .from(attemptTargets)
    .innerJoin(attempts, eq(attempts.id, attemptTargets.attemptId))
    .innerJoin(items, eq(items.id, attemptTargets.itemId))
    .groupBy(items.topic)
    .all();

  const accMap = new Map(acc.map((a) => [a.topic, a]));
  const grouped = new Map<string, { count: number; seen: number; sum: number }>();
  const now = new Date();

  for (const r of rows) {
    const g = grouped.get(r.topic) ?? { count: 0, seen: 0, sum: 0 };
    g.count++;
    if (r.state !== null && r.state !== State.New && r.due !== null) {
      g.seen++;
      g.sum += retrievability(
        {
          itemId: r.id,
          due: r.due,
          stability: r.stability ?? 0,
          difficulty: r.difficulty ?? 0,
          elapsedDays: r.elapsedDays ?? 0,
          scheduledDays: r.scheduledDays ?? 0,
          reps: r.reps ?? 0,
          lapses: r.lapses ?? 0,
          state: r.state ?? 0,
          learningSteps: r.learningSteps ?? 0,
          lastReview: r.lastReview,
        } as SrsRow,
        now,
      );
    }
    grouped.set(r.topic, g);
  }

  return [...grouped.entries()]
    .map(([topic, g]) => {
      const a = accMap.get(topic);
      const total = Number(a?.total ?? 0);
      const correct = Number(a?.correct ?? 0);
      return {
        topic,
        itemCount: g.count,
        seen: g.seen,
        mastery: g.seen ? g.sum / g.seen : 0,
        attempts: total,
        correct,
        accuracy: total ? correct / total : 0,
      };
    })
    .sort((a, b) => b.itemCount - a.itemCount);
}

/**
 * Onderwerpen waar het misgaat — minimaal 4 pogingen en onder de drempel.
 *
 * De drempel is er bewust: een lijst "zwakke punten" waarin alles op 100% staat is
 * geen diagnose maar een opsomming. Staat er niets in, dan is dat het antwoord.
 */
export function weakPoints(minAttempts = 4, limit = 6, threshold = 0.9): TopicMastery[] {
  return topicMastery()
    .filter((t) => t.attempts >= minAttempts && t.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

/* -------------------------------------------------------------- tijdlijn --- */

export interface DayStat {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
  xp: number;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyStats(days = 30): DayStat[] {
  const since = Date.now() - days * 86400000;
  const rows = db
    .select({
      createdAt: attempts.createdAt,
      correct: attempts.correct,
      xp: attempts.xp,
      type: attempts.type,
    })
    .from(attempts)
    .where(gte(attempts.createdAt, since))
    .all();

  const map = new Map<string, DayStat>();
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(Date.now() - i * 86400000);
    map.set(key, { date: key, attempts: 0, correct: 0, accuracy: 0, xp: 0 });
  }
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    const d = map.get(key);
    if (!d) continue;
    // XP telt altijd mee; uitlegmomenten tellen niet mee voor accuratesse — anders
    // meet je vooral hoe vaak je op "Begrepen" hebt geklikt.
    d.xp += r.xp;
    if (r.type === "teaching_moment") continue;
    d.attempts++;
    d.correct += r.correct;
  }
  for (const d of map.values()) d.accuracy = d.attempts ? d.correct / d.attempts : 0;
  return [...map.values()];
}

/** Woordenschat: gezien versus stevig (stabiliteit ≥ 21 dagen). */
export function vocabStats() {
  const rows = db
    .select({ state: srs.state, stability: srs.stability })
    .from(items)
    .leftJoin(card, defaultCardJoin)
    .leftJoin(srs, eq(srs.cardId, card.id))
    .where(eq(items.kind, "vocab"))
    .all();

  const total = rows.length;
  const seen = rows.filter((r) => r.state !== null && r.state !== State.New).length;
  const solid = rows.filter((r) => (r.stability ?? 0) >= 21).length;
  return { total, seen, solid };
}

/** Groei van de woordenschat over tijd: eerste aanraking per vocab-item per dag. */
export function vocabGrowth(days = 30): { date: string; total: number }[] {
  const rows = db
    .select({ itemId: attemptTargets.itemId, createdAt: attempts.createdAt })
    .from(attemptTargets)
    .innerJoin(attempts, eq(attempts.id, attemptTargets.attemptId))
    .innerJoin(items, eq(items.id, attemptTargets.itemId))
    .where(eq(items.kind, "vocab"))
    .orderBy(attempts.createdAt)
    .all();

  const first = new Map<string, number>();
  for (const r of rows) if (!first.has(r.itemId)) first.set(r.itemId, r.createdAt);

  const out: { date: string; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const cutoff = Date.now() - i * 86400000;
    const key = dayKey(cutoff);
    const endOfDay = new Date(cutoff);
    endOfDay.setHours(23, 59, 59, 999);
    out.push({
      date: key,
      total: [...first.values()].filter((t) => t <= endOfDay.getTime()).length,
    });
  }
  return out;
}

/** Tijd besteed per dag, in minuten, uit de sessieduur. */
/** Alles boven een uur is een tabblad dat open bleef staan, geen studietijd. */
const SESSION_CAP_MS = 3600000;

/**
 * De duur van elke sessie in minuten, in dezelfde volgorde als de invoer.
 *
 * Een sessie krijgt pas een eindtijd als je op Stoppen drukt. Wie een drill
 * verlaat door weg te navigeren — de normale manier om te stoppen — liet zijn
 * tijd volledig verdampen: dertien antwoorden en nul minuten. Dat holt juist de
 * urenteller uit, en dat is de eerlijkste maat die het platform heeft.
 *
 * Voor een openstaande sessie geldt daarom het laatste antwoord als eindtijd.
 * Het venster loopt tot de vólgende sessie begint: zonder die grens zou een
 * vergeten sessie de antwoorden van alles wat erna kwam opslokken.
 */
function sessionDurations(
  sessions: { startedAt: number; endedAt: number | null }[],
  attemptTimes: number[],
): number[] {
  const order = sessions
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => a.startedAt - b.startedAt);
  const out = new Array<number>(sessions.length).fill(0);

  order.forEach((s, n) => {
    let end = s.endedAt;
    if (!end) {
      const next = order[n + 1]?.startedAt ?? Infinity;
      const until = Math.min(s.startedAt + SESSION_CAP_MS, next);
      for (const t of attemptTimes) {
        if (t >= s.startedAt && t < until && (end === null || t > end)) end = t;
      }
    }
    out[s.i] = end ? Math.min(SESSION_CAP_MS, end - s.startedAt) / 60000 : 0;
  });
  return out;
}

function attemptTimes(since?: number): number[] {
  const q = db.select({ createdAt: attempts.createdAt }).from(attempts);
  const rows = since ? q.where(gte(attempts.createdAt, since)).all() : q.all();
  return rows.map((r) => r.createdAt);
}

export function timeSpent(days = 30): { date: string; minutes: number }[] {
  const since = Date.now() - days * 86400000;
  const rows = db
    .select({ startedAt: studySessions.startedAt, endedAt: studySessions.endedAt })
    .from(studySessions)
    .where(gte(studySessions.startedAt, since))
    .all();
  const durations = sessionDurations(rows, attemptTimes(since));

  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) map.set(dayKey(Date.now() - i * 86400000), 0);
  rows.forEach((r, i) => {
    const key = dayKey(r.startedAt);
    if (!map.has(key)) return;
    map.set(key, (map.get(key) ?? 0) + durations[i]!);
  });
  return [...map.entries()].map(([date, minutes]) => ({ date, minutes }));
}

export function totalMinutes(): number {
  const rows = db
    .select({ startedAt: studySessions.startedAt, endedAt: studySessions.endedAt })
    .from(studySessions)
    .all();
  return sessionDurations(rows, attemptTimes()).reduce((n, m) => n + m, 0);
}

/** Hoeveel items er de komende dagen vervallen — de werkdruk vooruit. */
export function dueForecast(days = 14): { date: string; count: number }[] {
  const rows = db.select({ due: srs.due, state: srs.state }).from(srs).all();
  const out: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(23, 59, 59, 999);
    const prev = new Date();
    prev.setDate(prev.getDate() + i - 1);
    prev.setHours(23, 59, 59, 999);
    const count = rows.filter(
      (r) => r.state !== State.New && r.due <= d.getTime() && (i === 0 || r.due > prev.getTime()),
    ).length;
    out.push({ date: dayKey(d.getTime()), count });
  }
  return out;
}

export function recentAttempts(limit = 12) {
  return db.select().from(attempts).orderBy(desc(attempts.createdAt)).limit(limit).all();
}

export function overallAccuracy(): { total: number; correct: number; accuracy: number } {
  const row = db
    .select({
      total: sql<number>`count(*)`,
      correct: sql<number>`coalesce(sum(${attempts.correct}), 0)`,
    })
    .from(attempts)
    .where(sql`${attempts.type} != 'teaching_moment'`)
    .get();
  const total = Number(row?.total ?? 0);
  const correct = Number(row?.correct ?? 0);
  return { total, correct, accuracy: total ? correct / total : 0 };
}

/**
 * Bijna-goed-antwoorden: goed gerekend, maar met een diakritische fout of tikfout.
 * Apart bijgehouden omdat het weglaten van č/ć/š/ž/đ dé systematische fout van een
 * Nederlandstalige is — als je die in de accuratesse wegmiddelt, zie je hem nooit.
 */
export function nearMissStats(): { total: number; nearMiss: number; share: number } {
  const row = db
    .select({
      total: sql<number>`count(*)`,
      near: sql<number>`coalesce(sum(${attempts.nearMiss}), 0)`,
    })
    .from(attempts)
    .where(sql`${attempts.correct} = 1 and ${attempts.type} != 'teaching_moment'`)
    .get();
  const total = Number(row?.total ?? 0);
  const nearMiss = Number(row?.near ?? 0);
  return { total, nearMiss, share: total ? nearMiss / total : 0 };
}

export function productiveShare(): number {
  const row = db
    .select({
      total: sql<number>`count(*)`,
      productive: sql<number>`sum(case when ${attempts.mode} = 'productive' then 1 else 0 end)`,
    })
    .from(attempts)
    .where(sql`${attempts.type} != 'teaching_moment'`)
    .get();
  const total = Number(row?.total ?? 0);
  return total ? Number(row?.productive ?? 0) / total : 0;
}

export function lessonStatuses() {
  return db.select().from(lessonProgress).all();
}

/** De oefeningen die je in deze les al gehad hebt — de basis voor hervatten. */
export function stepsDoneIn(lesson: number): Set<string> {
  const row = db
    .select({ done: lessonProgress.sectionsDone, status: lessonProgress.status })
    .from(lessonProgress)
    .where(eq(lessonProgress.lesson, lesson))
    .get();
  if (!row || row.status === "done") return new Set();
  return new Set((row.done as string[] | null) ?? []);
}

/**
 * De stappen die je in deze module al gehad hebt — de basis voor hervatten.
 *
 * Een afgeronde module geeft een lege verzameling terug: wie hem opnieuw start,
 * begint vooraan en niet op het eindscherm.
 */
export function stepsDoneInModule(code: string): Set<string> {
  const row = db
    .select({ done: moduleProgress.stepsDone, completedAt: moduleProgress.completedAt })
    .from(moduleProgress)
    .where(eq(moduleProgress.code, code))
    .get();
  if (!row || row.completedAt) return new Set();
  return new Set((row.done as string[] | null) ?? []);
}

export interface ModuleVoortgang {
  /** Stappen gedaan in de lopende doorloop. Nul zodra de module af is. */
  gedaan: number;
  /** Wanneer de module voor het laatst is uitgespeeld, of null. */
  afgerondOp: number | null;
}

/** Voortgang per module, voor het overzicht. */
export function moduleProgressMap(): Map<string, ModuleVoortgang> {
  return new Map(
    db
      .select({
        code: moduleProgress.code,
        done: moduleProgress.stepsDone,
        completedAt: moduleProgress.completedAt,
      })
      .from(moduleProgress)
      .all()
      .map((r) => [
        r.code,
        {
          gedaan: r.completedAt ? 0 : ((r.done as string[] | null) ?? []).length,
          afgerondOp: r.completedAt,
        },
      ]),
  );
}

/** Leesvoortgang per verhaal, als map op slug. */
export function storyStatuses(): Map<
  string,
  { readAt: number | null; quizDoneAt: number | null; lookups: number }
> {
  const rows = db.select().from(storyProgress).all();
  return new Map(
    rows.map((r) => [r.slug, { readAt: r.readAt, quizDoneAt: r.quizDoneAt, lookups: r.lookups }]),
  );
}

export interface ErrorPattern {
  id: string;
  title: string;
  /** Wat er structureel misgaat, in één zin. */
  diagnosis: string;
  /** Wat je eraan doet. */
  advice: string;
  count: number;
  /** Waar dit uit blijkt: een paar echte voorbeelden uit je eigen antwoorden. */
  examples: { given: string; expected: string }[];
  /** Naar welke drill of pagina dit verwijst. */
  href?: string;
}

/**
 * Foutpatronen.
 *
 * Het verschil met de foutenlijst: die is een inventaris, dit is een diagnose.
 * Eén keer «srednji» antwoorden waar «ženski» hoort is een vergissing; het tien
 * keer doen is een patroon, en dat vraagt iets anders dan nog een keer proberen.
 *
 * Alle patronen hier worden uit de bestaande pogingen afgeleid — er wordt niets
 * bijgehouden wat er niet al stond.
 */
export function errorPatterns(minCount = 3): ErrorPattern[] {
  const rows = db
    .select({
      exerciseId: attempts.exerciseId,
      type: attempts.type,
      given: attempts.answerGiven,
      expected: attempts.expected,
      correct: attempts.correct,
      nearMiss: attempts.nearMiss,
    })
    .from(attempts)
    .where(sql`${attempts.type} != 'teaching_moment'`)
    .all();

  const out: ErrorPattern[] = [];
  const sample = (f: (typeof rows)[number][]) =>
    f.slice(0, 3).map((r) => ({ given: r.given ?? "", expected: r.expected ?? "" }));

  /* 1. Diakritische tekens weglaten — de structurele fout van een Nederlandstalige. */
  const diacritic = rows.filter((r) => r.correct === 1 && r.nearMiss === 1);
  if (diacritic.length >= minCount) {
    out.push({
      id: "diakritisch",
      title: "Je laat diakritische tekens weg",
      diagnosis: `${diacritic.length} keer was je antwoord goed op één teken na — meestal een č, ć, š, ž of đ.`,
      advice:
        "Deze antwoorden zijn goedgekeurd, dus je merkt het zelf niet. Het dictee traint precies dit: horen en meteen het juiste teken typen.",
      count: diacritic.length,
      examples: sample(diacritic),
      href: "/oefenen/drill/diktat",
    });
  }

  /* 2. Verkeerde naamval gekozen — welke verwart je met welke? */
  const caseErrors = rows.filter((r) => r.type === "drill_padezi" && r.correct === 0);
  if (caseErrors.length >= minCount) {
    const pairs = new Map<string, number>();
    for (const r of caseErrors) pairs.set(`${r.given} → ${r.expected}`, (pairs.get(`${r.given} → ${r.expected}`) ?? 0) + 1);
    const worst = [...pairs.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "naamvalkeuze",
      title: "Je kiest de verkeerde naamval",
      diagnosis: `${caseErrors.length} keer misgegaan; het vaakst koos je ${worst[0]} (${worst[1]}×).`,
      advice:
        "Dit gaat niet over uitgangen maar over betekenis: richting tegenover plaats, ontvanger tegenover lijdend voorwerp. De naamvalkeuze-drill zet die contrasten telkens naast elkaar.",
      count: caseErrors.length,
      examples: sample(caseErrors),
      href: "/oefenen/drill/padezi",
    });
  }

  /* 3. Wel de juiste naamval, maar de verkeerde uitgang. */
  const formErrors = rows.filter((r) => r.type === "drill_oblik" && r.correct === 0);
  if (formErrors.length >= minCount) {
    out.push({
      id: "vormen",
      title: "De juiste naamval, de verkeerde vorm",
      diagnosis: `${formErrors.length} keer zat de uitgang ernaast bij het produceren van een naamvalsvorm.`,
      advice:
        "Let op de plekken waar de stam verandert: sibilarisatie (k/g/h → c/z/s vóór -i) en de vluchtige a. De genitief verraadt de stam; ken je die, dan volgt de rest.",
      count: formErrors.length,
      examples: sample(formErrors),
      href: "/oefenen/drill/oblik",
    });
  }

  /* 4. Geslacht — de fout die alles erna besmet. */
  const genderErrors = rows.filter((r) => r.type === "drill_rod" && r.correct === 0);
  if (genderErrors.length >= minCount) {
    out.push({
      id: "geslacht",
      title: "Het geslacht zit nog niet vast",
      diagnosis: `${genderErrors.length} keer het verkeerde geslacht gekozen.`,
      advice:
        "Dit is de duurste fout van allemaal: het geslacht bepaalt élke verbuiging erna, dus één misser hier maakt een hele zin fout. Leer het geslacht altijd samen met het woord.",
      count: genderErrors.length,
      examples: sample(genderErrors),
      href: "/oefenen/drill/rod",
    });
  }

  /* 5. Werkwoordsvervoeging. */
  const verbErrors = rows.filter((r) => r.type === "drill_glagol" && r.correct === 0);
  if (verbErrors.length >= minCount) {
    const only = verbErrors;
    out.push({
      id: "vervoeging",
      title: "De ja-vorm van werkwoorden",
      diagnosis: `${only.length} keer de verkeerde presensvorm getypt.`,
      advice:
        "Kijk naar de klasse: -ati wordt -am, -iti wordt -im, maar -ovati wordt -ujem en niet -ovam. Die laatste is de meest gemaakte fout.",
      count: only.length,
      examples: sample(only),
      href: "/oefenen/drill/glagol",
    });
  }

  return out.sort((a, b) => b.count - a.count);
}

/** De oefeningen achter je fouten, om ze opnieuw te doen. */
export function mistakeExerciseIds(limit = 20): string[] {
  return db
    .select({ exerciseId: attempts.exerciseId })
    .from(attempts)
    .where(sql`${attempts.correct} = 0 and ${attempts.type} != 'teaching_moment'
               and ${attempts.exerciseId} not like 'drill.%'`)
    .orderBy(desc(attempts.createdAt))
    .all()
    .map((r) => r.exerciseId)
    .filter((id, i, all) => all.indexOf(id) === i)
    .slice(0, limit);
}

export interface Mistake {
  exerciseId: string;
  /** Waar de oefening over ging, als leesbaar onderwerp. */
  topic: string;
  /** De vraag zelf: het woord bij een drill, de opgave bij een oefening. */
  subject: string;
  lesson: number;
  type: string;
  /** Wat je typte, laatste keer. */
  given: string;
  expected: string;
  times: number;
  lastAt: number;
  /** Alleen een diakritisch teken of één letter mis. */
  nearMiss: boolean;
}

/**
 * Je eigen foutenbank.
 *
 * Elk antwoord staat al in de database; dit haalt eruit wat er misging en groepeert
 * het per oefening. Een fout die drie keer terugkomt is iets anders dan een
 * eenmalige verschrijving — daarom telt `times` mee en staat de lijst daarop
 * gesorteerd. Bijna-goede antwoorden (alleen een č gemist) staan er apart in,
 * want dat is een ander soort fout dan het antwoord niet weten.
 */
export function mistakes(limit = 40): Mistake[] {
  const rows = db
    .select({
      exerciseId: attempts.exerciseId,
      lesson: attempts.lesson,
      type: attempts.type,
      given: attempts.answerGiven,
      expected: attempts.expected,
      createdAt: attempts.createdAt,
      correct: attempts.correct,
      nearMiss: attempts.nearMiss,
    })
    .from(attempts)
    .where(sql`(${attempts.correct} = 0 or ${attempts.nearMiss} = 1)
               and ${attempts.type} != 'teaching_moment'`)
    .orderBy(desc(attempts.createdAt))
    .all();

  // Onderwerp erbij zoeken via het eerste item dat de oefening aansprak.
  const targetRows = db
    .select({ attemptId: attemptTargets.attemptId, topic: items.topic })
    .from(attemptTargets)
    .innerJoin(items, eq(items.id, attemptTargets.itemId))
    .all();
  const topicByAttempt = new Map(targetRows.map((r) => [r.attemptId, r.topic]));

  const grouped = new Map<string, Mistake>();
  for (const r of rows) {
    const existing = grouped.get(r.exerciseId);
    if (existing) {
      existing.times++;
      continue;
    }
    grouped.set(r.exerciseId, {
      exerciseId: r.exerciseId,
      topic: topicByAttempt.get(r.lesson) ?? topicFromId(r.exerciseId, r.lesson),
      subject: subjectOf(r.exerciseId),
      lesson: r.lesson,
      type: r.type,
      given: r.given ?? "",
      expected: r.expected ?? "",
      times: 1,
      lastAt: r.createdAt,
      nearMiss: r.nearMiss === 1 && r.correct === 1,
    });
  }

  return [...grouped.values()]
    .sort((a, b) => b.times - a.times || b.lastAt - a.lastAt)
    .slice(0, limit);
}

/**
 * Waar de vraag over ging. Zonder dit is een fout onbruikbaar: "srednji moest
 * ženski zijn" zegt niets als je niet weet bij wélk woord.
 */
function subjectOf(exerciseId: string): string {
  if (exerciseId.startsWith("drill.")) {
    const parts = exerciseId.split(".");
    const kind = parts[1];
    const ref = parts.slice(2).join(".");
    if (kind === "brojevi") return ref;
    if (kind === "padezi") {
      return loadCaseUsage().items.find((i) => i.id === ref)?.sentence_hr ?? ref;
    }
    const row = db.select({ label: items.label }).from(items).where(eq(items.id, ref)).get();
    // Het label is "riječ — vertaling"; alleen het Kroatische deel is de vraag.
    return row?.label?.split(" — ")[0] ?? ref;
  }
  const found = findExercise(exerciseId);
  if (!found) return "";
  return found.exercise.given || found.exercise.prompt_nl || "";
}

/** Grove onderwerpsaanduiding als de poging geen items aansprak (drills). */
function topicFromId(exerciseId: string, lesson: number): string {
  if (exerciseId.startsWith("drill.")) {
    const kind = exerciseId.split(".")[1];
    const label: Record<string, string> = {
      rod: "Geslacht",
      genitiv: "Genitief",
      mnozina: "Meervoud",
      glagol: "Werkwoorden",
      brojevi: "Getallen",
      diktat: "Dictee",
      padezi: "Naamvalkeuze",
      oblik: "Naamvalsvormen",
    };
    return label[kind] ?? "Drill";
  }
  if (exerciseId.startsWith("b.")) return "Begrijpend lezen";
  return `Les ${lesson}`;
}

export interface VocabRecord {
  id: string;
  hr: string;
  nl: string;
  pos: string;
  gender?: string;
  gen_sg?: string;
  nom_pl?: string;
  present_1sg?: string | null;
  aspect?: string | null;
  lesson: number;
  cefr: string;
  /** Geschatte retentie 0-1; null als het woord nog nooit langskwam. */
  retention: number | null;
  reps: number;
  lapses: number;
}

/**
 * Alle woorden met hun geheugenstatus — de bron voor het woordenboek.
 *
 * De retentie staat er bewust bij: een woordenlijst zonder geheugenstand is een
 * dood document, terwijl je juist wilt zien wélke woorden aan het weglekken zijn.
 */
export function allVocab(): VocabRecord[] {
  const now = new Date();
  return db
    .select({
      id: items.id,
      lesson: items.lesson,
      cefr: items.cefr,
      payload: items.payload,
      due: srs.due,
      stability: srs.stability,
      difficulty: srs.difficulty,
      elapsedDays: srs.elapsedDays,
      scheduledDays: srs.scheduledDays,
      reps: srs.reps,
      lapses: srs.lapses,
      state: srs.state,
      learningSteps: srs.learningSteps,
      lastReview: srs.lastReview,
    })
    .from(items)
    .leftJoin(card, defaultCardJoin)
    .leftJoin(srs, eq(srs.cardId, card.id))
    .where(eq(items.kind, "vocab"))
    .all()
    .map((r) => {
      const v = r.payload as Omit<VocabRecord, "id" | "lesson" | "cefr" | "retention" | "reps" | "lapses">;
      const seen = r.state !== null && r.state !== State.New && r.due !== null;
      return {
        id: r.id,
        hr: v.hr,
        nl: v.nl,
        pos: v.pos,
        gender: v.gender,
        gen_sg: v.gen_sg,
        nom_pl: v.nom_pl,
        present_1sg: v.present_1sg,
        aspect: v.aspect,
        lesson: r.lesson,
        cefr: r.cefr,
        reps: r.reps ?? 0,
        lapses: r.lapses ?? 0,
        retention: seen
          ? retrievability(
              {
                itemId: r.id,
                due: r.due!,
                stability: r.stability ?? 0,
                difficulty: r.difficulty ?? 0,
                elapsedDays: r.elapsedDays ?? 0,
                scheduledDays: r.scheduledDays ?? 0,
                reps: r.reps ?? 0,
                lapses: r.lapses ?? 0,
                state: r.state ?? 0,
                learningSteps: r.learningSteps ?? 0,
                lastReview: r.lastReview,
              } as SrsRow,
              now,
            )
          : null,
      };
    })
    .sort((a, b) => a.lesson - b.lesson || a.hr.localeCompare(b.hr, "hr"));
}

/**
 * Hoeveel woorden elke drill nú kan gebruiken, en vanaf welke les er meer
 * bijkomen. Daarmee kan de oefenpagina een lege drill markeren vóór je erop
 * klikt, in plaats van erna.
 */
export function drillAvailability(): Record<string, { now: number; from: number | null }> {
  const maxLesson = Math.max(1, highestActiveLesson());
  const rows = db
    .select({ lesson: items.lesson, payload: items.payload })
    .from(items)
    .where(eq(items.kind, "vocab"))
    .all()
    .map((r) => ({ lesson: r.lesson, v: r.payload as VocabRow }));

  const match: Record<string, (v: VocabRow) => boolean> = {
    rod: (v) => v.pos === "noun" && !!v.gender,
    genitiv: (v) => v.pos === "noun" && !!v.gen_sg && v.gen_sg !== v.hr,
    mnozina: (v) => v.pos === "noun" && !!v.nom_pl && v.nom_pl !== v.hr,
    glagol: (v) => v.pos === "verb" && !!v.present_1sg && v.present_1sg !== v.hr,
    diktat: (v) => /[čćđšž]/i.test(v.hr) && !v.hr.includes(" "),
  };

  const out: Record<string, { now: number; from: number | null }> = {};
  for (const [kind, fn] of Object.entries(match)) {
    const hits = rows.filter((r) => fn(r.v));
    const now = hits.filter((r) => r.lesson <= maxLesson).length;
    const later = hits.filter((r) => r.lesson > maxLesson).map((r) => r.lesson);
    out[kind] = { now, from: now === 0 && later.length ? Math.min(...later) : null };
  }
  // Getallen komen uit regels, niet uit woorden — die zijn er altijd.
  out.brojevi = { now: 101, from: null };

  // Vormkaarten: alles wat de verbuigingsmotor voor jouw niveau heeft opgeleverd.
  const formRows = db
    .select({ lesson: items.lesson })
    .from(items)
    .where(eq(items.kind, "form"))
    .all();
  const formsNow = formRows.filter((r) => r.lesson <= maxLesson).length;
  const formsLater = formRows.filter((r) => r.lesson > maxLesson).map((r) => r.lesson);
  out.oblik = {
    now: formsNow,
    from: formsNow === 0 && formsLater.length ? Math.min(...formsLater) : null,
  };

  // Naamvalkeuze komt uit geschreven zinnen; die groeien mee met je niveau.
  const usage = loadCaseUsage();
  const usable = usage.items.filter((i) => i.lesson <= Math.max(maxLesson, 5));
  const later = usage.items.filter((i) => i.lesson > Math.max(maxLesson, 5)).map((i) => i.lesson);
  out.padezi = {
    now: usable.length,
    from: usable.length === 0 && later.length ? Math.min(...later) : null,
  };
  return out;
}

interface VocabRow {
  hr: string;
  pos: string;
  gender?: string;
  gen_sg?: string;
  nom_pl?: string;
  present_1sg?: string | null;
}

/**
 * Het woord van vandaag.
 *
 * Deterministisch uit de datum, zodat het woord de hele dag hetzelfde blijft —
 * en gekozen uit stof die je al kunt tegenkomen, zodat het geen willekeurige
 * vooruitblik is maar iets uit je eigen bereik.
 */
export function wordOfTheDay(): {
  hr: string;
  nl: string;
  pos: string;
  gender?: string;
  gen_sg?: string;
  nom_pl?: string;
  lesson: number;
  seen: boolean;
} | null {
  const maxLesson = Math.max(1, highestActiveLesson());

  const rows = db
    .select({ id: items.id, lesson: items.lesson, payload: items.payload, state: srs.state })
    .from(items)
    .leftJoin(card, defaultCardJoin)
    .leftJoin(srs, eq(srs.cardId, card.id))
    .where(sql`${items.kind} = 'vocab' and ${items.lesson} <= ${maxLesson}`)
    .all();

  if (rows.length === 0) return null;

  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pick = rows[(h >>> 0) % rows.length];
  const v = pick.payload as {
    hr: string;
    nl: string;
    pos: string;
    gender?: string;
    gen_sg?: string;
    nom_pl?: string;
  };

  return {
    hr: v.hr,
    nl: v.nl,
    pos: v.pos,
    gender: v.gender,
    gen_sg: v.gen_sg,
    nom_pl: v.nom_pl,
    lesson: pick.lesson,
    seen: pick.state !== null && pick.state !== State.New,
  };
}

/** Het hoogste lesnummer dat af of onderweg is — bepaalt welk verhaal "op niveau" is. */
export function highestActiveLesson(): number {
  const rows = db.select().from(lessonProgress).all();
  return rows
    .filter((r) => r.status === "done" || r.status === "in_progress")
    .reduce((n, r) => Math.max(n, r.lesson), 0);
}
