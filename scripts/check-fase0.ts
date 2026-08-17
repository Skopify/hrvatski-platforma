/**
 * Acceptatietests voor Fase 0. Draai met: npm run check:fase0
 *
 * Deze tests zijn geschreven vóórdat er ook maar één regel van Fase 0 bestond.
 * Dat is met opzet: een acceptatietest die je achteraf schrijft, test wat je
 * gebouwd hebt in plaats van wat je beloofd had.
 *
 * Er wordt nooit tegen de echte database gedraaid. Elke test krijgt een kopie in
 * de systeemtempmap, via HRVATSKI_DB. Punt 1 controleert juist dat een échte,
 * gevulde database de migratie ongeschonden doorkomt — dus die kopie is een
 * kopie van jouw data, en na afloop weggegooid.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const REAL_DB = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-fase0-"));

interface Result {
  punt: string;
  naam: string;
  ok: boolean;
  detail: string;
}
const results: Result[] = [];

function report(punt: string, naam: string, ok: boolean, detail: string) {
  results.push({ punt, naam, ok, detail });
}

/** Voert een test uit; een uitzondering (ook een ontbrekende module) is een fout. */
async function test(punt: string, naam: string, fn: () => Promise<string> | string) {
  try {
    const detail = await fn();
    report(punt, naam, true, detail);
  } catch (err) {
    report(punt, naam, false, err instanceof Error ? err.message : String(err));
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Een consistente kopie van de echte database, WAL en al. */
async function copyRealDb(name: string): Promise<string> {
  assert(fs.existsSync(REAL_DB), `data/hrvatski.db bestaat niet — draai eerst npm run seed`);
  const dest = path.join(TMP, name);
  const src = new Database(REAL_DB, { readonly: true });
  await src.backup(dest);
  src.close();
  return dest;
}

/**
 * Eén werkkopie voor alle tests die de applicatiemodules gebruiken.
 *
 * De eerste opzet gaf elke test zijn eigen database, met een querystring achter
 * de import om de modulecache te omzeilen. Dat werkt niet: alleen de módule die
 * je zo importeert is vers, zijn afhankelijkheden niet. Het db-singleton bleef
 * dus wijzen naar het bestand van de eerste test, en tests die dachten hun eigen
 * database te controleren, keken naar die van een ander. Twee ervan slaagden om
 * de verkeerde reden.
 *
 * Nu is er één werkkopie, en iedereen — de applicatiemodules én de losse
 * SQLite-handles waarmee gecontroleerd wordt — kijkt naar hetzelfde bestand.
 * Test 1 doet niet mee: die bouwt zijn eigen databases en geeft de verbinding
 * expliciet mee, zonder het singleton aan te raken.
 */
const WERK_DB = path.join(TMP, "werk.db");
{
  const src = new Database(REAL_DB, { readonly: true });
  await src.backup(WERK_DB);
  src.close();
}
process.env.HRVATSKI_DB = WERK_DB;

/** Dezelfde specifier bij elke aanroep: de modulegraaf mag juist gedeeld zijn. */
function fresh(mod: string): string {
  return mod;
}

/**
 * Een test draaien tegen een database. Het pad is er om bij het lezen duidelijk
 * te maken wélke database een test gebruikt; kiezen doet het niet meer. Het
 * db-singleton staat op WERK_DB en blijft daar, en punt 1 geeft zijn eigen
 * verbinding expliciet mee.
 */
async function withDb<T>(_db: string, fn: () => Promise<T>): Promise<T> {
  return fn();
}

/* ══════════════════════════════════════════════════════ 1. migraties ══ */

/**
 * Een database van vóór de herbouw, met bekende inhoud.
 *
 * Bewust opgebouwd in plaats van jouw echte database gekopieerd. Die is inmiddels
 * gemigreerd en kan dus nooit meer als "toestand ervóór" dienen — en een test die
 * afhangt van de toevallige staat van iemands data is geen test. Dit draait op
 * elke machine, elke keer, met dezelfde uitkomst.
 */
async function bouwOudeDatabase(naam: string) {
  const file = path.join(TMP, naam);
  const d = new Database(file);
  const { MIGRATIES } = await import(fresh("../src/lib/db/migrate"));
  // Alleen migratie 001: dat ís het oude schema.
  const basis = MIGRATIES.find((m: { id: number }) => m.id === 1)!;
  basis.up(d);

  const items: [string, string][] = [
    ["v.01.kuca", "vocab"],
    ["v.01.grad", "vocab"],
    ["g.10.lokativ", "grammar"],
    ["f.kuca.loc.sg", "form"],
  ];
  const zetItem = d.prepare(
    `INSERT INTO items (id, kind, lesson, topic, grammatical_case, cefr, label, payload)
     VALUES (?, ?, 1, 'Test', NULL, 'A1.1', ?, '{}')`,
  );
  for (const [id, kind] of items) zetItem.run(id, kind, id);

  // Vier kaarten met uiteenlopende, herkenbare planning.
  const srsRijen = items.map(([id], i) => ({
    item_id: id,
    due: 1_800_000_000_000 + i * 86_400_000,
    stability: 3.5 + i,
    difficulty: 5.1 + i,
    elapsed_days: i,
    scheduled_days: i + 1,
    reps: i + 2,
    lapses: i,
    state: 2,
    learning_steps: 0,
    last_review: 1_700_000_000_000 + i,
  }));
  const zetSrs = d.prepare(
    `INSERT INTO srs (item_id, due, stability, difficulty, elapsed_days, scheduled_days,
                      reps, lapses, state, learning_steps, last_review)
     VALUES (@item_id, @due, @stability, @difficulty, @elapsed_days, @scheduled_days,
             @reps, @lapses, @state, @learning_steps, @last_review)`,
  );
  for (const r of srsRijen) zetSrs.run(r);

  // Eén reviewregel voor een item dat géén srs-rij heeft: die historie mag ook
  // niet wegvallen, want daar worden de FSRS-parameters later op geijkt.
  const zetLog = d.prepare(
    `INSERT INTO review_log (item_id, rating, state, due, stability, difficulty,
                             elapsed_days, last_elapsed_days, scheduled_days, reviewed_at, duration_ms)
     VALUES (?, 3, 2, ?, 4.0, 5.0, 1, 1, 2, ?, 1500)`,
  );
  zetLog.run("v.01.kuca", 1_800_000_000_000, 1_700_000_000_000);
  zetLog.run("v.01.kuca", 1_800_100_000_000, 1_700_100_000_000);
  zetLog.run("v.01.grad", 1_800_200_000_000, 1_700_200_000_000);

  d.close();
  return { file, srsRijen, logAantal: 3 };
}

await test("1", "Migratie behoudt alle voortgang van een database van vóór de herbouw", async () => {
  const { file, srsRijen, logAantal } = await bouwOudeDatabase("oud.db");
  const voorSrs = srsRijen
    .map((r) => ({
      item_id: r.item_id,
      due: r.due,
      stability: r.stability,
      reps: r.reps,
      lapses: r.lapses,
      state: r.state,
    }))
    .sort((a, b) => a.item_id.localeCompare(b.item_id));
  const voorLog = logAantal;
  const kopie = file;

  const { versie, toegepast } = await withDb(kopie, async () => {
    const { migrate, LATEST_VERSION } = await import(fresh("../src/lib/db/migrate"));
    const sqlite = new Database(kopie);
    const uitkomst = migrate(sqlite);
    assert(
      uitkomst.versie === LATEST_VERSION,
      `versie na migratie is ${uitkomst.versie}, verwacht ${LATEST_VERSION}`,
    );
    sqlite.close();
    return { versie: uitkomst.versie, toegepast: uitkomst.toegepast };
  });

  // Na de migratie hangt elke kaart aan een card-rij, met dezelfde planning.
  const na = new Database(kopie, { readonly: true });
  const naSrs = na
    .prepare(
      `SELECT c.item_id, s.due, s.stability, s.reps, s.lapses, s.state
         FROM srs s JOIN card c ON c.id = s.card_id
        ORDER BY c.item_id`,
    )
    .all() as typeof voorSrs;
  const naLog = (na.prepare("SELECT count(*) n FROM review_log").get() as { n: number }).n;
  const logZonderKaart = (
    na
      .prepare("SELECT count(*) n FROM review_log r LEFT JOIN card c ON c.id = r.card_id WHERE c.id IS NULL")
      .get() as { n: number }
  ).n;
  na.close();

  assert(
    naSrs.length === voorSrs.length,
    `${voorSrs.length} kaarten vóór, ${naSrs.length} erna`,
  );
  for (let i = 0; i < voorSrs.length; i++) {
    const a = voorSrs[i]!;
    const b = naSrs[i]!;
    assert(
      a.item_id === b.item_id && a.due === b.due && a.stability === b.stability &&
        a.reps === b.reps && a.lapses === b.lapses && a.state === b.state,
      `kaart ${a.item_id} is veranderd: due ${a.due} → ${b.due}, reps ${a.reps} → ${b.reps}`,
    );
  }
  assert(naLog === voorLog, `${voorLog} reviewregels vóór, ${naLog} erna`);
  assert(logZonderKaart === 0, `${logZonderKaart} reviewregels wijzen nergens meer heen`);

  return `${voorSrs.length} kaarten en ${voorLog} reviewregels ongewijzigd; ${toegepast.length} migratie(s) toegepast, versie ${versie}`;
});

await test("1", "Jouw eigen database is heel en op de laatste versie", async () => {
  const { LATEST_VERSION } = await import(fresh("../src/lib/db/migrate"));
  const d = new Database(REAL_DB, { readonly: true });

  const versie = (d.prepare("SELECT max(id) AS v FROM schema_migrations").get() as { v: number })
    .v;
  const kaarten = (d.prepare("SELECT count(*) n FROM card").get() as { n: number }).n;
  const srsRijen = (d.prepare("SELECT count(*) n FROM srs").get() as { n: number }).n;
  const logRijen = (d.prepare("SELECT count(*) n FROM review_log").get() as { n: number }).n;
  const losseSrs = (
    d
      .prepare("SELECT count(*) n FROM srs s LEFT JOIN card c ON c.id = s.card_id WHERE c.id IS NULL")
      .get() as { n: number }
  ).n;
  const losseKaarten = (
    d
      .prepare("SELECT count(*) n FROM card c LEFT JOIN items i ON i.id = c.item_id WHERE i.id IS NULL")
      .get() as { n: number }
  ).n;
  const losseLog = (
    d
      .prepare("SELECT count(*) n FROM review_log r LEFT JOIN card c ON c.id = r.card_id WHERE c.id IS NULL")
      .get() as { n: number }
  ).n;
  const integriteit = (d.pragma("integrity_check") as { integrity_check: string }[])[0]
    ?.integrity_check;
  d.close();

  assert(versie === LATEST_VERSION, `staat op versie ${versie}, verwacht ${LATEST_VERSION}`);
  assert(integriteit === "ok", `integriteitscontrole zegt: ${integriteit}`);
  assert(srsRijen === kaarten, `${srsRijen} SRS-rijen op ${kaarten} kaarten`);
  assert(losseSrs === 0, `${losseSrs} SRS-rijen zonder kaart`);
  assert(losseKaarten === 0, `${losseKaarten} kaarten zonder item`);
  assert(losseLog === 0, `${losseLog} reviewregels zonder kaart`);

  return `versie ${versie} · ${kaarten} kaarten · ${logRijen} reviewregels · geen losse verwijzingen`;
});

await test("1", "Migratie op een lege database geeft hetzelfde schema", async () => {
  const leeg = path.join(TMP, "leeg.db");
  const bestaand = await copyRealDb("vergelijk.db");

  const schemaVan = (file: string): string[] => {
    const d = new Database(file, { readonly: true });
    const rijen = d
      .prepare(
        `SELECT type, name, sql FROM sqlite_master
          WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
      )
      .all() as { type: string; name: string; sql: string | null }[];
    d.close();
    // Whitespace normaliseren: de ene tabel komt uit DDL, de andere uit ALTER.
    return rijen.map((r) => `${r.type} ${r.name} ${(r.sql ?? "").replace(/\s+/g, " ").trim()}`);
  };

  const versies = await withDb(leeg, async () => {
    const { migrate } = await import(fresh("../src/lib/db/migrate"));
    const a = new Database(leeg);
    const va = migrate(a).versie;
    a.close();
    const b = new Database(bestaand);
    const vb = migrate(b).versie;
    b.close();
    return { va, vb };
  });

  assert(versies.va === versies.vb, `lege database op ${versies.va}, bestaande op ${versies.vb}`);

  const schemaLeeg = schemaVan(leeg);
  const schemaBestaand = schemaVan(bestaand);
  const alleenLeeg = schemaLeeg.filter((s) => !schemaBestaand.includes(s));
  const alleenBestaand = schemaBestaand.filter((s) => !schemaLeeg.includes(s));
  assert(
    alleenLeeg.length === 0 && alleenBestaand.length === 0,
    `schema's lopen uiteen:\n      alleen in leeg: ${alleenLeeg.join(", ") || "—"}\n      alleen in bestaand: ${alleenBestaand.join(", ") || "—"}`,
  );

  return `beide op versie ${versies.va}, ${schemaLeeg.length} schema-objecten identiek`;
});

await test("1", "Migreren is herhaalbaar", async () => {
  const kopie = await copyRealDb("nogmaals.db");
  return withDb(kopie, async () => {
    const { migrate } = await import(fresh("../src/lib/db/migrate"));
    const d = new Database(kopie);
    const eerste = migrate(d);
    const tweede = migrate(d);
    const derde = migrate(d);
    d.close();
    assert(
      tweede.toegepast.length === 0 && derde.toegepast.length === 0,
      `tweede ronde paste ${tweede.toegepast.length} migraties toe, derde ${derde.toegepast.length}`,
    );
    return `eerste ronde ${eerste.toegepast.length} migratie(s), daarna niets meer`;
  });
});

/* ════════════════════════════════════════ 2. twee kaarten per woord ══ */

await test("2", "Eén woord draagt twee onafhankelijk geplande kaarten", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { ensureCards, applyReview } = await import(fresh("../src/lib/srs"));
    const { Rating } = await import("ts-fsrs");

    const woord = "v.01.kuca";
    const [herkennen] = ensureCards([woord], "LEX_RECOG");
    const [produceren] = ensureCards([woord], "LEX_PROD");

    assert(typeof herkennen === "number" && typeof produceren === "number", "geen kaart-id's gekregen");
    assert(herkennen !== produceren, `beide kaarten kregen id ${herkennen}`);

    // Verschillend beoordelen moet verschillende planning geven.
    applyReview(herkennen, Rating.Easy, 2000);
    applyReview(produceren, Rating.Again, 20000);

    const d = new Database(kopie, { readonly: true });
    const rijen = d
      .prepare(
        `SELECT c.kind, s.due, s.state, s.lapses FROM srs s
           JOIN card c ON c.id = s.card_id WHERE c.item_id = ? ORDER BY c.kind`,
      )
      .all(woord) as { kind: string; due: number; state: number; lapses: number }[];
    d.close();

    assert(rijen.length === 2, `${rijen.length} kaarten voor ${woord}, verwacht 2`);
    const prod = rijen.find((r) => r.kind === "LEX_PROD")!;
    const rec = rijen.find((r) => r.kind === "LEX_RECOG")!;
    assert(rec.due !== prod.due, "beide kaarten vervallen op hetzelfde moment");
    assert(
      rec.due > prod.due,
      "de kaart die goed ging vervalt niet later dan de kaart die fout ging",
    );

    const dagen = Math.round((rec.due - prod.due) / 86_400_000);
    return `LEX_RECOG en LEX_PROD apart gepland, ${dagen} dag(en) uit elkaar`;
  });
});

