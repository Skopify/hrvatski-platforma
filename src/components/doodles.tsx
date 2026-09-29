import type { CSSProperties } from "react";

/*
  De krabbels van het platform: alle iconen en decoraties, met de hand
  ontworpen in plaats van uit een iconenbibliotheek.

  Elk icoon is twee lagen: een gekleurde vlek die een fractie naast de lijn
  ligt (zoals een misgedrukte zeefdruk) en de inktlijn erbovenop. Een
  SVG-filter (`#rough`, staat in de layout) laat de hele tekening een tikje
  wiebelen, zodat ze met de hand getekend lijken zonder dat één pad
  onregelmatig hoeft te zijn.

  Alle paden liggen op een raster van 24 bij 24.
*/

interface Shape {
  /** Paden van de gekleurde vlek. */
  f?: string[];
  /** Paden van de inktlijn. */
  l: string[];
}

const BULB = "M12 3.5a6 6 0 0 0-3.7 10.7c.7.6 1.2 1.4 1.2 2.3v.5h5v-.5c0-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3.5Z";
const BOOK = "M3 5.5c3-1.1 6-.7 9 1.5 3-2.2 6-2.6 9-1.5V19c-3-1-6-.6-9 1.5-3-2.1-6-2.5-9-1.5V5.5Z";
const PENCIL = "M4 20.5l1.2-4.6L16.6 4.4a2.2 2.2 0 0 1 3.1 3.1L8.3 18.9 4 20.5Z";
const STAIRS = "M3 20.5v-4.5h5v-4.5h5V7h8v13.5H3Z";
const BUBBLE =
  "M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H13l-4.5 4v-4h-4A1.5 1.5 0 0 1 3 15V6a1.5 1.5 0 0 1 1.5-1.5Z";
const FLAME =
  "M12 3c.6 3-1.2 4.6-3 6.6C7.2 11.4 6 13 6 15.5a6 6 0 0 0 12 0c0-2.2-.8-3.7-2-5-.5 1.2-1.3 1.9-2.3 2.3.8-3-.2-6-1.7-9.8Z";
const BOLT = "M13 2.5 5 13.5h6L10 21.5l9-12h-6.2L13 2.5Z";
const SEARCH_CIRCLE = "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13Z";
const CUP = "M3.5 6.5h13v6a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5v-6Z";
const PAGE = "M6 3h9l4 4v14H6V3Z";
const MOUNTAINS = "M2.5 19.5 8 11l4.2 6.3L15 14l6 5.5H2.5Z";

