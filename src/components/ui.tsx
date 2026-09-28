import Link from "next/link";
import type { ReactNode } from "react";

/*
  Gedeelde bouwstenen. Alles hier is puur presentatie en server-veilig — geen
  state, geen effecten. Wat beweegt, beweegt via CSS uit globals.css.
*/

/* ------------------------------------------------------------------ merk --- */

/**
 * Het merkteken: een fragment šahovnica, het Kroatische schaakbordpatroon.
 * Drie bij drie in plaats van vijf bij vijf — dan is het een verwijzing en
 * geen vlag, wat het juiste register is voor een studieomgeving.
 *
 * Rood en wit, de kleuren van het patroon zelf, met rood linksboven zoals op
 * het echte wapen. Het rood staat los van de interface-kleuren: het is het
 * enige plekje waar het voorkomt, en juist daardoor leest het als een merk.
 */
export function Logo({ size = 38 }: { size?: number }) {
  const cells = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  const s = size / 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <clipPath id="logo-clip">
          <rect width={size} height={size} rx={size * 0.26} />
        </clipPath>
      </defs>
      <g clipPath="url(#logo-clip)">
        <rect width={size} height={size} fill="#ffffff" />
        {cells.flatMap((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect
                key={`${r}-${c}`}
                x={c * s}
                y={r * s}
                width={s}
                height={s}
                fill="var(--color-flag)"
              />
            ) : null,
          ),
        )}
      </g>
      {/* Het patroon is voor de helft wit, dus zonder rand zou het merkteken op
          een witte zijbalk uit elkaar vallen in losse rode blokjes. */}
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        rx={size * 0.26 - 0.5}
        fill="none"
        stroke="var(--color-flag)"
        strokeOpacity={0.32}
      />
    </svg>
  );
}

/* --------------------------------------------------------------- checker --- */

/**
 * De šahovnica-band: twee rijen dambord boven elke kop. Het enige ornament van
 * het platform — en het beweegt: bij het laden klappen de vakjes één voor één
 * omhoog, van links naar rechts. Een kinetisch raster in het klein, als groet
 * aan Nove tendencije. Puur CSS (`.checker3d` in globals.css).
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
    <div
      aria-hidden
      className={`checker3d grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, width: cols * cell }}
    >
      {Array.from({ length: 2 * cols }, (_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        return (
          <span
            key={k}
            style={
              {
                width: cell,
                height: cell,
                background: (r + c) % 2 === 0 ? tone : "transparent",
                "--i": c + r * 2,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- tegels --- */

export type StepOutcome = "ok" | "near" | "no";
export type StepState = StepOutcome | "done" | "current" | "todo";

export function outcomeOf(correct: boolean, nearMiss?: boolean): StepOutcome {
  return correct ? (nearMiss ? "near" : "ok") : "no";
}

const TILE_BACK: Record<StepState, string> = {
  ok: "bg-good",
  near: "bg-gold-bright",
  no: "bg-bad",
  done: "bg-crna",
  current: "bg-crna",
  todo: "bg-crna",
};

/**
 * Voortgang in een sessie: één tegel per opgave. Is een opgave klaar, dan
 * kantelt haar tegel om en toont de uitkomst — groen, goud (bijna) of rood.
 * Een doorlopende balk zegt "ergens halverwege"; tegels zeggen "nog zes, en
 * zo ging het tot nu toe".
 */
export function StepTiles({ steps }: { steps: StepState[] }) {
  const done = steps.filter((s) => s !== "todo" && s !== "current").length;
  return (
    <div
      className="flex gap-[3px]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={done}
      aria-label="Voortgang van de sessie"
    >
      {steps.map((s, i) => (
        <span
          key={i}
          className={`tile3d h-3 flex-1 ${s === "todo" || s === "current" ? "" : "is-on"}`}
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <span
            className={`face ${s === "current" ? "bg-zuta ring-2 ring-inset ring-crna" : "bg-sunken"}`}
          />
          <span className={`face back ${TILE_BACK[s]}`} />
        </span>
      ))}
    </div>
  );
}

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
  neutral: "bg-sunken text-ink-secondary",
  accent: "bg-accent-wash text-accent",
  warm: "bg-warm-wash text-warm",
  gold: "bg-gold-wash text-gold",
  good: "bg-good-wash text-good-ink",
  bad: "bg-bad-wash text-bad-ink",
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

/* ------------------------------------------------------------- ringmeter --- */

/**
 * Ronde voortgangsmeter. De ring tekent zichzelf bij het laden — via
 * stroke-dashoffset, dus zonder één regel JavaScript.
 */
export function ProgressRing({
  value,
  max,
  size = 132,
  stroke = 11,
  children,
  tone = "accent",
  track = "var(--color-sunken)",
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  tone?: "accent" | "gold" | "good";
  track?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color =
    tone === "gold"
      ? "var(--color-gold-bright)"
      : tone === "good"
        ? "var(--color-good)"
        : "var(--color-accent-bright)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          className="animate-rise"
          style={{
            strokeDashoffset: circ * (1 - pct),
            transition: "stroke-dashoffset 900ms var(--ease-out-quint)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ vuur --- */

/**
 * De reeks. Het vlammetje flakkert alleen als de reeks vandaag nog leeft —
 * een dode reeks hoort er grijs en stil bij te staan, niet vrolijk te bewegen.
 */
export function Flame({
  days,
  alive = true,
  size = 17,
}: {
  /** Weglaten om alleen het vlammetje te tonen, zonder getal. */
  days?: number;
  alive?: boolean;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        width={size}
        height={size * 1.18}
        viewBox="0 0 17 20"
        aria-hidden
        className={alive ? "animate-flicker" : ""}
      >
        <path
          d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z"
          fill={alive ? "var(--color-warm-bright)" : "var(--color-line-strong)"}
        />
      </svg>
      {days !== undefined ? <span className="tabular text-[15px] font-bold">{days}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------- xp --- */

export function Bolt({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="16" viewBox="0 0 13 16" aria-hidden className={className}>
      <path d="M7.8 0 0 9.2h4.3L5.2 16 13 6.6H8.6L7.8 0Z" fill="currentColor" />
    </svg>
  );
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

// De paginakop leeft in zijn eigen bestand: hij leest de route om de kleur van
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
        <h2 className="display-soft text-[20px] text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{hint}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="link-sweep shrink-0 text-[13px] font-semibold text-accent"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ lege staat --- */

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/50 px-6 py-8 text-center">
      <p className="mx-auto max-w-md text-[13.5px] leading-relaxed text-ink-secondary">{children}</p>
    </div>
  );
}
