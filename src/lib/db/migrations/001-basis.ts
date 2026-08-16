/**
 * De database zoals hij was vóór de herbouw.
 *
 * Dit is letterlijk de DDL die tot nu toe bij elke start werd uitgevoerd. Hij
 * staat hier onveranderd, ook waar latere migraties hem weer omgooien: een
 * migratiereeks die zijn eigen verleden herschrijft geeft op een lege database
 * een ander schema dan op een gevulde, en dan is de reeks niets waard.
 *
 * Alles is CREATE TABLE IF NOT EXISTS, dus een database die deze tabellen al
 * had, komt hier ongeschonden doorheen.
 */
export const sql = `
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
