import type BetterSqlite3 from "better-sqlite3";

/**
 * Kaarten losknippen van items.
 *
 * ── Waarom ─────────────────────────────────────────────────────────────────
 * Tot nu toe verwees `srs.item_id` rechtstreeks naar `items.id`. Eén woord kon
 * daardoor precies één geheugenkaart hebben. Maar herkennen (kuća → huis) en
 * produceren (huis → kuća) zijn verschillende vaardigheden die op verschillende
 * momenten wegzakken: je herkent een woord maanden nadat je het niet meer kunt
 * oproepen. Eén kaart voor allebei betekent dat de planning van de makkelijke
 * kant de moeilijke kant meesleept, en dat je productie overschat.
 *
 * `card` zet daar een laag tussen: één rij per (soort, item, context). De
 * FSRS-toestand hangt vanaf nu aan de kaart, niet aan het item.
 *
 * ── Wat dit níet doet ──────────────────────────────────────────────────────
 * Er worden geen nieuwe kaarten aangemaakt. Elk bestaand item houdt exact één
 * kaart, van zijn standaardsoort, met dezelfde vervaldatum. De splitsing in
 * herkennen/produceren is Fase 1; deze migratie maakt hem alleen mogelijk.
 *
 * `context` is leeg voor gewone kaarten en draagt later de zin waaruit een woord
 * gemijnd is. Bewust een lege tekst en niet NULL: in een UNIQUE-index zijn twee
 * NULL-waarden in SQLite van elkaar verschillend, dus met NULL zou dezelfde
 * kaart twee keer aangemaakt kunnen worden.
 */

/** Welke kaartsoort een item krijgt als er niets anders gevraagd wordt. */
const STANDAARD_SOORT: Record<string, string> = {
  vocab: "LEX_RECOG",
  grammar: "GRAM",
  form: "FORM",
};

const KOLOMMEN = [
  "due",
  "stability",
  "difficulty",
  "elapsed_days",
  "scheduled_days",
  "reps",
  "lapses",
  "state",
  "learning_steps",
  "last_review",
] as const;

export function up(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE card (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      item_id TEXT NOT NULL REFERENCES items(id),
      context TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX card_uniek_idx ON card(kind, item_id, context);
    CREATE INDEX card_item_idx ON card(item_id);
  `);

  const nu = Date.now();
  const maakKaart = sqlite.prepare(
    `INSERT INTO card (kind, item_id, context, created_at) VALUES (?, ?, '', ?)
     ON CONFLICT (kind, item_id, context) DO NOTHING`,
  );
  const zoekKaart = sqlite.prepare(
    `SELECT id FROM card WHERE kind = ? AND item_id = ? AND context = ''`,
  );

  /** Kaart-id voor een item, aangemaakt als hij er nog niet is. */
  const kaartVoor = (itemId: string, itemKind: string): number | null => {
    const soort = STANDAARD_SOORT[itemKind];
    if (!soort) return null;
    maakKaart.run(soort, itemId, nu);
    const rij = zoekKaart.get(soort, itemId) as { id: number } | undefined;
    return rij?.id ?? null;
  };

  // 1. Een kaart voor elk item dat SRS-toestand heeft.
  const bestaand = sqlite
    .prepare(
      `SELECT s.*, i.kind AS item_kind FROM srs s JOIN items i ON i.id = s.item_id`,
    )
    .all() as (Record<string, number | null> & { item_id: string; item_kind: string })[];

  const kaartPerItem = new Map<string, number>();
  for (const rij of bestaand) {
    const kaartId = kaartVoor(rij.item_id, rij.item_kind);
    if (kaartId !== null) kaartPerItem.set(rij.item_id, kaartId);
  }

  // 2. Ook voor items die alleen nog in het reviewlogboek voorkomen. Zonder dit
  //    zou historie van een item waarvan de kaart ooit is opgeruimd verdwijnen,
  //    en juist die historie is waar de FSRS-parameters later op geijkt worden.
  const uitLog = sqlite
    .prepare(
      `SELECT DISTINCT r.item_id, i.kind AS item_kind
         FROM review_log r JOIN items i ON i.id = r.item_id`,
    )
    .all() as { item_id: string; item_kind: string }[];
  for (const rij of uitLog) {
    if (kaartPerItem.has(rij.item_id)) continue;
    const kaartId = kaartVoor(rij.item_id, rij.item_kind);
    if (kaartId !== null) kaartPerItem.set(rij.item_id, kaartId);
  }

  // 3. srs herbouwen op card_id. SQLite kan geen primaire sleutel omkatten, dus
  //    dit gaat via een nieuwe tabel — de standaardmanier, en met dertig rijen
  //    kost het niets.
  sqlite.exec(`
    CREATE TABLE srs_nieuw (
      card_id INTEGER PRIMARY KEY REFERENCES card(id),
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
  `);

  const zetSrs = sqlite.prepare(
    `INSERT INTO srs_nieuw (card_id, ${KOLOMMEN.join(", ")})
     VALUES (?, ${KOLOMMEN.map(() => "?").join(", ")})`,
  );
  for (const rij of bestaand) {
    const kaartId = kaartPerItem.get(rij.item_id);
    if (kaartId === undefined) continue; // item van onbekende soort — overslaan
    zetSrs.run(kaartId, ...KOLOMMEN.map((k) => rij[k] ?? null));
  }

  sqlite.exec(`
    DROP TABLE srs;
    ALTER TABLE srs_nieuw RENAME TO srs;
    CREATE INDEX srs_due_idx ON srs(due);
  `);

  // 4. review_log op dezelfde manier.
  sqlite.exec(`
    CREATE TABLE review_log_nieuw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES card(id),
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
  `);

  const logRijen = sqlite.prepare(`SELECT * FROM review_log ORDER BY id`).all() as (Record<
    string,
    number
  > & { item_id: string })[];
  const zetLog = sqlite.prepare(
    `INSERT INTO review_log_nieuw
       (id, card_id, rating, state, due, stability, difficulty,
        elapsed_days, last_elapsed_days, scheduled_days, reviewed_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const rij of logRijen) {
    const kaartId = kaartPerItem.get(rij.item_id);
    if (kaartId === undefined) continue;
    zetLog.run(
      rij.id,
      kaartId,
      rij.rating,
      rij.state,
      rij.due,
      rij.stability,
      rij.difficulty,
      rij.elapsed_days,
      rij.last_elapsed_days,
      rij.scheduled_days,
      rij.reviewed_at,
      rij.duration_ms,
    );
  }

  sqlite.exec(`
    DROP TABLE review_log;
    ALTER TABLE review_log_nieuw RENAME TO review_log;
    CREATE INDEX review_log_card_idx ON review_log(card_id);
  `);
}
