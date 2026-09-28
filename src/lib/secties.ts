/*
  Elke sectie heeft een eigen drukinkt, zoals een reeks affiches: je ziet aan
  de kleur waar je bent, nog voor je iets leest. Drie kleuren plus zwart,
  in de volgorde van het menu, zodat naast elkaar liggende secties nooit
  dezelfde kleur hebben.
*/
export type Tone = "crvena" | "plava" | "zuta" | "crna";

const SECTIE_TOON: [prefix: string, tone: Tone][] = [
  ["/grammatica", "crvena"],
  ["/verhalen", "plava"],
  ["/schrijven", "zuta"],
  ["/lessen", "crna"],
  ["/oefenen", "crvena"],
  ["/fouten", "crvena"],
  ["/woorden", "plava"],
  ["/voortgang", "zuta"],
  ["/nakijken", "crna"],
  ["/plaatsingstoets", "plava"],
];

export function toneFor(pathname: string): Tone {
  return SECTIE_TOON.find(([p]) => pathname.startsWith(p))?.[1] ?? "crna";
}