await test("2", "Bestaand gedrag blijft: een oefening maakt één kaart", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { ensureCards } = await import(fresh("../src/lib/srs"));
    // Zonder soort: de standaardsoort voor dit item. Twee keer aanroepen mag geen
    // tweede kaart opleveren — anders verdubbelt de herhaallast bij elke sessie.
    const eerste = ensureCards(["v.01.kuca", "g.10.lokativ"]);
    const tweede = ensureCards(["v.01.kuca", "g.10.lokativ"]);
    assert(
      eerste.length === 2 && tweede.length === 2,
      `${eerste.length} en ${tweede.length} kaarten terug, verwacht 2 en 2`,
    );
    assert(
      eerste[0] === tweede[0] && eerste[1] === tweede[1],
      "tweede aanroep gaf andere kaart-id's — ensureCards is niet idempotent",
    );
    return "standaardsoort per item, idempotent";
  });
});

/* ═══════════════════════════════════════════ 3. foutclassificatie ══ */

await test("3", "Akkusatief waar de lokatief moest, wordt herkend als naamvalsfout", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { classifyError } = await import(fresh("../src/lib/errors"));

    const uitkomst = classifyError({
      exerciseId: "test.lokativ",
      type: "cloze",
      targets: ["v.01.kuca", "g.10.lokativ"],
      expected: "kući",
      given: "kuću",
    });

    assert(
      uitkomst.type === "wrong_case",
      `foutsoort is "${uitkomst.type}", verwacht "wrong_case"`,
    );
    assert(
      uitkomst.lemmaId === "v.01.kuca",
      `lemma is "${uitkomst.lemmaId}", verwacht "v.01.kuca"`,
    );
    assert(
      uitkomst.grammarPointId === "g.10.lokativ",
      `grammaticapunt is "${uitkomst.grammarPointId}", verwacht "g.10.lokativ"`,
    );
    assert(
      uitkomst.expectedFeatures?.case === "loc" && uitkomst.givenFeatures?.case === "acc",
      `naamvallen niet herkend: verwacht loc/acc, kreeg ${uitkomst.expectedFeatures?.case}/${uitkomst.givenFeatures?.case}`,
    );
    return `wrong_case · ${uitkomst.expectedFeatures?.case} verwacht, ${uitkomst.givenFeatures?.case} gegeven`;
  });
});

