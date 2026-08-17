import { and, eq, sql } from "drizzle-orm";
import { Rating, type Grade } from "ts-fsrs";

import { db } from "./db";
import { attempts } from "./db/schema";

/**
 * Hoe snel een goed antwoord kwam, gemeten tegen je eigen tempo.
 *
 * ── Waarom niet gewoon knoppen ─────────────────────────────────────────────
 * FSRS wil weten hoe moeilijk het ophalen was. De gebruikelijke oplossing is
 * de leerder vier knoppen geven (Again/Hard/Good/Easy), maar zelfbeoordeling is
 * systematisch te mild: wie het antwoord ziet, denkt achteraf dat hij het wist.
 *
 * De tijd tot het antwoord zegt hetzelfde zonder die vertekening. Een vorm die
 * je meteen opschrijft, zit anders in je geheugen dan een vorm waar je acht
 * seconden over nadenkt — ook als allebei goed zijn.
 *
 * ── Waarom tegen je eigen mediaan en niet tegen een vast getal ─────────────
 * Vier seconden is snel voor een productiekaart en traag voor herkenning. En
 * het hangt van de persoon af: iemand die met twee vingers typt, is nooit
 * "snel" volgens een vaste drempel, en zou dus nooit een Easy krijgen. Door per
 * kaartsoort de eigen mediaan te nemen, meet je afwijking van je eigen normaal
 * in plaats van van iemand anders.
 *
 * Onder een minimum aantal metingen wordt er niets gekalibreerd: een mediaan
 * over drie antwoorden is ruis, en daarop plannen is slechter dan een vaste
 * drempel.
 */

/** Zoveel goede antwoorden van dezelfde soort zijn nodig vóór de mediaan telt. */
const MIN_METINGEN = 8;

/** Grenzen als afwijking van de eigen mediaan. */
const SNEL = 0.6;
const TRAAG = 1.6;

/** Vaste terugval zolang er te weinig gemeten is, in milliseconden. */
const VAST: Record<string, { snel: number; traag: number }> = {
  productive: { snel: 9000, traag: 25000 },
  receptive: { snel: 4000, traag: 12000 },
};

interface Meting {
  mediaan: number;
  n: number;
}

// Kleine cache: de mediaan verschuift langzaam, en hem bij elk antwoord opnieuw
// berekenen zou een sortering per review betekenen.
const cache = new Map<string, { waarde: Meting | null; tot: number }>();
const CACHE_MS = 5 * 60 * 1000;

/** De mediaan van je goede antwoorden voor deze soort opgave. */
export function medianFor(key: string): Meting | null {
  const nu = Date.now();
  const bewaard = cache.get(key);
  if (bewaard && bewaard.tot > nu) return bewaard.waarde;

  const rijen = db
    .select({ d: attempts.durationMs })
    .from(attempts)
    .where(
      and(
        eq(attempts.type, key),
        eq(attempts.correct, 1),
        // Nul betekent "niet gemeten", niet "oneindig snel".
        sql`${attempts.durationMs} > 0`,
      ),
    )
    .all()
    .map((r) => r.d)
    .sort((a, b) => a - b);

  const uitkomst =
    rijen.length >= MIN_METINGEN
      ? { mediaan: rijen[Math.floor(rijen.length / 2)]!, n: rijen.length }
      : null;

  cache.set(key, { waarde: uitkomst, tot: nu + CACHE_MS });
  return uitkomst;
}

/** De cache legen — na een reset, of in tests. */
export function resetTempo(): void {
  cache.clear();
}

/**
 * Het oordeel voor een góéd antwoord: hoe vlot ging het?
 *
 * Alleen aanroepen als het antwoord klopt. Fout is altijd Again, en een
 * bijna-goed antwoord (diakritisch teken vergeten, tikfout) is altijd Hard —
 * daar zegt de tijd niets over.
 */
export function gradeByTempo(
  durationMs: number,
  key: string,
  mode: "receptive" | "productive",
): Grade {
  if (durationMs <= 0) return Rating.Good;

  const gemeten = medianFor(key);
  const snel = gemeten ? gemeten.mediaan * SNEL : VAST[mode]!.snel;
  const traag = gemeten ? gemeten.mediaan * TRAAG : VAST[mode]!.traag;

  if (durationMs < snel) return Rating.Easy;
  if (durationMs > traag) return Rating.Hard;
  return Rating.Good;
}
