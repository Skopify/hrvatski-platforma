import { and, eq, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Eén profiel (rij id=1). Het platform is bewust single-user; als er ooit meer
 * profielen bij komen, is dit de enige tabel die een echte sleutel nodig heeft.
 */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("Leerder"),
  xp: integer("xp").notNull().default(0),
  streakCurrent: integer("streak_current").notNull().default(0),
  streakLongest: integer("streak_longest").notNull().default(0),
  lastStudyDate: text("last_study_date"),
  dailyGoalXp: integer("daily_goal_xp").notNull().default(60),
  createdAt: integer("created_at").notNull(),
});

/**
 * Eén rij per leerbaar item. Drie soorten:
 *   vocab   — een woord of vaste uitdrukking
 *   grammar — een grammaticapunt
 *   form    — één specifieke verbogen vorm (lemma × naamval × getal)
 *
 * `form` is wat naamvallen leerbaar maakt: de SRS plant per vorm, niet per woord,
 * zodat "accusatief zit, locatief lekt" een meetbare uitspraak wordt.
 */
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  lesson: integer("lesson").notNull(),
  topic: text("topic").notNull(),
  grammaticalCase: text("grammatical_case"),
  cefr: text("cefr").notNull(),
  label: text("label").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
});

/**
 * Eén geheugenkaart. Een item kan er meerdere dragen, want kennen is niet één
 * ding: `kuća → huis` herkennen lukt maanden nadat `huis → kuća` produceren al
 * weg is. Aparte kaarten betekent aparte planning en een eerlijker beeld.
 *
 * `context` is leeg voor gewone kaarten en draagt bij gemijnde woorden het id
 * van de zin waaruit ze komen — zodat dezelfde woordvorm uit twee verschillende
 * verhalen twee kaarten kan zijn, elk met zijn eigen zin.
 */
export const card = sqliteTable("card", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  itemId: text("item_id").notNull().references(() => items.id),
  context: text("context").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

/** De soorten kaarten. Fase 0 gebruikt alleen de eerste drie. */
export const CARD_KINDS = [
  "LEX_RECOG",
  "LEX_PROD",
  "FORM",
  "GRAM",
  "CHUNK",
  "CLOZE",
  "AUDIO",
] as const;

export type CardKind = (typeof CARD_KINDS)[number];

/** Welke kaartsoort een item krijgt als er niets anders gevraagd wordt. */
export const DEFAULT_CARD_KIND: Record<string, CardKind> = {
  vocab: "LEX_RECOG",
  grammar: "GRAM",
  form: "FORM",
};

/**
 * Koppelvoorwaarde voor "de standaardkaart van dit item".
 *
 * Statistieken gaan over items ("hoeveel woorden ken ik"), niet over kaarten.
 * Zolang elk item één kaart heeft maakt dat niets uit, maar zodra een woord een
 * herkennings- én een productiekaart draagt, zou een koppeling zonder deze
 * voorwaarde elk woord dubbel tellen. Vandaar dat de statistiek nu al expliciet
 * zegt wélke kaart hij bedoelt.
 */
export const defaultCardJoin = and(
  eq(card.itemId, items.id),
  eq(card.context, ""),
  sql`${card.kind} = CASE ${items.kind}
        WHEN 'vocab' THEN 'LEX_RECOG'
        WHEN 'grammar' THEN 'GRAM'
        WHEN 'form' THEN 'FORM' END`,
);

/** FSRS-toestand per kaart. Eén rij per kaart zodra hij voor het eerst gezien is. */
export const srs = sqliteTable("srs", {
  cardId: integer("card_id").primaryKey().references(() => card.id),
  due: integer("due").notNull(),
  stability: real("stability").notNull().default(0),
  difficulty: real("difficulty").notNull().default(0),
  elapsedDays: real("elapsed_days").notNull().default(0),
  scheduledDays: real("scheduled_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0),
  learningSteps: integer("learning_steps").notNull().default(0),
  lastReview: integer("last_review"),
});

/**
 * Volledig reviewlogboek. Bewust redundant: hiermee kunnen de FSRS-parameters
 * later op de eigen leerhistorie geoptimaliseerd worden zonder dataverlies.
 */
export const reviewLog = sqliteTable("review_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull().references(() => card.id),
  rating: integer("rating").notNull(),
  state: integer("state").notNull(),
  due: integer("due").notNull(),
  stability: real("stability").notNull(),
  difficulty: real("difficulty").notNull(),
  elapsedDays: real("elapsed_days").notNull(),
  lastElapsedDays: real("last_elapsed_days").notNull(),
  scheduledDays: real("scheduled_days").notNull(),
  reviewedAt: integer("reviewed_at").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
});

/** Eén rij per beantwoorde oefening — de bron voor accuracy en zwakke punten. */
export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: text("exercise_id").notNull(),
  lesson: integer("lesson").notNull(),
  type: text("type").notNull(),
  mode: text("mode").notNull(),
  correct: integer("correct").notNull(),
  nearMiss: integer("near_miss").notNull().default(0),
  answerGiven: text("answer_given"),
  expected: text("expected"),
  durationMs: integer("duration_ms").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

/** Welke items een poging aansprak — maakt "accuracy per naamval" één join. */
export const attemptTargets = sqliteTable("attempt_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attemptId: integer("attempt_id").notNull(),
  itemId: text("item_id").notNull(),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  lesson: integer("lesson").primaryKey(),
  status: text("status").notNull().default("locked"),
  sectionsDone: text("sections_done", { mode: "json" }).notNull().default(sql`'[]'`),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
});

