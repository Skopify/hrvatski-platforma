import { Doodle, type DoodleName } from "./doodles";

/*
  De secties van het platform, op één plek: naam, adres, krabbel en stift.

  Elke sectie heeft een eigen pastelstift, zoals de stickers op een schrift:
  je herkent Verhalen aan het perzik nog vóór je het woord leest. De kleur
  keert terug in de navigatie, in de sticker naast de paginakop en in de
  golf onder de titel. De volgorde is die van het leren.
*/

export type SectionKey =
  | "overzicht"
  | "grammatica"
  | "verhalen"
  | "schrijven"
  | "lessen"
  | "oefenen"
  | "woorden"
  | "voortgang"
  | "gesprek";

export interface Section {
  key: SectionKey;
  href: string;
  label: string;
  doodle: DoodleName;
  /** De pastelstift: vlakken en stickers. Er staat altijd donkere inkt op. */
  pop: string;
  /** Een verzadigde tint van dezelfde stift, voor krabbels en lijnen. */
  deep: string;
}

export const SECTIONS: Section[] = [
  { key: "overzicht", href: "/", label: "Overzicht", doodle: "sun", pop: "var(--color-pop-sky)", deep: "#3b8bff" },
  { key: "grammatica", href: "/grammatica", label: "Grammatica", doodle: "bulb", pop: "var(--color-pop-lilac)", deep: "#7c5cff" },
  { key: "verhalen", href: "/verhalen", label: "Verhalen", doodle: "book", pop: "var(--color-pop-peach)", deep: "#ff8a3d" },
  { key: "schrijven", href: "/schrijven", label: "Schrijven", doodle: "pencil", pop: "var(--color-pop-pink)", deep: "#ff4f8b" },
  { key: "lessen", href: "/lessen", label: "Lessen", doodle: "stairs", pop: "var(--color-pop-mint)", deep: "#14b56a" },
  { key: "oefenen", href: "/oefenen", label: "Oefenen", doodle: "loop", pop: "var(--color-pop-yellow)", deep: "#f2b100" },
  { key: "woorden", href: "/woorden", label: "Woorden", doodle: "bubble", pop: "var(--color-pop-lime)", deep: "#7bc40a" },
  { key: "voortgang", href: "/voortgang", label: "Voortgang", doodle: "chart", pop: "var(--color-pop-coral)", deep: "#ff5a4d" },
  { key: "gesprek", href: "/gesprek", label: "Gesprek", doodle: "praat", pop: "var(--color-pop-aqua)", deep: "#12b5c4" },
];

/** Welke sectie hoort bij dit pad. Pagina's buiten het menu lenen de stift van hun familie. */
export function sectionFor(pathname: string): Section {
  const alias: Record<string, SectionKey> = {
    "/fouten": "oefenen",
    "/nakijken": "schrijven",
    "/plaatsingstoets": "lessen",
  };
  for (const [prefix, key] of Object.entries(alias)) {
    if (pathname.startsWith(prefix)) return SECTIONS.find((s) => s.key === key)!;
  }
  return SECTIONS.find((s) => s.href !== "/" && pathname.startsWith(s.href)) ?? SECTIONS[0];
}

/**
 * De sticker van een sectie: een tegel in de stift van de sectie met een
 * inktrand, een harde schaduw en het krabbel-icoon erin. Ligt een fractie
 * scheef, als iets dat je op je schrift plakte.
 */
export function SectionSticker({
  section,
  size = 44,
  tilt = -4,
  className = "",
}: {
  section: Section;
  size?: number;
  tilt?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-tile border-2 border-outline ${className}`}
      style={{
        width: size,
        height: size,
        background: section.pop,
        rotate: `${tilt}deg`,
        boxShadow: `${Math.max(2, size / 14)}px ${Math.max(2, size / 14)}px 0 var(--color-outline)`,
      }}
    >
      <Doodle name={section.doodle} size={size * 0.64} color="#ffffff" />
    </span>
  );
}
