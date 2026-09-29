import Link from "next/link";
import type { ReactNode } from "react";

import { Doodle } from "./doodles";

/*
  Gedeelde bouwstenen. Alles hier is puur presentatie en server-veilig — geen
  state, geen effecten. Wat beweegt, beweegt via CSS uit globals.css.
*/

/* ------------------------------------------------------------------ merk --- */

/**
 * Het merkteken: een fragment šahovnica, het Kroatische schaakbordpatroon,
 * als sticker op een schrift — met een inktrand, een harde schaduw en een
 * fractie scheef. Drie bij drie in plaats van vijf bij vijf: dan is het een
 * verwijzing en geen vlag, wat het juiste register is voor een studieomgeving.
 */
export function Logo({ size = 38 }: { size?: number }) {
  const cells = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className="shrink-0 overflow-visible"
      style={{ rotate: "-6deg" }}
    >
      <g className="rough">
        <rect x="3.4" y="3.4" width="18" height="18" rx="3" style={{ fill: "var(--color-outline)" }} />
        <rect x="1.5" y="1.5" width="18" height="18" rx="3" fill="#ffffff" />
        {cells.flatMap((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect
                key={`${r}-${c}`}
                x={1.5 + c * 6}
                y={1.5 + r * 6}
                width="6"
                height="6"
                style={{ fill: "var(--color-flag)" }}
              />
            ) : null,
          ),
        )}
        <rect
          x="1.5"
          y="1.5"
          width="18"
          height="18"
          rx="3"
          fill="none"
          style={{ stroke: "var(--color-outline)" }}
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------- checker --- */

/**
 * Een klein plat stukje šahovnica: twee rijen dambord, het merkteken van het
 * platform. Rood, net als het logo.
 */
export function Checker({
  cols = 9,
  cell = 6,
  tone = "var(--color-flag)",
  className = "",
}: {
  cols?: number;
  cell?: number;
  tone?: string;
  className?: string;
}) {
  return (
    <svg
      width={cols * cell}
      height={2 * cell}
      viewBox={`0 0 ${cols * cell} ${2 * cell}`}
      aria-hidden
      className={className}
    >
      {Array.from({ length: 2 }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
          (r + c) % 2 === 0 ? (
            <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={tone} />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* --------------------------------------------------------------- tegels --- */

// De voortgangs-pill leeft in zijn eigen bestand: hij geeft mee als gel
// wanneer er iets bijkomt, en dat vraagt een effect aan de clientkant.
export { StepTiles, outcomeOf } from "./StepPill";
export type { StepOutcome, StepState } from "./StepPill";

/* ----------------------------------------------------------------- kaart --- */

export function Card({
  children,
  className = "",
  lift = false,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  const Tag = as;
  return <Tag className={`card ${lift ? "card-lift" : ""} ${className}`}>{children}</Tag>;
}

/* ------------------------------------------------------------------- pil --- */

const PILL_TONE: Record<string, string> = {
  neutral: "bg-surface text-ink-secondary",
  accent: "bg-accent-wash text-accent",
  warm: "bg-warm-wash text-warm",
  gold: "bg-gold-wash text-gold",
  good: "bg-good-wash text-good-ink",
  bad: "bg-bad-wash text-bad-ink",
  yellow: "bg-pop-yellow text-on-pop",
  pink: "bg-pop-pink text-on-pop",
  mint: "bg-pop-mint text-on-pop",
  sky: "bg-pop-sky text-on-pop",
  lilac: "bg-pop-lilac text-on-pop",
  peach: "bg-pop-peach text-on-pop",
};

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL_TONE | string;
  className?: string;
}) {
  return <span className={`pill ${PILL_TONE[tone] ?? PILL_TONE.neutral} ${className}`}>{children}</span>;
}

/* ------------------------------------------------------------------ vuur --- */

/**
 * De reeks. Het vlammetje flakkert alleen als de reeks vandaag nog leeft —
 * een dode reeks hoort er grijs en stil bij te staan, niet vrolijk te bewegen.
 */
export function Flame({
  days,
  alive = true,
  size = 20,
}: {
  /** Weglaten om alleen het vlammetje te tonen, zonder getal. */
  days?: number;
  alive?: boolean;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Doodle
        name="flame"
        size={size}
        color={alive ? "var(--color-warm-bright)" : "var(--color-line-strong)"}
        className={alive ? "animate-flicker" : ""}
      />
      {days !== undefined ? <span className="tabular text-[15px] font-bold">{days}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------- xp --- */

export function Bolt({ className = "", size = 16 }: { className?: string; size?: number }) {
  return <Doodle name="bolt" size={size} color="var(--color-pop-yellow)" className={className} />;
}

/* ---------------------------------------------------------- paginabreedte --- */

/**
 * Drie breedtes, elk met een reden — en verder geen.
 *
 * Zonder deze component kroop elke pagina naar zijn eigen maat en sprong de
 * inhoud zichtbaar heen en weer bij het navigeren. Nu ligt vast welke maat bij
 * welk soort pagina hoort:
 *
 *   wide    overzichtspagina's met kaartroosters en grafieken
 *   detail  naslag met tabellen die breedte nodig hebben (paradigma's)
 *   focus   één ding tegelijk: lezen, een sessie, een drill. Smal gehouden
 *           omdat een regel van 60-75 tekens het prettigst leest.
 */
const PAGE_WIDTH = {
  wide: "max-w-5xl",
  detail: "max-w-3xl",
  focus: "max-w-2xl",
} as const;

export function Page({
  width = "wide",
  className = "",
  children,
}: {
  width?: keyof typeof PAGE_WIDTH;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto ${PAGE_WIDTH[width]} px-5 py-8 sm:px-8 sm:py-12 ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ paginakop --- */

// De paginakop leeft in zijn eigen bestand: hij leest de route om de stift van
// de sectie te kiezen, en dat kan alleen aan de clientkant.
export { PageHeader } from "./PageHeader";

/* --------------------------------------------------------------- rubriek --- */

export function SectionHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="display text-[28px] text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-[14px] leading-relaxed text-ink-secondary">{hint}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="link-sweep hand shrink-0 text-[14px] font-bold text-accent">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ lege staat --- */

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-line-strong bg-surface/60 px-6 py-8 text-center">
      <p className="mx-auto max-w-md text-[14px] leading-relaxed text-ink-secondary">{children}</p>
    </div>
  );
}