export const SHAPES = {
  /* -- secties --------------------------------------------------------- */
  sun: {
    f: ["M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10Z"],
    l: [
      "M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10Z",
      "M12 1.8v2.4",
      "M12 19.8v2.4",
      "M1.8 12h2.4",
      "M19.8 12h2.4",
      "M4.8 4.8l1.7 1.7",
      "M17.5 17.5l1.7 1.7",
      "M4.8 19.2l1.7-1.7",
      "M17.5 6.5l1.7-1.7",
    ],
  },
  bulb: { f: [BULB], l: [BULB, "M9.5 19.5h5", "M10.5 22h3"] },
  book: { f: [BOOK], l: [BOOK, "M12 7v13.5"] },
  pencil: { f: [PENCIL], l: [PENCIL, "M14.6 6.4l3.1 3.1", "M5.4 16l2.6 2.6"] },
  stairs: { f: [STAIRS], l: [STAIRS, "M17 7V2.5l3.6 1.6L17 5.7"] },
  loop: {
    f: ["M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Z"],
    l: ["M19.4 9.2A8 8 0 0 0 5.4 7.6", "M5.2 3.6v4.2h4.2", "M4.6 14.8a8 8 0 0 0 14 1.6", "M18.8 20.4v-4.2h-4.2"],
  },
  bubble: { f: [BUBBLE], l: [BUBBLE, "M7 9.5h10", "M7 12.5h6"] },
  punten: {
    f: ["M5 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M19 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"],
    l: ["M5 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M19 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"],
  },
  praat: {
    f: ["M3.5 4.5h11a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H8l-3.5 3v-3a2 2 0 0 1-1-1.7V6.5a2 2 0 0 1 1-2Z"],
    l: [
      "M3.5 4.5h11a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H8l-3.5 3v-3a2 2 0 0 1-1-1.7V6.5a2 2 0 0 1 1-2Z",
      "M18.5 9.5h1a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1 1.4v2.6l-3-2.6h-4",
      "M7 8h6",
      "M7 10.8h3.5",
    ],
  },
  chart: {
    f: ["M3.5 20.5v-6h4.5v6H3.5ZM9.8 20.5V9h4.5v11.5H9.8ZM16 20.5V3.5h4.5v17H16Z"],
    l: ["M3.5 20.5v-6h4.5v6", "M9.8 20.5V9h4.5v11.5", "M16 20.5V3.5h4.5v17", "M2 21.8h20"],
  },

  /* -- kleine tekens --------------------------------------------------- */
  flame: {
    f: [FLAME],
    l: [FLAME, "M12 20a2.4 2.4 0 0 1-2.4-2.4c0-1.4 1.1-2 2.4-3.4 1.3 1.4 2.4 2 2.4 3.4A2.4 2.4 0 0 1 12 20Z"],
  },
  bolt: { f: [BOLT], l: [BOLT] },
  search: { f: [SEARCH_CIRCLE], l: [SEARCH_CIRCLE, "M15.5 15.5l5 5"] },
  moon: {
    f: ["M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"],
    l: ["M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"],
  },
  instellingen: {
    f: ["M8 6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M16 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M9 18m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"],
    l: ["M3 6h2.8", "M10.2 6H21", "M3 12h10.8", "M18.2 12H21", "M3 18h3.8", "M11.2 18H21", "M8 6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M16 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0", "M9 18m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"],
  },
  check: { l: ["M4 12.8l5 5L20 6.5"] },
  cross: { l: ["M6 6l12 12", "M18 6 6 18"] },
  star: {
    f: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z"],
    l: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z"],
  },
  question: {
    f: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17Z"],
    l: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17Z", "M9.4 9.6a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2", "M12 17.1v.1"],
  },

  /* -- verhalen (motief) ----------------------------------------------- */
  obitelj: {
    f: ["M8.5 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z", "M16.5 8a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 0 0 0-4.8Z"],
    l: [
      "M8.5 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z",
      "M3.5 20c0-3.3 2.2-5.5 5-5.5s5 2.2 5 5.5",
      "M16.5 8a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 0 0 0-4.8Z",
      "M14.5 20c.3-2.8 2-4.4 4.2-4.4 1 0 1.9.3 2.6.9",
    ],
  },
  trznica: {
    f: ["M4 9.5 5.2 4h13.6L20 9.5H4Z"],
    l: ["M4 9.5 5.2 4h13.6L20 9.5H4Z", "M5 9.5V20h14V9.5", "M9.5 20v-6h5v6"],
  },
  izlet: {
    f: [MOUNTAINS, "M16.5 4.2a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 0 0 0-4.8Z"],
    l: [MOUNTAINS, "M16.5 4.2a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 0 0 0-4.8Z"],
  },
  kavana: {
    f: [CUP],
    l: [CUP, "M16.5 8.5h1.8a2.6 2.6 0 0 1 0 5.2h-1.8", "M6.5 2.5c.8.8.8 1.4 0 2.2", "M10 2.5c.8.8.8 1.4 0 2.2", "M13.5 2.5c.8.8.8 1.4 0 2.2"],
  },
  knjiga: {
    f: ["M5 3.5h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V3.5Z"],
    l: ["M5 3.5h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V3.5Z", "M8.5 8h6", "M8.5 11.5h6", "M18 15.5h2.2v4H18"],
  },
  more: {
    f: ["M4 13.5h16l-2 5H6l-2-5Z"],
    l: ["M4 13.5h16l-2 5H6l-2-5Z", "M12 13V3.5l5.5 4.5H12", "M2.5 21.5c1.5-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0 3 1.1 4.5 0"],
  },

  /* -- drills ---------------------------------------------------------- */
  oblik: {
    f: ["M3.5 4h17a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"],
    l: ["M3.5 4h17a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M2.5 9.5h19", "M9 9.5V20"],
  },
  padezi: {
    f: ["M12 3.5 3.5 9h17L12 3.5Z"],
    l: ["M12 3.5 3.5 9h17L12 3.5Z", "M6 11v7", "M10 11v7", "M14 11v7", "M18 11v7", "M3.5 20.5h17"],
  },
  rod: {
    f: ["M12 3.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Z"],
    l: ["M12 3.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Z", "M12 12.5V21", "M8.5 17.5h7"],
  },
  genitiv: {
    f: ["M4 20 10.5 4.5 17 20H4Z"],
    l: ["M4 20 10.5 4.5 17 20", "M6.6 14.5h7.8", "M19.5 11v9"],
  },
  mnozina: {
    f: ["M3 6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 11 6v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 3 18V6Z"],
    l: [
      "M3 6a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 11 6v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 3 18V6Z",
      "M14 4.5h5.5A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5H14",
      "M14.5 10h3.5",
      "M14.5 14h3.5",
    ],
  },
  glagol: {
    f: ["M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Z"],
    l: ["M19.4 9.2A8 8 0 0 0 5.4 7.6", "M5.2 3.6v4.2h4.2", "M4.6 14.8a8 8 0 0 0 14 1.6", "M18.8 20.4v-4.2h-4.2"],
  },
  brojevi: {
    f: ["M4.5 4.5h15v15h-15Z"],
    l: ["M8.5 3.5 7 20.5", "M17 3.5 15.5 20.5", "M3.5 9h17.5", "M3 15h17.5"],
  },
  diktat: {
    f: ["M4 14.5h3v6H5.5A1.5 1.5 0 0 1 4 19v-4.5Z", "M20 14.5h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5v-4.5Z"],
    l: [
      "M4 15v-2a8 8 0 0 1 16 0v2",
      "M4 14.5h3v6H5.5A1.5 1.5 0 0 1 4 19v-4.5Z",
      "M20 14.5h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5v-4.5Z",
    ],
  },

  /* -- schrijven (soort opdracht) -------------------------------------- */
  zinnen: {
    f: ["M3.5 4.5h17v15h-17Z"],
    l: ["M6 8.5h12", "M6 12h8", "M6 15.5h10", "M3.5 4.5h17v15h-17Z"],
  },
  tekst: { f: [PAGE], l: [PAGE, "M15 3v4h4", "M9 12h7", "M9 15.5h7"] },
  bericht: {
    f: ["M3 6h18v13H3V6Z"],
    l: ["M3 6h18v13H3V6Z", "M3 6.8l9 6.7 9-6.7"],
  },
} satisfies Record<string, Shape>;

