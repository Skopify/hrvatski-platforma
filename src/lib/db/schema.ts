import { sql } from "drizzle-orm";
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

/** FSRS-toestand per item. Eén rij per item zodra het voor het eerst gezien is. */
export const srs = sqliteTable("srs", {
  itemId: text("item_id").primaryKey().references(() => items.id),
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
  itemId: text("item_id").notNull(),
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

export const DDL = `
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Leerder',
  xp INTEGER NOT NULL DEFAULT 0,
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_longest INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  daily_goal_xp INTEGER NOT NULL DEFAULT 60,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  lesson INTEGER NOT NULL,
  topic TEXT NOT NULL,
  grammatical_case TEXT,
  cefr TEXT NOT NULL,
  label TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_lesson_idx ON items(lesson);
CREATE INDEX IF NOT EXISTS items_topic_idx ON items(topic);

CREATE TABLE IF NOT EXISTS srs (
  item_id TEXT PRIMARY KEY REFERENCES items(id),
  due INTEGER NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days REAL NOT NULL DEFAULT 0,
  scheduled_days REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER
);
CREATE INDEX IF NOT EXISTS srs_due_idx ON srs(due);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  state INTEGER NOT NULL,
  due INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  elapsed_days REAL NOT NULL,
  last_elapsed_days REAL NOT NULL,
  scheduled_days REAL NOT NULL,
  reviewed_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS review_log_item_idx ON review_log(item_id);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id TEXT NOT NULL,
  lesson INTEGER NOT NULL,
  type TEXT NOT NULL,
  mode TEXT NOT NULL,
  correct INTEGER NOT NULL,
  near_miss INTEGER NOT NULL DEFAULT 0,
  answer_given TEXT,
  expected TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts(created_at);

CREATE TABLE IF NOT EXISTS attempt_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  item_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempt_targets_item_idx ON attempt_targets(item_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'locked',
  sections_done TEXT NOT NULL DEFAULT '[]',
  started_at INTEGER,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS story_progress (
  slug TEXT PRIMARY KEY,
  read_at INTEGER,
  quiz_done_at INTEGER,
  lookups INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS encounters (
  item_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  lesson INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  xp INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0
);
`;
