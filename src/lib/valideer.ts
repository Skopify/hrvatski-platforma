/*
  Invoer van de browser is invoer van buiten, ook op een lokale server.

  Server actions zijn gewone HTTP-eindpunten: wat er als getal of tekst
  binnenkomt is niet per se wat de interface ooit zou sturen. Deze helpers
  begrenzen het tot wat zinvol is, zodat een vreemde waarde (een
  antwoordtijd van een miljoen jaar, een schrijfopdracht van 50 MB) geen
  planning kan vervormen of de server kan vastzetten.
*/

/** Een getal binnen [min, max]; geen getal wordt de terugvalwaarde. */
export function binnen(n: unknown, min: number, max: number, terugval = min): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return terugval;
  return Math.min(max, Math.max(min, x));
}

/** Een tekst van hooguit `max` tekens; alles wat geen tekst is wordt leeg. */
export function tekst(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

/** Antwoordtijd in milliseconden: tussen 0 en een uur. Langer is een vergeten tabblad. */
export const antwoordtijd = (n: unknown) => Math.round(binnen(n, 0, 3_600_000, 0));

export const MAX_SCHRIJFTEKST = 20_000;
