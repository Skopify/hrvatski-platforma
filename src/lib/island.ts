/*
  Meldingen via het eiland (de Dynamic Island bovenaan het scherm).

  Een los evenement op window in plaats van context: zo kan elk component —
  ook een diep genest client-component — iets melden zonder dat er een
  provider om de hele app hoeft. Het eiland zelf luistert in de layout.
*/
export type IslandTone = "good" | "info" | "warm";

export interface IslandMessage {
  text: string;
  sub?: string;
  tone?: IslandTone;
}

export const ISLAND_EVENT = "hr-eiland";

export function island(message: IslandMessage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<IslandMessage>(ISLAND_EVENT, { detail: message }));
}