export type DoodleName = keyof typeof SHAPES;

/**
 * Een krabbel-icoon: inktlijn met een gekleurde vlek die er een fractie naast
 * ligt. `color` is de vlek; laat hem weg voor de standaardgele stift.
 */
export function Doodle({
  name,
  size = 24,
  color = "var(--color-pop-yellow)",
  stroke = 2,
  className = "",
  style,
  opVlak = false,
}: {
  name: DoodleName;
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  /** Ligt het icoon op een pastelvlak dat geen ouder is (zoals het schuivende menu-blok)? Dan altijd donkere inkt. */
  opVlak?: boolean;
}) {
  const shape: Shape = SHAPES[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      className={`shrink-0 overflow-visible ${className}`}
      style={opVlak ? ({ ...style, "--color-outline": "#1b1a22", "--doodle-mix": "100%" } as CSSProperties) : style}
    >
      <g className="rough">
        {shape.f ? (
          <g transform="translate(1.7 1.7)" style={{ fill: `color-mix(in srgb, ${color} var(--doodle-mix, 100%), var(--color-plane))` }} stroke="none">
            {shape.f.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        ) : null}
        <g
          style={{ stroke: "var(--color-outline)" }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {shape.l.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/* ----------------------------------------------------- losse krabbels --- */

/**
 * Een golvende streep onder een woord of kop. Het is een herhalend golfje
 * (een mask), geen uitgerekend plaatje: zo blijft de golf even fijn en even
 * dik, hoe breed het woord ook is. Bij het openen veegt hij van links naar
 * rechts in beeld, alsof je hem trekt — een reveal met clip-path, dus alleen
 * de compositor doet het werk.
 */
export function Squiggle({
  color = "var(--color-pop-pink)",
  className = "",
  slow = false,
}: {
  color?: string;
  className?: string;
  slow?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`squiggle ${slow ? "slow" : ""} ${className}`}
      style={{ ["--sq" as string]: color }}
    />
  );
}

/** Een krullende pijl die naar iets wijst. Spiegel hem met `-scale-x-100`. */
export function Arrow({ className = "", slow = true }: { className?: string; slow?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 50"
      aria-hidden
      focusable="false"
      fill="none"
      className={`krabbel ${slow ? "slow" : ""} ${className}`}
    >
      <path
        d="M4 6C20 2 42 8 47 26c1.5 5.5 1 10-1 15"
        pathLength={1}
        style={{ stroke: "var(--color-outline)" }}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M37 33.5l9.5 9 8-10"
        pathLength={1}
        style={{ stroke: "var(--color-outline)" }}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Een vierpuntige glinstering. */
export function Sparkle({
  size = 18,
  color = "var(--color-pop-yellow)",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" className={`shrink-0 ${className}`}>
      <path
        d="M12 2c.8 5 2 8.2 10 10-8 1.8-9.2 5-10 10-.8-5-2-8.2-10-10 8-1.8 9.2-5 10-10Z"
        style={{ fill: color, stroke: "var(--color-outline)" }}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Een slordige cirkel om iets heen, zoals je met een stift een getal omcirkelt. */
export function ScribbleCircle({
  color = "var(--color-outline)",
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 60"
      aria-hidden
      focusable="false"
      fill="none"
      className={`krabbel ${className}`}
    >
      <path
        d="M52 5C24 3 4 16 6 32c2 17 30 24 56 21 24-3 34-14 30-28C88 12 66 6 40 9"
        pathLength={1}
        style={{ stroke: color }}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Het filter waarmee alle tekeningen wiebelen. Eén keer in de layout, want
 * elke `.rough` verwijst ernaar. Het werkt in de eenheden van het icoon
 * (24 bij 24), dus de uitwijking is een paar procent van de grootte.
 */
export function RoughFilter() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="pointer-events-none absolute">
      <defs>
        <filter id="rough" filterUnits="userSpaceOnUse" x="-3" y="-3" width="30" height="30">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Voor grafieklijnen: een ruimer gebied en meer golf, want de tekening is groter dan een icoon. */}
        <filter id="rough-chart" filterUnits="userSpaceOnUse" x="-60" y="-60" width="1000" height="700">
          <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