await test("3", "De classificatie levert een hint die het antwoord niet weggeeft", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { classifyError, hintFor } = await import(fresh("../src/lib/errors"));
    const uitkomst = classifyError({
      exerciseId: "test.lokativ",
      type: "cloze",
      targets: ["v.01.kuca", "g.10.lokativ"],
      expected: "kući",
      given: "kuću",
    });
    const hint = hintFor(uitkomst);

    assert(typeof hint === "string" && hint.length > 0, "geen hint gekregen");
    // Trede 1 van de escalatie is metalinguïstisch: hij benoemt de categorie,
    // niet de vorm. Staat het antwoord erin, dan is het geen hint maar een
    // oplossing en is de hele escalatie zinloos.
    assert(
      !hint.toLowerCase().includes("kući"),
      `de hint verklapt het antwoord: "${hint}"`,
    );
    assert(
      /locatief|lokativ/i.test(hint),
      `de hint benoemt de naamval niet: "${hint}"`,
    );
    return `"${hint}"`;
  });
});

await test("3", "Een fout belandt in error_log met zijn ontleding", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { classifyError, recordError } = await import(fresh("../src/lib/errors"));
    const uitkomst = classifyError({
      exerciseId: "test.lokativ",
      type: "cloze",
      targets: ["v.01.kuca", "g.10.lokativ"],
      expected: "kući",
      given: "kuću",
    });
    recordError(uitkomst, { exerciseId: "test.lokativ", expected: "kući", given: "kuću" });

    const d = new Database(kopie, { readonly: true });
    const rij = d
      .prepare("SELECT * FROM error_log ORDER BY id DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    d.close();

    assert(rij, "geen regel in error_log");
    assert(rij.error_type === "wrong_case", `error_type is ${rij.error_type}`);
    assert(rij.grammar_point_id === "g.10.lokativ", `grammar_point_id is ${rij.grammar_point_id}`);
    assert(rij.expected === "kući" && rij.given === "kuću", "verwacht/gegeven niet bewaard");
    return `error_log: ${rij.error_type} op ${rij.grammar_point_id}`;
  });
});

