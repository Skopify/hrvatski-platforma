import fs from "node:fs";
import path from "node:path";

import { sqlite } from "./db";

/**
 * Alle voortgang wissen en opnieuw beginnen.
 *
 * ── Wat er wél weggaat ─────────────────────────────────────────────────────
 * Alles wat jij hebt opgebouwd: XP, reeks, herhaalplanning, het reviewlogboek,
 * je antwoorden, welke lessen open staan, gelezen verhalen en ontmoetingen.
 *
 * ── Wat er blijft ──────────────────────────────────────────────────────────
 * De leerstof zelf (de items-tabel) en de audiocache. Die eerste is content, geen
 * voortgang; de tweede is bij Azure opgehaald en zou opnieuw tekens kosten.
 *
 * ── Waarom er eerst een kopie wordt gemaakt ────────────────────────────────
 * Het reviewlogboek is het enige in dit platform dat je niet kunt terughalen
 * door harder te studeren: het is de opname van hoe jouw geheugen zich over
 * maanden gedroeg. Een reset kost een halve seconde en is onomkeerbaar, dus
 * gaat er altijd een kopie aan vooraf — ook als je er nooit naar omkijkt.
 */

const DB_PATH = path.join(process.cwd(), "data", "hrvatski.db");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");

/**
 * Tabellen die voortgang bevatten. `items` staat hier bewust niet bij.
 *
 * `card` stond er aanvankelijk óók niet bij, en dat was fout. Een kaart is geen
 * leerstof maar leerstof-in-omloop: hij zegt dat dit woord in jouw rotatie zit.
 * Bleef hij staan terwijl zijn SRS-rij verdween, dan hield je een kaart over die
 * nergens meer opduikt — niet als herhaling, want daarvoor is een SRS-rij nodig,
 * en niet als nieuw woord, want de kaart bestaat al. Na een reset waren
 * honderdveertig woorden zo stilletjes uit de omloop verdwenen.
 *
 * De volgorde is niet vrij: srs en review_log wijzen naar card, dus die moeten
 * eerst leeg zijn. Daarom staat card achteraan.
 */
/*
  `schrijfwerk` staat hier met opzet niet bij.

  Voortgang wissen betekent: opnieuw beginnen met leren. Het betekent niet dat
  de teksten die je zelf geschreven hebt weg moeten. Die zijn geen meting maar
  werk — je kunt een SRS-toestand terugverdienen door te studeren, en een
  verhaal dat je zelf bedacht hebt niet.

  Wie ze echt kwijt wil, kan een opdracht overschrijven. Dat is een handeling
  per stuk, en dat hoort het ook te zijn.
*/
const PROGRESS_TABLES = [
  "srs",
  "review_log",
  "attempt_targets",
  "attempts",
  "study_sessions",
  "encounters",
  "story_progress",
  "module_progress",
  "card",
];

export interface ResetResult {
  backup: string;
  cleared: Record<string, number>;
}

/** Een kopie van de database wegschrijven, met de tijd in de naam. */
export function backupDatabase(): string {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})/, "$1-");
  const file = path.join(BACKUP_DIR, `hrvatski-${stamp}.db`);
  // Via de VACUUM INTO van SQLite: die maakt een consistente kopie, ook terwijl
  // er verbindingen openstaan. Een kaal bestandskopie zou de WAL kunnen missen.
  sqlite.prepare("VACUUM INTO ?").run(file);
  return path.relative(process.cwd(), file);
}

export function resetProgress(): ResetResult {
  const backup = backupDatabase();
  const cleared: Record<string, number> = {};

  const run = sqlite.transaction(() => {
    for (const table of PROGRESS_TABLES) {
      const before = (sqlite.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n;
      sqlite.prepare(`DELETE FROM ${table}`).run();
      if (before) cleared[table] = before;
    }

    sqlite
      .prepare(
        `UPDATE profile SET xp = 0, streak_current = 0, streak_longest = 0,
         last_study_date = NULL WHERE id = 1`,
      )
      .run();

    // Lessen terug op slot, op de eerste twee na — dezelfde stand als na het
    // seeden, zodat je precies begint waar een nieuwe leerder begint.
    sqlite
      .prepare(
        `UPDATE lesson_progress
         SET status = CASE WHEN lesson <= 1 THEN 'available' ELSE 'locked' END,
             sections_done = '[]', started_at = NULL, completed_at = NULL`,
      )
      .run();
  });
  run();

  return { backup, cleared };
}

/** Wat je kwijtraakt, om vóór het wissen te kunnen tonen. */
export function progressSummary(): {
  xp: number;
  attempts: number;
  reviews: number;
  lessonsDone: number;
  days: number;
} {
  const one = (q: string) => (sqlite.prepare(q).get() as { n: number }).n;
  return {
    xp: one("SELECT COALESCE(xp, 0) n FROM profile WHERE id = 1"),
    attempts: one("SELECT count(*) n FROM attempts"),
    reviews: one("SELECT count(*) n FROM review_log"),
    lessonsDone: one("SELECT count(*) n FROM lesson_progress WHERE status = 'done'"),
    days: one("SELECT count(DISTINCT date(created_at / 1000, 'unixepoch')) n FROM attempts"),
  };
}
