/**
 * Acceptatietests voor Fase 1 — de woordenschatsectie.
 * Draai met: npm run check:fase1
 *
 * Wat hier bewezen moet worden, is dat "een woord kennen" een traject is en geen
 * schakelaar. Een woord begint als herkenning (kuća → huis), wordt pas een
 * clozekaart als die herkenning stevig staat, en pas daarna productie
 * (huis → kuća). Promoveren op het verkeerde moment is de klassieke faalmodus:
 * je krijgt productiekaarten van woorden die je nog niet eens herkent, en dan
 * stapelt de achterstand zich op.
 *
 * Draait tegen een kopie van de database, nooit tegen je eigen voortgang.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const REAL_DB = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-fase1-"));
const WERK_DB = path.join(TMP, "werk.db");
{
  const src = new Database(REAL_DB, { readonly: true });
  await src.backup(WERK_DB);
  src.close();
}
process.env.HRVATSKI_DB = WERK_DB;

interface Result {
  punt: string;
  naam: string;
  ok: boolean;
  detail: string;
}
const results: Result[] = [];

async function test(punt: string, naam: string, fn: () => Promise<string> | string) {
  try {
    results.push({ punt, naam, ok: true, detail: await fn() });
  } catch (err) {
    results.push({
      punt,
      naam,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const dag = 86_400_000;

/** Een schoon woord zonder kaarten, zodat tests elkaar niet in de weg zitten. */
let teller = 0;
function versWoord(): string {
  const d = new Database(WERK_DB, { readonly: true });
  const rijen = d
    .prepare(
      `SELECT i.id FROM items i
        LEFT JOIN card c ON c.item_id = i.id
        WHERE i.kind = 'vocab' AND c.id IS NULL
        ORDER BY i.id LIMIT 200`,
    )
    .all() as { id: string }[];
  d.close();
  const gekozen = rijen[teller++];
  assert(gekozen, "geen ongebruikt woord meer beschikbaar in de testdatabase");
  return gekozen.id;
}

/* ═════════════════════════════════════════ 1. de stadialadder ══ */

await test("1", "Een nieuw woord begint bij herkenning, niet bij productie", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { startStage } = await import("../src/lib/stages");
  const woord = versWoord();

  const [kaart] = ensureCards([woord]);
  assert(kaart, "geen kaart aangemaakt");

  const d = new Database(WERK_DB, { readonly: true });
  const soorten = d
    .prepare("SELECT kind FROM card WHERE item_id = ?")
    .all(woord)
    .map((r) => (r as { kind: string }).kind);
  d.close();

  assert(soorten.length === 1, `${soorten.length} kaarten, verwacht 1`);
  assert(soorten[0] === startStage(), `begint bij ${soorten[0]}, verwacht ${startStage()}`);
  return `${woord} → ${soorten[0]}`;
});

await test("1", "Promotie wacht tot de huidige kaart stevig staat", async () => {
  const { ensureCards, applyReview } = await import("../src/lib/srs");
  const { promoteIfReady, PROMOTE_AT } = await import("../src/lib/stages");
  const { Rating } = await import("ts-fsrs");
  const woord = versWoord();

  const [kaart] = ensureCards([woord]);
  // Eén keer goed is niet genoeg: de stabiliteit staat dan nog ver onder de drempel.
  applyReview(kaart!, Rating.Good, 3000);
  const vroeg = promoteIfReady(kaart!);

  const d = new Database(WERK_DB, { readonly: true });
  const stabiliteit = (
    d.prepare("SELECT stability FROM srs WHERE card_id = ?").get(kaart) as { stability: number }
  ).stability;
  const aantal = (
    d.prepare("SELECT count(*) n FROM card WHERE item_id = ?").get(woord) as { n: number }
  ).n;
  d.close();

  assert(
    stabiliteit < PROMOTE_AT,
    `de stabiliteit is al ${stabiliteit.toFixed(1)} dagen — de test bewijst niets`,
  );
  assert(vroeg === null, `er is te vroeg gepromoveerd naar ${vroeg}`);
  assert(aantal === 1, `${aantal} kaarten na één review, verwacht 1`);

  return `stabiliteit ${stabiliteit.toFixed(1)} dagen < drempel ${PROMOTE_AT} → geen promotie`;
});

