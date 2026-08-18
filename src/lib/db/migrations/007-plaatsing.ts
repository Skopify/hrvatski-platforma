/**
 * De plaatsingstoets, en waar zijn uitslag blijft staan.
 *
 * §12: het curriculum is compleet van nul tot eind, maar het pad erdoorheen mag
 * kort zijn waar de leerder al sterk is. Dat vraagt om een meting, en die
 * meting moet ergens vandaan komen. Nooit uit een vraag als "beheers je dit?" —
 * zelfinschatting is bij grammatica systematisch te optimistisch, en bij de
 * onderwerpen die er het meest toe doen (aspect, clitische volgorde) weet een
 * leerder meestal niet eens dat hij ze fout doet.
 *
 * Daarom drie tabellen in plaats van één vlaggetje:
 *
 * `placement_run` en `placement_answer` bewaren de ruwe antwoorden. Zonder die
 * twee is een status een getal zonder herkomst, en dan kun je hem later niet
 * meer betwisten. Met deze twee kun je van elke module terugvinden welke drie
 * vragen ertoe leidden, wat je antwoordde en wanneer.
 *
 * `module_status` is de afgeleide: de conclusie, niet de waarneming. Hij bewaart
 * `correct` en `total` erbij, zodat op het scherm "3 van 3" kan staan in plaats
 * van alleen "beheerst". Een status zonder teller belooft meer dan hij waarmaakt.
 *
 * `card.assumed` is het eerlijke deel van de woordenschatveeg. Een steekproef
 * van vijf woorden per band zegt iets over de band, maar de overige woorden zijn
 * niet gemeten — die krijgen deze vlag, worden apart geteld en apart getoond.
 * Zonder dat onderscheid zou de dekkingsmeter een schatting als meting
 * presenteren, en dat is precies wat hij niet mag doen.
 */
export const sql = `
CREATE TABLE placement_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  scope TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE placement_answer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES placement_run(id),
  kind TEXT NOT NULL,
  module_code TEXT,
  band INTEGER,
  item_id TEXT,
  exercise_id TEXT,
  correct INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX placement_answer_run_idx ON placement_answer(run_id);

CREATE TABLE module_status (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  source TEXT NOT NULL,
  run_id INTEGER,
  measured_at INTEGER NOT NULL
);

ALTER TABLE card ADD COLUMN assumed INTEGER NOT NULL DEFAULT 0;
CREATE INDEX card_assumed_idx ON card(assumed);
`;
