import type { ReactNode } from "react";

/*
  De secties van het platform, op één plek: naam, adres, symbool en kleur.

  Elke sectie heeft een eigen kleur, zoals de apps op een iPhone — je
  herkent Verhalen aan het oranje nog vóór je het woord leest. De kleur keert
  terug in het app-icoon in de navigatie, in de gloed achter de paginakop en
  in het icoon naast de titel. De volgorde is die van het leren.
*/

export const ICONS: Record<string, React.ReactNode> = {
  overzicht: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  lessen: (
    <>
      <path d="M12 3 3 7.2l9 4.2 9-4.2L12 3Z" />
      <path d="M3 12.2 12 16.4l9-4.2" />
      <path d="M3 16.9 12 21l9-4.1" />
    </>
  ),
  grammatica: (
    <>
      <path d="M4 4.5h16" />
      <path d="M4 9.5h16" />
      <path d="M4 14.5h9" />
      <path d="M4 19.5h9" />
      <path d="M17.5 14.5v5" />
      <path d="M15 17h5" />
    </>
  ),
  verhalen: (
    <>
      <path d="M12 6.6C10.6 5.2 8.6 4.5 6 4.5c-1.1 0-2 .1-2.6.3v13c.6-.2 1.5-.3 2.6-.3 2.6 0 4.6.7 6 2.1" />
      <path d="M12 6.6c1.4-1.4 3.4-2.1 6-2.1 1.1 0 2 .1 2.6.3v13c-.6-.2-1.5-.3-2.6-.3-2.6 0-4.6.7-6 2.1" />
      <path d="M12 6.6V20" />
    </>
  ),
  schrijven: (
    <>
      <path d="M4 20.5h16" />
      <path d="M15.6 4.1a2 2 0 0 1 2.8 2.8L9 16.4l-3.6.9.9-3.6 9.3-9.6Z" />
    </>
  ),
  herhalen: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V9H15" />
    </>
  ),
  woorden: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </>
  ),
  voortgang: (
    <>
      <path d="M3.5 20.5V3.5" />
      <path d="M3.5 20.5h17" />
      <path d="M8 17v-4.5" />
      <path d="M13 17V8" />
      <path d="M18 17v-7" />
    </>
  ),
};

export type SectionKey =
  | "overzicht"
  | "grammatica"
  | "verhalen"
  | "schrijven"
  | "lessen"
  | "oefenen"
  | "woorden"
  | "voortgang";

export interface Section {
  key: SectionKey;
  href: string;
  label: string;
  icon: string;
  /** Kleurverloop van het app-icoon: licht boven, verzadigd onder. */
  hue: [string, string];
}

export const SECTIONS: Section[] = [
  { key: "overzicht", href: "/", label: "Overzicht", icon: "overzicht", hue: ["#5ab8ff", "#0a6cff"] },
  { key: "grammatica", href: "/grammatica", label: "Grammatica", icon: "grammatica", hue: ["#a99bff", "#5e5ce6"] },
  { key: "verhalen", href: "/verhalen", label: "Verhalen", icon: "verhalen", hue: ["#ffc04d", "#ff8a00"] },
  { key: "schrijven", href: "/schrijven", label: "Schrijven", icon: "schrijven", hue: ["#ff7fa6", "#ff2d55"] },
  { key: "lessen", href: "/lessen", label: "Lessen", icon: "lessen", hue: ["#62e08f", "#1bb258"] },
  { key: "oefenen", href: "/oefenen", label: "Oefenen", icon: "herhalen", hue: ["#6fe2fb", "#0a9be0"] },
  { key: "woorden", href: "/woorden", label: "Woorden", icon: "woorden", hue: ["#6aeadb", "#12b0a0"] },
  { key: "voortgang", href: "/voortgang", label: "Voortgang", icon: "voortgang", hue: ["#dcaaff", "#a64cf2"] },
];

/** Welke sectie hoort bij dit pad. Pagina's buiten het menu lenen de kleur van hun familie. */
export function sectionFor(pathname: string): Section {
  const alias: Record<string, SectionKey> = {
    "/fouten": "oefenen",
    "/nakijken": "schrijven",
    "/plaatsingstoets": "lessen",
  };
  for (const [prefix, key] of Object.entries(alias)) {
    if (pathname.startsWith(prefix)) return SECTIONS.find((s) => s.key === key)!;
  }
  return (
    SECTIONS.find((s) => s.href !== "/" && pathname.startsWith(s.href)) ?? SECTIONS[0]
  );
}

/**
 * Het app-icoon van een sectie: een afgerond vierkant met een verloop van
 * licht naar verzadigd, een lichtrand bovenaan en een wit symbool — zoals de
 * iconen in Instellingen op een iPhone.
 */
export function AppIcon({
  section,
  size = 28,
  className = "",
}: {
  section: Section;
  size?: number;
  className?: string;
}) {
  const [a, b] = section.hue;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: `linear-gradient(180deg, ${a}, ${b})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -1px 0 rgb(0 0 0 / 0.08), 0 ${size * 0.12}px ${size * 0.3}px -${size * 0.12}px ${b}`,
      }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[section.icon] as ReactNode}
      </svg>
    </span>
  );
}