await test("1", "Boven de drempel komt de volgende kaart er wél", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { promoteIfReady, PROMOTE_AT, nextStage, startStage } = await import("../src/lib/stages");
  const woord = versWoord();

  const { canBuild } = await import("../src/lib/stages");
  const [kaart] = ensureCards([woord]);
  // Rechtstreeks een stevige toestand zetten: dit test de promotieregel, niet
  // FSRS. Difficulty moet mee — FSRS-6 weigert een toestand met difficulty 0,
  // en een halve toestand achterlaten laat latere tests struikelen.
  const d0 = new Database(WERK_DB);
  d0.prepare(
    "UPDATE srs SET stability = ?, difficulty = 5, state = 2, reps = 5 WHERE card_id = ?",
  ).run(PROMOTE_AT + 5, kaart);
  d0.close();

  const nieuw = promoteIfReady(kaart!);
  assert(nieuw !== null, "er is niet gepromoveerd terwijl de kaart stevig staat");

  const d = new Database(WERK_DB, { readonly: true });
  const soorten = d
    .prepare("SELECT kind FROM card WHERE item_id = ? ORDER BY id")
    .all(woord)
    .map((r) => (r as { kind: string }).kind);
  d.close();

  // Het volgende stadium is CLOZE — tenzij er voor dit woord geen bronzin
  // bestaat, en dan hoort het overgeslagen te worden. Een clozekaart zonder zin
  // is een kaart zonder vraag, en die hoort niet in de planning.
  const direct = nextStage(startStage())!;
  const verwacht = canBuild(woord, direct) ? direct : nextStage(direct)!;
  assert(soorten.length === 2, `${soorten.length} kaarten, verwacht 2`);
  assert(
    soorten[1] === verwacht,
    `gepromoveerd naar ${soorten[1]}, verwacht ${verwacht}` +
      (verwacht !== direct ? ` (${direct} overgeslagen: geen bronzin)` : ""),
  );

  // Twee keer promoveren mag geen derde kaart van dezelfde soort geven.
  promoteIfReady(kaart!);
  const d2 = new Database(WERK_DB, { readonly: true });
  const opnieuw = (
    d2.prepare("SELECT count(*) n FROM card WHERE item_id = ?").get(woord) as { n: number }
  ).n;
  d2.close();
  assert(opnieuw === 2, `${opnieuw} kaarten na twee keer promoveren, verwacht 2`);

  return `${startStage()} → ${soorten[1]}, idempotent`;
});

/* ═══════════════════════════════════════════════ 2. leeches ══ */

await test("2", "Een woord dat blijft mislukken valt uit de rotatie", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { LEECH_AT, checkLeech, isSuspended } = await import("../src/lib/stages");
  const woord = versWoord();

  const [kaart] = ensureCards([woord]);
  const d0 = new Database(WERK_DB);
  d0.prepare("UPDATE srs SET lapses = ?, state = 3 WHERE card_id = ?").run(LEECH_AT, kaart);
  d0.close();

  const geworden = checkLeech(kaart!);
  assert(geworden, `bij ${LEECH_AT} missers is de kaart geen leech genoemd`);
  assert(isSuspended(kaart!), "de kaart is niet uit de rotatie gehaald");

  return `${LEECH_AT} missers → uit de rotatie`;
});

await test("2", "Een geschorste kaart komt niet in de herhaling", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { suspend } = await import("../src/lib/stages");
  const { dueCards } = await import("../src/lib/srs");
  const woord = versWoord();

  const [kaart] = ensureCards([woord]);
  // Vervallen zetten, zodat hij zónder schorsing wél zou langskomen.
  const d0 = new Database(WERK_DB);
  d0.prepare("UPDATE srs SET due = ?, state = 2 WHERE card_id = ?").run(Date.now() - dag, kaart);
  d0.close();

  const voor = dueCards(new Date(), 5000).some((c) => c.cardId === kaart);
  assert(voor, "de kaart stond niet in de vervallen lijst — de test bewijst niets");

  suspend(kaart!, "leech");
  const na = dueCards(new Date(), 5000).some((c) => c.cardId === kaart);
  assert(!na, "een geschorste kaart komt nog steeds in de herhaling");

  return "geschorst → uit dueCards()";
});

await test("2", "Herstellen zet de kaart terug, met een schone lei", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { suspend, restore, isSuspended } = await import("../src/lib/stages");
  const woord = versWoord();

  const [kaart] = ensureCards([woord]);
  const d0 = new Database(WERK_DB);
  d0.prepare("UPDATE srs SET lapses = 9 WHERE card_id = ?").run(kaart);
  d0.close();

  suspend(kaart!, "leech");
  restore(kaart!);

  assert(!isSuspended(kaart!), "de kaart is na herstel nog steeds geschorst");
  const d = new Database(WERK_DB, { readonly: true });
  const lapses = (
    d.prepare("SELECT lapses FROM srs WHERE card_id = ?").get(kaart) as { lapses: number }
  ).lapses;
  d.close();
  assert(lapses === 0, `lapses staat op ${lapses}, verwacht 0 na herstel`);

  return "terug in de rotatie, misserteller op nul";
});

/* ══════════════════════════════════ 3. vragen zonder geschreven oefening ══ */

await test("3", "Elke kaartsoort levert een beantwoordbare vraag op", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { questionFor, STAGES } = await import("../src/lib/stages");
  const woord = versWoord();

  const gemaakt: string[] = [];
  for (const soort of STAGES) {
    const [kaart] = ensureCards([woord], soort);
    assert(kaart, `geen kaart van soort ${soort}`);
    const vraag = questionFor(kaart!);
    if (!vraag) continue; // cloze zonder bronzin mag ontbreken
    assert(vraag.prompt.length > 0, `${soort}: lege vraag`);
    assert(vraag.answer.length > 0, `${soort}: geen antwoord`);
    assert(
      !vraag.prompt.toLowerCase().includes(vraag.answer.toLowerCase()),
      `${soort}: het antwoord staat in de vraag — "${vraag.prompt}"`,
    );
    gemaakt.push(`${soort}: ${vraag.prompt.slice(0, 30)}…`);
  }

  assert(gemaakt.length >= 2, `maar ${gemaakt.length} soorten leverden een vraag op`);
  return gemaakt.join(" | ");
});

