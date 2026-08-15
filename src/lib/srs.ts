import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

import { db } from "./db";
import { items, reviewLog, srs } from "./db/schema";
import type { Exercise } from "./content";
import type { GradeResult } from "./grading";

/**
 * FSRS boven SM-2: dezelfde retentie met 20-30% minder herhalingen, en zonder
 * SM-2's bekendste faalmodus (een ease factor die naar 1.3 zakt en nooit meer
 * herstelt, waardoor moeilijke items eindeloos blijven terugkomen).
 *
 * request_retention 0.90 is de standaard; enable_fuzz spreidt vervaldata zodat er
 * geen bulten in de agenda ontstaan. Het volledige reviewlogboek wordt bewaard,
 * zodat deze parameters later op de eigen leerhistorie geoptimaliseerd kunnen
 * worden in plaats van op het gemiddelde van iemand anders.
 */
export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: true,
    enable_short_term: true,
  }),
);

export interface SrsRow {
  itemId: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
}

function toCard(row: SrsRow | undefined, now: Date): Card {
  if (!row) return createEmptyCard(now);
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ? new Date(row.lastReview) : undefined,
  };
}

/**
 * Automatisch beoordelen in plaats van de leerder zelf laten kiezen. Zelfrapportage
 * ("hoe moeilijk vond je dit?") is bij getypte productie overbodig — het antwoord
 * zegt het al — en zelfbeoordeling is systematisch te mild.
 */
export function ratingFor(result: GradeResult, exercise: Exercise, durationMs: number): Grade {
  if (!result.correct) return Rating.Again;
  if (result.nearMiss) return Rating.Hard;
  const fastThreshold = exercise.mode === "productive" ? 9000 : 4000;
  if (durationMs > 0 && durationMs < fastThreshold) return Rating.Easy;
  return Rating.Good;
}

/** Zorgt dat elk genoemd item een FSRS-kaart heeft (nieuw = direct opvraagbaar). */
export function ensureCards(itemIds: string[], now = new Date()): void {
  if (!itemIds.length) return;
  const existing = new Set(
    db
      .select({ itemId: srs.itemId })
      .from(srs)
      .where(inArray(srs.itemId, itemIds))
      .all()
      .map((r) => r.itemId),
  );
  const known = new Set(
    db
      .select({ id: items.id })
      .from(items)
      .where(inArray(items.id, itemIds))
      .all()
      .map((r) => r.id),
  );
  const missing = itemIds.filter((id) => known.has(id) && !existing.has(id));
  if (!missing.length) return;
  const empty = createEmptyCard(now);
  for (const id of missing) {
    db.insert(srs)
      .values({
        itemId: id,
        due: empty.due.getTime(),
        stability: empty.stability,
        difficulty: empty.difficulty,
        elapsedDays: empty.elapsed_days,
        scheduledDays: empty.scheduled_days,
        reps: empty.reps,
        lapses: empty.lapses,
        state: empty.state,
        lastReview: null,
      })
      .onConflictDoNothing()
      .run();
  }
}

/** Verwerkt één review: plant het item opnieuw en schrijft het logboek weg. */
export function applyReview(
  itemId: string,
  rating: Grade,
  durationMs: number,
  now = new Date(),
): void {
  const row = db.select().from(srs).where(eq(srs.itemId, itemId)).get() as SrsRow | undefined;
  const card = toCard(row, now);
  const { card: next, log } = scheduler.next(card, now, rating);

  db.insert(srs)
    .values({
      itemId,
      due: next.due.getTime(),
      stability: next.stability,
      difficulty: next.difficulty,
      elapsedDays: next.elapsed_days,
      scheduledDays: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      lastReview: next.last_review?.getTime() ?? now.getTime(),
    })
    .onConflictDoUpdate({
      target: srs.itemId,
      set: {
        due: next.due.getTime(),
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsed_days,
        scheduledDays: next.scheduled_days,
        reps: next.reps,
        lapses: next.lapses,
        state: next.state,
        lastReview: next.last_review?.getTime() ?? now.getTime(),
      },
    })
    .run();

  db.insert(reviewLog)
    .values({
      itemId,
      rating: log.rating,
      state: log.state,
      due: log.due.getTime(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      lastElapsedDays: log.last_elapsed_days,
      scheduledDays: log.scheduled_days,
      reviewedAt: log.review.getTime(),
      durationMs,
    })
    .run();
}

/** Items die nu herhaald moeten worden, zwakste eerst. */
export function dueItemIds(now = new Date(), limit = 200): string[] {
  return db
    .select({ itemId: srs.itemId })
    .from(srs)
    .where(and(lte(srs.due, now.getTime()), sql`${srs.state} != ${State.New}`))
    .orderBy(srs.due)
    .limit(limit)
    .all()
    .map((r) => r.itemId);
}

/**
 * Wanneer valt het eerstvolgende item? Zonder dit tijdstip leest een lege
 * herhaalwachtrij als "er is niets", terwijl er misschien over tien minuten al
 * iets klaarstaat — FSRS plant net geleerde items binnen dezelfde dag opnieuw in.
 */
export function nextDueAt(now = new Date()): Date | null {
  const row = db
    .select({ due: srs.due })
    .from(srs)
    .where(and(sql`${srs.due} > ${now.getTime()}`, sql`${srs.state} != ${State.New}`))
    .orderBy(srs.due)
    .limit(1)
    .get();
  return row ? new Date(row.due) : null;
}

export function dueCount(now = new Date()): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(srs)
    .where(and(lte(srs.due, now.getTime()), sql`${srs.state} != ${State.New}`))
    .get();
  return row?.n ?? 0;
}

/**
 * Geschatte retentie per item (de kans dat je het nú nog weet). Dit is wat het
 * dashboard "beheersing" noemt — informatiever dan een ruwe goed/fout-teller,
 * omdat het meeweegt hoe lang geleden je het zag.
 */
export function retrievability(row: SrsRow, now = new Date()): number {
  if (row.state === State.New || !row.lastReview) return 0;
  const card = toCard(row, now);
  const r = scheduler.get_retrievability(card, now, false);
  return typeof r === "number" ? r : 0;
}