/**
 * Voortgang per verhaal. `lookups` telt hoe vaak er een woord is aangetikt —
 * dat is de eerlijkste maat voor of een verhaal op niveau was: veel opzoeken
 * betekent dat het te hoog gegrepen was, nul opzoeken dat het te makkelijk was.
 */
export const storyProgress = sqliteTable("story_progress", {
  slug: text("slug").primaryKey(),
  readAt: integer("read_at"),
  quizDoneAt: integer("quiz_done_at"),
  lookups: integer("lookups").notNull().default(0),
});

/**
 * Hoe vaak een woord in lopende tekst is tegengekomen.
 *
 * Dit is iets anders dan het aantal SRS-herhalingen. Onderzoek naar extensief
 * lezen laat zien dat een woord na acht tot tien ontmoetingen in betekenisvolle
 * context vanzelf blijft hangen — zónder het bewust te studeren. Herhalingen in
 * een oefening tellen daar niet voor; ontmoetingen in een verhaal wel.
 */
export const encounters = sqliteTable("encounters", {
  itemId: text("item_id").primaryKey(),
  count: integer("count").notNull().default(0),
  lastAt: integer("last_at"),
});

export const studySessions = sqliteTable("study_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  lesson: integer("lesson"),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  xp: integer("xp").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  total: integer("total").notNull().default(0),
});

/**
 * Het foutenlogboek: niet dát een antwoord fout was, maar wát er fout was.
 * Zie src/lib/db/migrations/003-fouten.ts voor de redenering.
 */
export const errorLog = sqliteTable("error_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts").notNull(),
  exerciseId: text("exercise_id").notNull(),
  attemptId: integer("attempt_id"),
  itemId: text("item_id"),
  lemmaId: text("lemma_id"),
  grammarPointId: text("grammar_point_id"),
  errorType: text("error_type").notNull(),
  expectedCase: text("expected_case"),
  givenCase: text("given_case"),
  expectedNumber: text("expected_number"),
  givenNumber: text("given_number"),
  expected: text("expected").notNull(),
  given: text("given").notNull(),
});

/** Verhaalzinnen, adresseerbaar — zodat een gemijnd woord zijn bronzin houdt. */
export const sentence = sqliteTable("sentence", {
  id: text("id").primaryKey(),
  storySlug: text("story_slug").notNull(),
  paragraphId: text("paragraph_id").notNull(),
  idx: integer("idx").notNull(),
  hr: text("hr").notNull(),
  nl: text("nl").notNull(),
});

/**
 * Het schema wordt niet meer hier aangemaakt maar door de migraties in
 * src/lib/db/migrations/. Dit bestand beschrijft alleen nog hoe de tabellen er
 * nú uitzien; hoe ze zo geworden zijn staat in de reeks.
 */