await test("3", "Herkennen en produceren vragen tegengestelde richtingen", async () => {
  const { ensureCards } = await import("../src/lib/srs");
  const { questionFor } = await import("../src/lib/stages");
  const woord = versWoord();

  const [herken] = ensureCards([woord], "LEX_RECOG");
  const [produceer] = ensureCards([woord], "LEX_PROD");
  const a = questionFor(herken!);
  const b = questionFor(produceer!);

  assert(a && b, "een van beide vragen ontbreekt");
  // De herkenningsvraag toont het Kroatisch en vraagt de betekenis; de
  // productievraag precies andersom. Dat is het hele punt van §1.7.
  assert(
    a.answer.toLowerCase() !== b.answer.toLowerCase(),
    "beide kaarten vragen hetzelfde antwoord — dan meet je twee keer hetzelfde",
  );
  assert(b.mode === "productive", `productiekaart heeft mode ${b.mode}`);
  return `herkennen: "${a.prompt}" → "${a.answer}" · produceren: "${b.prompt}" → "${b.answer}"`;
});

/* ══════════════════════════════════════ 4. dertig dagen simuleren ══ */

await test("4", "Dertig dagen leren geeft een geloofwaardige planning", async () => {
  const { simulate } = await import("../src/lib/simulate");

  const uitkomst = simulate({ dagen: 30, nieuwPerDag: 8, kansGoed: 0.85 });

  // Wat hier bewezen wordt is niet "FSRS werkt" — dat is elders getest — maar
  // dat ónze inrichting eromheen geen onzin oplevert.
  assert(uitkomst.reviews > 0, "er is in dertig dagen niets herhaald");
  assert(
    uitkomst.geleerd >= 30 * 8 * 0.9,
    `${uitkomst.geleerd} woorden aangeraakt bij 8 per dag over 30 dagen`,
  );
  // De werklast mag groeien maar niet ontploffen: een systeem waarin dag 30
  // tien keer zwaarder is dan dag 10, houdt niemand vol.
  assert(
    uitkomst.zwaarsteDag <= uitkomst.gemiddeldPerDag * 3,
    `zwaarste dag ${uitkomst.zwaarsteDag} tegen gemiddeld ${uitkomst.gemiddeldPerDag.toFixed(1)} — te grote bult`,
  );
  assert(
    uitkomst.gepromoveerd > 0,
    "in dertig dagen is geen enkel woord naar het volgende stadium gegaan",
  );

  return (
    `${uitkomst.geleerd} woorden · ${uitkomst.reviews} herhalingen · ` +
    `gemiddeld ${uitkomst.gemiddeldPerDag.toFixed(1)}/dag, piek ${uitkomst.zwaarsteDag} · ` +
    `${uitkomst.gepromoveerd} gepromoveerd · ${uitkomst.leeches} leeches`
  );
});

await test("4", "Slecht leren levert leeches op, goed leren niet", async () => {
  const { simulate } = await import("../src/lib/simulate");

  const slecht = simulate({ dagen: 30, nieuwPerDag: 8, kansGoed: 0.35 });
  const goed = simulate({ dagen: 30, nieuwPerDag: 8, kansGoed: 0.95 });

  assert(
    slecht.leeches > goed.leeches,
    `leeches bij 35% goed: ${slecht.leeches}, bij 95%: ${goed.leeches} — de leechdetectie doet niets`,
  );
  assert(
    goed.gepromoveerd > slecht.gepromoveerd,
    `promoties bij 95%: ${goed.gepromoveerd}, bij 35%: ${slecht.gepromoveerd}`,
  );
  return `35% goed → ${slecht.leeches} leeches, ${slecht.gepromoveerd} promoties · 95% → ${goed.leeches} / ${goed.gepromoveerd}`;
});

/* ═══════════════════════════════════════════════════ verslag ══ */

fs.rmSync(TMP, { recursive: true, force: true });

const TITELS: Record<string, string> = {
  "1": "De stadialadder: promoveren op het juiste moment",
  "2": "Leeches vallen uit de rotatie en zijn te herstellen",
  "3": "Vragen komen uit de woordgegevens, niet uit geschreven oefeningen",
  "4": "Dertig dagen simuleren",
};

const perPunt = new Map<string, Result[]>();
for (const r of results) {
  const lijst = perPunt.get(r.punt);
  if (lijst) lijst.push(r);
  else perPunt.set(r.punt, [r]);
}

console.log("\nAcceptatie Fase 1 — woordenschatsectie\n" + "─".repeat(64));
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
if (gezakt.length) process.exit(1);
