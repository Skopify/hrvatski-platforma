/**
 * Het foutenlogboek.
 *
 * Er werd al bijgehouden dát een antwoord fout was, in `attempts`. Wat er niet
 * stond is *wat voor* fout het was. Het verschil tussen «kuću» invullen waar
 * «kući» moest, en «kuca» invullen waar «kuća» moest, is het verschil tussen een
 * naamval die niet zit en een diakritisch teken dat je vergeet — twee volstrekt
 * verschillende problemen met twee verschillende remedies.
 *
 * Dit logboek maakt dat onderscheid opzoekbaar. Twee dingen draaien erop:
 *   - de escalerende feedback (eerst een hint over de categorie, dan pas het
 *     antwoord) kan alleen een zinnige hint geven als de categorie bekend is;
 *   - de zwakteoefeningen kunnen pas gericht worden als er iets te richten valt.
 *
 * `attempts` blijft de inventaris van alles wat je gedaan hebt; dit is de
 * ontleding van wat er misging. Een fout kan hier meerdere keren staan als hij
 * meerdere grammaticapunten raakt.
 */
export const sql = `
CREATE TABLE error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  attempt_id INTEGER,
  /** Het item dat gevraagd werd — een vorm, een woord of een grammaticapunt. */
  item_id TEXT,
  /** Het woordenboekwoord erachter, zodat je per lemma kunt kijken. */
  lemma_id TEXT,
  grammar_point_id TEXT,
  error_type TEXT NOT NULL,
  /** Naamval/getal van wat er moest staan en van wat je schreef. */
  expected_case TEXT,
  given_case TEXT,
  expected_number TEXT,
  given_number TEXT,
  expected TEXT NOT NULL,
  given TEXT NOT NULL
);
CREATE INDEX error_log_point_idx ON error_log(grammar_point_id);
CREATE INDEX error_log_type_idx ON error_log(error_type);
CREATE INDEX error_log_ts_idx ON error_log(ts);
`;
