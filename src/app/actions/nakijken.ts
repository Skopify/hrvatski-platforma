"use server";
import { binnen, tekst as begrensTekst } from "@/lib/valideer";
import { type ReviewStatus, type Stand, type Zin, bewaarOordeel, stand, verwijderOordeel, volgendeBatch } from "@/lib/nakijken";

/**
 * Eén oordeel van de nakijker vastleggen.
 *
 * Schrijft naar `zin_review` en verder nergens heen. De content blijft staan
 * zoals ze staat, ook als de nakijker zegt dat er iets fout is — een correctie
 * is soms «dit woord moet anders» en soms «zo zegt niemand dat», en dat
 * verschil kan geen automaat wegen. `npm run nakijk-oogst` legt de oordelen
 * naast de contentbestanden zodat ik ze met de hand verwerk.
 */
export async function bewaarNakijkOordeel(
  hash: string,
  hr: string,
  status: ReviewStatus,
  correctie?: string,
  opmerking?: string,
): Promise<void> {
  bewaarOordeel(begrensTekst(hash, 100), begrensTekst(hr, 500), status, correctie === undefined ? undefined : begrensTekst(correctie, 500), opmerking === undefined ? undefined : begrensTekst(opmerking, 2000));
}

/** Een oordeel terugdraaien — de nakijker die zich vergist heeft. */
export async function wisNakijkOordeel(hash: string): Promise<void> {
  verwijderOordeel(hash);
}

/** De volgende stapel, nadat de vorige af is. */
export async function volgendeNakijkBatch(grootte = 20): Promise<{ zinnen: Zin[]; stand: Stand }> {
  grootte = Math.round(binnen(grootte, 1, 100, 20));
  return { zinnen: volgendeBatch(grootte), stand: stand() };
}