await test("3", "Een fout antwoord in een échte oefening wordt onderweg ontleed", async () => {
  const kopie = WERK_DB;
  return withDb(kopie, async () => {
    // Niet via de browser: dat zou een oefenpoging in de echte voortgang zetten
    // en de planning van die woorden verschuiven. Dit roept dezelfde serveractie
    // aan die de knop "Nakijken" aanroept, maar tegen de werkkopie.
    const { submitAnswer } = await import(fresh("../src/app/actions"));
    const { loadLessons, lessonExercises } = await import(fresh("../src/lib/content"));

    // Een invuloefening zoeken die een naamvalsvorm vraagt van een woord dat de
    // vormcatalogus kent — anders toets je de classificatie op een leeg geval.
    const { readingsFor } = await import(fresh("../src/lib/forms"));
    let doelwit: { id: string; answer: string; fout: string } | null = null;
    for (const les of loadLessons()) {
      for (const oef of lessonExercises(les)) {
        if (oef.type !== "cloze" || !oef.answer) continue;
        const lezingen = readingsFor(oef.answer);
        if (!lezingen.length) continue;
        // Een andere vorm van hetzelfde woord als fout antwoord.
        const lemma = lezingen[0].lemmaId;
        const anders = readingsFor(oef.answer).length
          ? [...(await import(fresh("../src/lib/forms"))).formIndex().values()]
              .flat()
              .find(
                (l: { lemmaId: string; surface: string }) =>
                  l.lemmaId === lemma && l.surface.toLowerCase() !== oef.answer!.toLowerCase(),
              )
          : null;
        if (!anders) continue;
        doelwit = { id: oef.id, answer: oef.answer, fout: anders.surface };
        break;
      }
      if (doelwit) break;
    }
    assert(doelwit, "geen geschikte invuloefening gevonden om een fout op te maken");

    const d0 = new Database(kopie, { readonly: true });
    const voor = (d0.prepare("SELECT count(*) n FROM error_log").get() as { n: number }).n;
    d0.close();

    const feedback = await submitAnswer(doelwit.id, { kind: "text", value: doelwit.fout }, 5000);
    assert(feedback.correct === false, `"${doelwit.fout}" werd goed gerekend`);

    const d = new Database(kopie, { readonly: true });
    const na = (d.prepare("SELECT count(*) n FROM error_log").get() as { n: number }).n;
    const rij = d.prepare("SELECT * FROM error_log ORDER BY id DESC LIMIT 1").get() as Record<
      string,
      unknown
    >;
    d.close();

    assert(na === voor + 1, `${na - voor} regels erbij in error_log, verwacht 1`);
    assert(rij.exercise_id === doelwit.id, `verkeerde oefening gelogd: ${rij.exercise_id}`);
    assert(rij.error_type !== "unknown", "de fout kon niet geclassificeerd worden");

    // attempt_id is hier bewust leeg. Sinds Fase 0.5 escaleert de feedback: een
    // eerste misser levert een hint op en nog géén poging, want een oefening
    // telt pas als hij is opgelost. Fout en poging hebben daardoor een
    // verschillende korrel — meerdere missers kunnen aan één oplossing
    // voorafgaan — en alleen de laatste, waarbij het antwoord getoond wordt,
    // draagt een attempt_id.
    assert(
      rij.attempt_id === null,
      `een eerste misser hoort nog geen poging te hebben (attempt_id = ${rij.attempt_id})`,
    );

    return `${doelwit.id}: "${doelwit.fout}" voor "${doelwit.answer}" → ${rij.error_type}`;
  });
});

