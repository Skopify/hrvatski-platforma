import { eq } from "drizzle-orm";
import { Rating, type Grade } from "ts-fsrs";

import { db } from "./db";
import { card, items, srs } from "./db/schema";
import { applyReview, dueCards, ensureCards } from "./srs";
import { checkLeech, promoteIfReady, startStage } from "./stages";

/**
 * Dertig dagen leren nabootsen.
 *
 * Wat hier bewezen wordt is níet dat FSRS werkt — dat is elders en beter
 * getest. Het gaat om de inrichting eróm heen: de dagelijkse cap op nieuwe
 * woorden, de promotieladder, de leechregel. Die drie kunnen elkaar in de weg
 * zitten op manieren die je pas na weken merkt, en dan is het te laat.
 *
 * De faalmodus waar dit op let: een groeiende bult. Een systeem waarin dag
 * dertig tienmaal zwaarder is dan dag tien, houdt niemand vol — dat is de reden
 * dat SRS-systemen sneuvelen, en het is met een simulatie vooraf te zien in
 * plaats van achteraf.
 *
 * Draait op een echte database (via HRVATSKI_DB een kopie) en laat sporen na.
 * Nooit tegen data/hrvatski.db draaien.
 */

export interface SimulateOptions {
  dagen?: number;
  /** Cap op nieuwe woorden per dag — §8 waarschuwt dat dit de #1 faaloorzaak is. */
  nieuwPerDag?: number;
  /** Kans dat een herhaling goed gaat, 0-1. */
  kansGoed?: number;
  /** Vaste zaadwaarde, zodat dezelfde run hetzelfde resultaat geeft. */
  seed?: number;
}

export interface SimulateResult {
  dagen: number;
  /** Hoeveel woorden er zijn aangeraakt. */
  geleerd: number;
  reviews: number;
  gemiddeldPerDag: number;
  zwaarsteDag: number;
  gepromoveerd: number;
  leeches: number;
  perDag: number[];
}

/** Reproduceerbare toevalsgenerator: dezelfde seed, dezelfde uitkomst. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function simulate(opties: SimulateOptions = {}): SimulateResult {
  const dagen = opties.dagen ?? 30;
  const nieuwPerDag = opties.nieuwPerDag ?? 8;
  const kansGoed = opties.kansGoed ?? 0.85;
  const random = rng(opties.seed ?? 20260817);

  // Alleen woorden die nog geen kaart hebben, zodat de simulatie niet op
  // bestaande voortgang gaat zitten.
  const voorraad = db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.kind, "vocab"))
    .all()
    .map((r) => r.id)
    .filter((id) => !db.select({ id: card.id }).from(card).where(eq(card.itemId, id)).get());

  const start = Date.now();
  const perDag: number[] = [];
  const aangeraakt = new Set<string>();
  let reviews = 0;
  let gepromoveerd = 0;
  const geschorst = new Set<number>();
  let volgende = 0;

  for (let dag = 0; dag < dagen; dag++) {
    const nu = new Date(start + dag * 86_400_000);

    // 1. Herhalingen eerst — die hebben voorrang op nieuw materiaal, anders
    //    groeit de schuld sneller dan je hem inloopt (§8).
    const vandaag = dueCards(nu, 5000);

    // 2. Nieuwe woorden van vandaag, met de cap erop. Een nieuwe kaart moet ook
    //    daadwerkelijk één keer aangeraakt worden: zolang hij op `New` staat,
    //    komt hij in geen enkele wachtrij voor.
    const nieuw: typeof vandaag = [];
    for (let i = 0; i < nieuwPerDag && volgende < voorraad.length; i++) {
      const woord = voorraad[volgende++]!;
      const [kaartId] = ensureCards([woord], startStage(), nu);
      if (kaartId === undefined) continue;
      aangeraakt.add(woord);
      nieuw.push({ cardId: kaartId, itemId: woord, kind: startStage(), due: nu.getTime() });
    }

    perDag.push(vandaag.length + nieuw.length);

    for (const kaart of [...vandaag, ...nieuw]) {
      const goed = random() < kansGoed;
      const oordeel: Grade = goed
        ? random() < 0.25
          ? Rating.Easy
          : Rating.Good
        : Rating.Again;
      applyReview(kaart.cardId, oordeel, 4000, nu);
      reviews++;

      if (checkLeech(kaart.cardId)) {
        geschorst.add(kaart.cardId);
        continue;
      }
      if (goed && promoteIfReady(kaart.cardId)) gepromoveerd++;
    }
  }

  const totaal = perDag.reduce((a, b) => a + b, 0);
  return {
    dagen,
    geleerd: aangeraakt.size,
    reviews,
    gemiddeldPerDag: totaal / dagen,
    zwaarsteDag: Math.max(...perDag, 0),
    gepromoveerd,
    leeches: geschorst.size,
    perDag,
  };
}

/** Alle sporen van een simulatie weghalen — voor tests die meerdere keren draaien. */
export function resetSimulation(): void {
  const kaarten = db.select({ id: card.id }).from(card).all();
  for (const k of kaarten) {
    db.delete(srs).where(eq(srs.cardId, k.id)).run();
  }
}
