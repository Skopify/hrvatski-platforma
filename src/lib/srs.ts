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
import { card, DEFAULT_CARD_KIND, items, reviewLog, srs, type CardKind } from "./db/schema";
import type { Exercise } from "./content";
import type { GradeResult } from "./grading";

export type { CardKind };

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

/**
 * De FSRS-toestand van één kaart. Bewust zonder sleutel: dit beschrijft het
 * geheugenmodel, niet aan wat het vastzit. Zo kan elke aanroeper zijn eigen
 * selectie hierheen casten zonder de kaart-id mee te hoeven slepen.
 */
export interface SrsRow {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  /**
   * Hoeveel leerstapjes een kaart binnen de dag al gehad heeft.
   *
   * De kolom bestond al maar werd nooit gelezen of teruggeschreven: hij ging als
   * 0 de database in en kwam er nooit meer uit. FSRS-6 vraagt hem expliciet, en
   * terecht — zonder deze stand begint de korte-termijnplanning van een kaart die
   * je vandaag al twee keer zag telkens opnieuw bij stap één.
   */
  learningSteps: number;
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
    learning_steps: row.learningSteps ?? 0,
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

/**
 * Welke kaartsoort een item krijgt als de aanroeper niets voorschrijft.
 *
 * Een woord wordt standaard een herkenningskaart. Dat is niet omdat herkennen
 * belangrijker is, maar omdat het de kaart is die de bestaande oefeningen al
 * toetsten — zo blijft de planning van vandaag precies zoals hij was. De
 * productiekaart komt erbij zodra de woordenschatsectie hem gaat vullen.
 */
export function defaultKindFor(itemIds: string[]): Map<string, CardKind> {
  if (!itemIds.length) return new Map();
  const out = new Map<string, CardKind>();
  for (const r of db
    .select({ id: items.id, kind: items.kind })
    .from(items)
    .where(inArray(items.id, itemIds))
    .all()) {
    const soort = DEFAULT_CARD_KIND[r.kind];
    if (soort) out.set(r.id, soort);
  }
  return out;
}

/**
 * Zorgt dat elk genoemd item een kaart van de gevraagde soort heeft, met een
 * FSRS-toestand (nieuw = direct opvraagbaar). Geeft de kaart-id's terug in de
 * volgorde van de invoer; items die niet bestaan vallen weg.
 *
 * Idempotent: twee keer aanroepen levert dezelfde kaarten op. Dat is geen
 * bijzaak — zou het een tweede kaart maken, dan verdubbelt de herhaallast bij
 * elke sessie waarin hetzelfde woord voorkomt.
 */
export function ensureCards(
  itemIds: string[],
  kind?: CardKind,
  now = new Date(),
  context = "",
): number[] {
  if (!itemIds.length) return [];

  const soorten = kind
    ? new Map(itemIds.map((id) => [id, kind]))
    : defaultKindFor(itemIds);

  // Onbekende items overslaan: een kaart naar een item dat niet bestaat zou de
  // planning vullen met iets wat nooit geoefend kan worden.
  const bestaat = new Set(
    db
      .select({ id: items.id })
      .from(items)
      .where(inArray(items.id, itemIds))
      .all()
      .map((r) => r.id),
  );

  const empty = createEmptyCard(now);
  const out: number[] = [];

  for (const itemId of itemIds) {
    const soort = soorten.get(itemId);
    if (!soort || !bestaat.has(itemId)) continue;

    db.insert(card)
      .values({ kind: soort, itemId, context, createdAt: now.getTime() })
      .onConflictDoNothing()
      .run();

    const rij = db
      .select({ id: card.id })
      .from(card)
      .where(and(eq(card.kind, soort), eq(card.itemId, itemId), eq(card.context, context)))
      .get();
    if (!rij) continue;

    db.insert(srs)
      .values({
        cardId: rij.id,
        due: empty.due.getTime(),
        stability: empty.stability,
        difficulty: empty.difficulty,
        elapsedDays: empty.elapsed_days,
        scheduledDays: empty.scheduled_days,
        reps: empty.reps,
        lapses: empty.lapses,
        state: empty.state,
        learningSteps: empty.learning_steps,
        lastReview: null,
      })
      .onConflictDoNothing()
      .run();

    out.push(rij.id);
  }

  return out;
}

/** Verwerkt één review: plant de kaart opnieuw en schrijft het logboek weg. */
export function applyReview(
  cardId: number,
  rating: Grade,
  durationMs: number,
  now = new Date(),
): void {
  const row = db.select().from(srs).where(eq(srs.cardId, cardId)).get() as SrsRow | undefined;
  const card = toCard(row, now);
  const { card: next, log } = scheduler.next(card, now, rating);

  db.insert(srs)
    .values({
      cardId,
      due: next.due.getTime(),
      stability: next.stability,
      difficulty: next.difficulty,
      elapsedDays: next.elapsed_days,
      scheduledDays: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      learningSteps: next.learning_steps,
      lastReview: next.last_review?.getTime() ?? now.getTime(),
    })
    .onConflictDoUpdate({
      target: srs.cardId,
      set: {
        due: next.due.getTime(),
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsed_days,
        scheduledDays: next.scheduled_days,
        reps: next.reps,
        lapses: next.lapses,
        state: next.state,
        learningSteps: next.learning_steps,
        lastReview: next.last_review?.getTime() ?? now.getTime(),
      },
    })
    .run();

  db.insert(reviewLog)
    .values({
      cardId,
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

export interface DueCard {
  cardId: number;
  itemId: string;
  kind: CardKind;
  due: number;
}

/** Kaarten die nu herhaald moeten worden, langst vervallen eerst. */
export function dueCards(now = new Date(), limit = 200): DueCard[] {
  return db
    .select({ cardId: srs.cardId, itemId: card.itemId, kind: card.kind, due: srs.due })
    .from(srs)
    .innerJoin(card, eq(card.id, srs.cardId))
    .where(and(lte(srs.due, now.getTime()), sql`${srs.state} != ${State.New}`))
    .orderBy(srs.due)
    .limit(limit)
    .all() as DueCard[];
}

/** Items achter de vervallen kaarten, zonder dubbelen, in dezelfde volgorde. */
export function dueItemIds(now = new Date(), limit = 200): string[] {
  const gezien = new Set<string>();
  for (const c of dueCards(now, limit)) gezien.add(c.itemId);
  return [...gezien];
}

/** Kaarten die ná dit moment vervallen, eerstvolgende eerst. */
export function upcomingCards(now = new Date(), limit = 200): DueCard[] {
  return db
    .select({ cardId: srs.cardId, itemId: card.itemId, kind: card.kind, due: srs.due })
    .from(srs)
    .innerJoin(card, eq(card.id, srs.cardId))
    .where(and(sql`${srs.due} > ${now.getTime()}`, sql`${srs.state} != ${State.New}`))
    .orderBy(srs.due)
    .limit(limit)
    .all() as DueCard[];
}

/**
 * Wanneer valt de eerstvolgende kaart? Zonder dit tijdstip leest een lege
 * herhaalwachtrij als "er is niets", terwijl er misschien over tien minuten al
 * iets klaarstaat — FSRS plant net geleerde kaarten binnen dezelfde dag opnieuw in.
 */
export function nextDueAt(now = new Date()): Date | null {
  const rij = upcomingCards(now, 1)[0];
  return rij ? new Date(rij.due) : null;
}

/**
 * Alle vervallen kaarten.
 *
 * Let op: dit is niet hetzelfde als het aantal dat een herhaalsessie je
 * voorschotelt. Een kaart is pas te oefenen als er een oefening bestaat die hem
 * aanspreekt, en dat geldt lang niet voor alles. Wat de sessie werkelijk
 * serveert, telt `reviewableCount()` in planner.ts — dat is het getal dat op het
 * scherm hoort.
 */
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