/* ══════════════════════════════════════════════════ 4. analyze() ══ */

await test("4", "analyze() geeft lemma en naamval voor beide vormen van kuća", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { analyze } = await import(fresh("../src/lib/analyze"));
    const tokens = analyze("Idem u kuću jer je moja sestra kod kuće.");

    const kucu = tokens.find((t: { surface: string }) => t.surface.toLowerCase() === "kuću");
    const kuce = tokens.find((t: { surface: string }) => t.surface.toLowerCase() === "kuće");

    assert(kucu, "kuću niet teruggevonden in de ontleding");
    assert(kuce, "kuće niet teruggevonden in de ontleding");

    assert(kucu.lemma === "kuća", `kuću → lemma "${kucu.lemma}", verwacht "kuća"`);
    assert(
      kucu.feats?.case === "acc" && kucu.feats?.number === "sg",
      `kuću → ${kucu.feats?.case}/${kucu.feats?.number}, verwacht acc/sg`,
    );
    assert(kucu.unknown === false, "kuću staat ten onrechte als onbekend");

    assert(kuce.lemma === "kuća", `kuće → lemma "${kuce.lemma}", verwacht "kuća"`);
    // kuće is genitief ev, nominatief mv én akkusatief mv. Na «kod» kan het
    // alleen de genitief zijn — dat is precies de kennis die de rest van het
    // platform onderwijst, dus die hoort de ontleder ook te hebben.
    assert(
      kuce.feats?.case === "gen",
      `kuće na «kod» → ${kuce.feats?.case}, verwacht gen (voorzetsel niet meegewogen?)`,
    );
    assert(
      Array.isArray(kuce.readings) && kuce.readings.length > 1,
      "de meerduidigheid van kuće wordt niet bewaard",
    );

    return `kuću → acc.sg · kuće → gen.sg uit ${kuce.readings.length} lezingen`;
  });
});

await test("4", "analyze() markeert wat het niet thuis kan brengen", async () => {
  const kopie = WERK_DB;
  return withDb(WERK_DB, async () => {
    const { analyze } = await import(fresh("../src/lib/analyze"));
    const tokens = analyze("Idem u kuću sa zvrkoplovom.");
    const verzonnen = tokens.find((t: { surface: string }) => t.surface.toLowerCase() === "zvrkoplovom");

    assert(verzonnen, "het verzonnen woord kwam niet terug uit de ontleding");
    assert(
      verzonnen.unknown === true,
      "een woord dat niet bestaat wordt als bekend geteld — precies de overschatting die de vlag moet voorkomen",
    );
    assert(verzonnen.lemma === null, `lemma is "${verzonnen.lemma}", verwacht null`);

    const bekend = tokens.find((t: { surface: string }) => t.surface.toLowerCase() === "kuću");
    assert(bekend?.unknown === false, "een bekend woord wordt als onbekend gemarkeerd");

    return `1 van ${tokens.length} tokens als onbekend gemarkeerd`;
  });
});

/* ═══════════════════════════════════════════════════ verslag ══ */

fs.rmSync(TMP, { recursive: true, force: true });

const perPunt = new Map<string, Result[]>();
for (const r of results) {
  const lijst = perPunt.get(r.punt);
  if (lijst) lijst.push(r);
  else perPunt.set(r.punt, [r]);
}

const TITELS: Record<string, string> = {
  "1": "Migratie behoudt alle voortgang",
  "2": "Eén woord kan meer dan één kaart dragen",
  "3": "Fouten worden ontleed in plaats van geteld",
  "4": "analyze() met eerlijke onbekend-vlag",
};

console.log("\nAcceptatie Fase 0\n" + "─".repeat(64));
for (const [punt, lijst] of [...perPunt].sort()) {
  console.log(`\n${punt}. ${TITELS[punt] ?? ""}`);
  for (const r of lijst) {
    console.log(`   ${r.ok ? "✓" : "✗"} ${r.naam}`);
    console.log(`     ${r.detail.replace(/\n/g, "\n     ")}`);
  }
}

const gezakt = results.filter((r) => !r.ok);
console.log("\n" + "─".repeat(64));
console.log(`${results.length - gezakt.length} van ${results.length} geslaagd.`);
if (gezakt.length) {
  console.log(`\nPunt 5 (tsc, check, check:content, les 1 spelen) is pas zinvol als 1 t/m 4 staan.`);
  process.exit(1);
}
