"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

/*
  Alle grafieken hier zijn handgeschreven SVG — geen grafiekbibliotheek, want een
  bibliotheek kost meer kilobytes dan deze hele map en levert grafieken op die er
  uitzien als andermans grafieken.

  Eén set regels voor alles:
    · lijnen 2.5px met ronde einden, onder de lijn een verloop dat naar niets zakt
    · staven maximaal 24px dik, 4px afgerond aan de datakant, vierkant op de nullijn
    · gridlijnen als haarlijn, één stap van de ondergrond
    · labels alleen op het eindpunt of het uiterste — nooit een getal bij elk punt
*/

const INK = "var(--color-ink)";
const MUTED = "var(--color-ink-muted)";
const GRID = "var(--color-line-soft)";
const BASE = "var(--color-line)";
const ACCENT = "var(--color-accent)";
const BRIGHT = "var(--color-accent-bright)";
const SURFACE = "var(--color-surface)";
const HAND = "var(--font-hand)";
const DISPLAY = "var(--font-display)";

/* ------------------------------------------------------------ grafiekkaart --- */

const CARD_POP = {
  sky: "bg-pop-sky",
  mint: "bg-pop-mint",
  lilac: "bg-pop-lilac",
  yellow: "bg-pop-yellow",
  peach: "bg-pop-peach",
} as const;

/**
 * De kaart om elke grafiek: een pastelvlak met inktrand en harde schaduw, een
 * kop in de displayletter, een handgeschreven toelichting, en de grafiek zelf
 * op een wit vlak zodat lijnen en cijfers altijd leesbaar zijn (ook in het
 * donker: binnen een pastelvlak gelden de lichte kleuren).
 */
function ChartCard({
  title,
  hint,
  pop = "sky",
  children,
}: {
  title: string;
  hint?: string;
  pop?: keyof typeof CARD_POP;
  children: React.ReactNode;
}) {
  return (
    <figure className={`rounded-card border-2 border-outline p-5 text-on-pop shadow-[var(--hard)] ${CARD_POP[pop]}`}>
      <figcaption>
        <span className="display text-[22px] leading-tight">{title}</span>
      </figcaption>
      {hint ? <p className="hand mb-3 mt-1 text-[13.5px] font-bold leading-snug">{hint}</p> : <div className="mb-3" />}
      <div className="rounded-[20px] border-2 border-outline bg-white p-3">{children}</div>
    </figure>
  );
}

/* ------------------------------------------------------------- stattegel --- */

/**
 * Eén kerncijfer. Het getal staat in de displayletter en op 34px: dat is de reden
 * dat je hem in één oogopslag leest zonder het label te hoeven zoeken.
 */
const TILE_POP = {
  neutral: "bg-pop-lilac",
  accent: "bg-pop-sky",
  good: "bg-pop-mint",
  warm: "bg-pop-peach",
  gold: "bg-pop-yellow",
  bad: "bg-pop-pink",
} as const;

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  meter,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "accent" | "good" | "warm" | "gold" | "bad";
  icon?: React.ReactNode;
  /** Optionele voortgangsbalk onderin, 0-1. */
  meter?: number;
}) {
  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-card border-2 border-outline px-5 py-4 text-on-pop shadow-[var(--hard)] ${TILE_POP[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="hand text-[14px] font-bold">{label}</p>
        {icon ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-outline bg-white"
          >
            {icon}
          </span>
        ) : null}
      </div>
      {/* Het getal is inkt; kleur alleen als hij iets betekent (goed of fout). */}
      <p className="num mt-2 text-[40px] leading-none">{value}</p>
      {sub ? <p className="mt-2 text-[13.5px] font-semibold leading-snug">{sub}</p> : null}
      {/* De balk zakt naar de voet van de tegel, zodat tegels met en zonder balk
          in dezelfde rij dezelfde hoogte houden. */}
      {meter !== undefined ? (
        <div className="mt-auto pt-3">
          <div className="h-3.5 w-full overflow-hidden rounded-full border-2 border-outline bg-surface">
            <div
              className="h-full rounded-full border-r-2 border-outline bg-pop-yellow animate-grow-x origin-left"
              style={{
                width: `${Math.min(100, Math.max(meter * 100, meter > 0 ? 4 : 0))}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- meter --- */

export function Meter({
  value,
  max,
  caption,
  height = 10,
}: {
  value: number;
  max: number;
  caption?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div>
      <div
        className="w-full overflow-hidden rounded-full border-2 border-outline bg-surface"
        style={{ height: Math.max(height, 14) }}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full border-r-2 border-outline bg-pop-yellow animate-grow-x origin-left"
          style={{ width: `${Math.max(pct * 100, value > 0 ? 3 : 0)}%` }}
        />
      </div>
      {caption ? <p className="mt-2.5 text-[13px] text-ink-secondary">{caption}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- sparkline --- */

/** Minigrafiek zonder assen — alleen de vorm van het verloop. */
export function Sparkline({
  data,
  height = 34,
  tone = ACCENT,
}: {
  data: number[];
  height?: number;
  tone?: string;
}) {
  const w = 120;
  const h = height;
  const max = Math.max(...data, 1);
  const x = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * w);
  const y = (v: number) => h - 2 - (v / max) * (h - 4);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={tone} fillOpacity={0.08} />
      <path
        d={line}
        pathLength={1}
        className="animate-draw"
        style={{ "--len": 1 } as React.CSSProperties}
        fill="none"
        stroke={tone}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * De breedte van de kaart, zodat de grafiek 1:1 getekend wordt. Met een vaste
 * tekenbreedte krimpt alles mee op een telefoon en wordt 13px-tekst 8px.
 */
function useChartWidth(fallback = 420) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const meet = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ------------------------------------------------------------ lijngrafiek --- */

export interface Point {
  label: string;
  value: number;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 0.25, 0.5, 0.75, 1];
  const step = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const norm = step / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const s = nice * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + s * 0.001; v += s) out.push(v);
  return out;
}

/** Vloeiende curve door de punten — Catmull-Rom, omgezet naar bézier. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // Tension 0.5 houdt de curve dicht bij de data; hoger gaat overschieten en
    // dan suggereert de grafiek waarden die er niet zijn.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    // Binnen het bereik van de twee punten blijven: een curve die eronder duikt
    // toont een dip (soms onder 0%) die in de data niet bestaat.
    const c1y = Math.min(hi, Math.max(lo, p1.y + (p2.y - p0.y) / 6));
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = Math.min(hi, Math.max(lo, p2.y - (p3.y - p1.y) / 6));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function LineChart({
  data,
  title,
  hint,
  format = (v) => String(Math.round(v)),
  yMax,
  percent = false,
  height = 210,
  smooth = true,
}: {
  data: Point[];
  title: string;
  hint?: string;
  format?: (v: number) => string;
  yMax?: number;
  percent?: boolean;
  height?: number;
  smooth?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const pad = { top: 18, right: 72, bottom: 30, left: 54 };
  const [boxRef, w] = useChartWidth();
  const h = height;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const max = yMax ?? Math.max(...data.map((d) => d.value), percent ? 1 : 1);
  const ticks = percent ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(max);
  const top = percent ? 1 : Math.max(...ticks, max);

  const x = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => innerH - (top > 0 ? (v / top) * innerH : 0);

  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const path = smooth
    ? smoothPath(pts)
    : pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${x(data.length - 1)},${innerH} L0,${innerH} Z`;
  const last = data[data.length - 1];
  const hasData = data.some((d) => d.value > 0);

  return (
    <ChartCard title={title} hint={hint} pop="sky">
      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={BASE} strokeWidth={1.5} strokeDasharray="1 7" strokeLinecap="round" />
                <text fontFamily={HAND} fontWeight={700}
                  x={-9}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={13}
                  fill={MUTED}
                  className="tabular"
                >
                  {percent ? `${Math.round(t * 100)}%` : format(t)}
                </text>
              </g>
            ))}
            <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={INK} strokeWidth={2.5} strokeLinecap="round" filter="url(#rough-chart)" />
            <line x1={0} x2={0} y1={0} y2={innerH} stroke={INK} strokeWidth={2.5} strokeLinecap="round" filter="url(#rough-chart)" />

            {hasData ? (
              <>
                <path d={area} fill="var(--color-pop-yellow)" fillOpacity={0.7} />
                <path
                  d={path}
                  pathLength={1}
                  className="animate-draw"
                  style={{ "--len": 1 } as React.CSSProperties}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={4}
                  filter="url(#rough-chart)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={x(data.length - 1)} cy={y(last.value)} r={6.5} fill="var(--color-pop-yellow)" stroke={INK} strokeWidth={2.5} />
                <text
                  x={x(data.length - 1) + 11}
                  y={y(last.value)}
                  dominantBaseline="middle"
                  fontSize={17}
                  fill={INK}
                  fontFamily={DISPLAY}
                  fontWeight={800}
                  className="tabular"
                >
                  {percent ? `${Math.round(last.value * 100)}%` : format(last.value)}
                </text>
              </>
            ) : (
              <text fontFamily={HAND} fontWeight={700} x={innerW / 2} y={innerH / 2} textAnchor="middle" fontSize={12} fill={MUTED}>
                Nog geen data
              </text>
            )}

            {hover !== null && hasData ? (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke={BASE} strokeWidth={1} />
                <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={ACCENT} />
                <circle
                  cx={x(hover)}
                  cy={y(data[hover].value)}
                  r={5}
                  fill="none"
                  stroke={SURFACE}
                  strokeWidth={2.5}
                />
              </g>
            ) : null}

            {data.map((d, i) => (
              <rect
                key={`${id}-${i}`}
                x={x(i) - innerW / Math.max(data.length - 1, 1) / 2}
                y={0}
                width={innerW / Math.max(data.length - 1, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            <text fontFamily={HAND} fontWeight={700} x={0} y={innerH + 22} fontSize={13} fill={MUTED}>
              {data[0]?.label}
            </text>
            <text fontFamily={HAND} fontWeight={700} x={innerW} y={innerH + 22} fontSize={13} fill={MUTED} textAnchor="end">
              {last?.label}
            </text>
          </g>
        </svg>

        {hover !== null && hasData ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border-2 border-outline bg-surface px-3 py-1.5 text-[13px] shadow-lg"
            style={{
              left: `${((pad.left + x(hover)) / w) * 100}%`,
              top: `${((pad.top + y(data[hover].value) - 10) / h) * 100}%`,
            }}
          >
            <span className="text-ink-muted">{data[hover].label}</span>{" "}
            <span className="tabular font-bold text-ink">
              {percent ? `${Math.round(data[hover].value * 100)}%` : format(data[hover].value)}
            </span>
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}

/* ----------------------------------------------------------- vlakgrafiek --- */

export function AreaChart({
  data,
  title,
  hint,
  height = 190,
}: {
  data: Point[];
  title: string;
  hint?: string;
  height?: number;
}) {
  const pad = { top: 18, right: 72, bottom: 30, left: 54 };
  const [boxRef, w] = useChartWidth();
  const h = height;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const top = Math.max(...ticks, max);
  const x = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => innerH - (v / top) * innerH;

  const line = smoothPath(data.map((d, i) => ({ x: x(i), y: y(d.value) })));
  const area = `${line} L${x(data.length - 1)},${innerH} L0,${innerH} Z`;
  const last = data[data.length - 1];

  return (
    <ChartCard title={title} hint={hint} pop="mint">
      <div ref={boxRef}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={BASE} strokeWidth={1.5} strokeDasharray="1 7" strokeLinecap="round" />
              <text fontFamily={HAND} fontWeight={700}
                x={-9}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={13}
                fill={MUTED}
                className="tabular"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={INK} strokeWidth={2.5} strokeLinecap="round" filter="url(#rough-chart)" />
            <line x1={0} x2={0} y1={0} y2={innerH} stroke={INK} strokeWidth={2.5} strokeLinecap="round" filter="url(#rough-chart)" />
          <path d={area} fill="var(--color-pop-yellow)" fillOpacity={0.7} />
          <path
            d={line}
            pathLength={1}
            className="animate-draw"
            style={{ "--len": 1 } as React.CSSProperties}
            fill="none"
            stroke={ACCENT}
            strokeWidth={4}
            filter="url(#rough-chart)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={6.5} fill="var(--color-pop-yellow)" stroke={INK} strokeWidth={2.5} />
          <text
            x={x(data.length - 1) + 11}
            y={y(last.value)}
            dominantBaseline="middle"
            fontSize={17}
            fill={INK}
            fontFamily={DISPLAY}
            fontWeight={800}
            className="tabular"
          >
            {Math.round(last.value)}
          </text>
          <text fontFamily={HAND} fontWeight={700} x={0} y={innerH + 22} fontSize={13} fill={MUTED}>
            {data[0]?.label}
          </text>
          <text fontFamily={HAND} fontWeight={700} x={innerW} y={innerH + 22} fontSize={13} fill={MUTED} textAnchor="end">
            {last?.label}
          </text>
        </g>
      </svg>
      </div>
    </ChartCard>
  );
}

/* -------------------------------------------------------------- stavenlijst --- */

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
  emphasis?: boolean;
}


const BAR_FILL = {
  yellow: "bg-pop-yellow",
  mint: "bg-pop-mint",
  sky: "bg-pop-sky",
  pink: "bg-pop-pink",
  peach: "bg-pop-peach",
  lilac: "bg-pop-lilac",
} as const;

/**
 * Staven als dikke pillen met inktrand, zoals «Uren tegenover het niveau» en de
 * meters op het overzicht: een witte pill met een gekleurd vulstuk dat aan het eind
 * een inktlijn heeft. Labels in het handschrift, cijfers in de displayletter.
 * Een staaf die opvalt (emphasis) krijgt koraal in plaats van de gewone kleur.
 */
export function BarList({
  data,
  title,
  hint,
  percent = true,
  emptyLabel = "Nog geen data",
  pop = "lilac",
  fill = "yellow",
}: {
  data: BarDatum[];
  title: string;
  hint?: string;
  percent?: boolean;
  emptyLabel?: string;
  /** De kleur van de kaart. */
  pop?: keyof typeof CARD_POP;
  /** De kleur van het vulstuk. */
  fill?: keyof typeof BAR_FILL;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartCard title={title} hint={hint} pop={pop}>
      {data.length === 0 ? (
        <p className="hand py-6 text-center text-[14px] font-bold">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((d) => {
            const pct = percent ? Math.min(1, d.value) : d.value / max;
            return (
              <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                <span className="hand truncate text-[13.5px] font-bold" title={d.label}>
                  {d.label}
                </span>
                <div className="h-5 w-full overflow-hidden rounded-full border-2 border-outline bg-white">
                  <div
                    className={`h-full origin-left animate-grow-x rounded-full border-r-2 border-outline ${d.emphasis ? "bg-pop-coral" : BAR_FILL[fill]}`}
                    style={{ width: `${d.value > 0 ? Math.max(pct * 100, 4) : 0}%` }}
                  />
                </div>
                <span className="num w-12 text-right text-[15px]">
                  {percent ? `${Math.round(d.value * 100)}%` : Math.round(d.value)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

/* --------------------------------------------------------------- heatmap --- */

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/**
 * Activiteit per dag. De ramp is ordinaal gevalideerd tegen wit: monotone
 * lichtheid, kleinste stap 0.079 ΔL*, lichtste stap 2.25:1 contrast, hue 3°.
 */
export function Heatmap({
  data,
  title,
  hint,
  weeks = 18,
}: {
  data: { date: string; value: number }[];
  title: string;
  hint?: string;
  weeks?: number;
}) {
  const byDate = useMemo(() => new Map(data.map((d) => [d.date, d.value])), [data]);
  const [hover, setHover] = useState<{ date: string; value: number } | null>(null);

  const cells: { date: string; value: number; col: number; row: number; d: Date }[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const offset = (today.getDay() + 6) % 7; // maandag als eerste rij
  const start = new Date(today);
  start.setDate(start.getDate() - offset - (weeks - 1) * 7);

  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setDate(d.getDate() + c * 7 + r);
      if (d > today) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({ date: key, value: byDate.get(key) ?? 0, col: c, row: r, d });
    }
  }

  const max = Math.max(...cells.map((c) => c.value), 1);
  const step = (v: number) => {
    if (v <= 0) return "var(--color-ramp-0)";
    const q = v / max;
    if (q <= 0.2) return "var(--color-ramp-1)";
    if (q <= 0.4) return "var(--color-ramp-2)";
    if (q <= 0.65) return "var(--color-ramp-3)";
    if (q <= 0.85) return "var(--color-ramp-4)";
    return "var(--color-ramp-5)";
  };

  const size = 14;
  const gap = 4;

  // Maandlabels: alleen bij de kolom waarin een nieuwe maand begint.
  const monthMarks: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let c = 0; c < weeks; c++) {
    const cell = cells.find((x) => x.col === c);
    if (!cell) continue;
    const m = cell.d.getMonth();
    if (m !== lastMonth) {
      monthMarks.push({ col: c, label: MONTHS[m] });
      lastMonth = m;
    }
  }

  return (
    <ChartCard title={title} hint={hint} pop="yellow">
      <div className="thin-scroll relative overflow-x-auto">
        <svg
          width={weeks * (size + gap)}
          height={7 * (size + gap) + 16}
          role="img"
          aria-label={title}
          className="max-w-full"
        >
          {monthMarks.map((m) => (
            <text fontFamily={HAND} fontWeight={700}
              key={`${m.col}-${m.label}`}
              x={m.col * (size + gap)}
              y={10}
              fontSize={12}
              fill={MUTED}
            >
              {m.label}
            </text>
          ))}
          {cells.map((c) => (
            <rect
              key={c.date}
              x={c.col * (size + gap)}
              y={c.row * (size + gap) + 16}
              width={size}
              height={size}
              rx={4}
              fill={step(c.value)}
              stroke={c.value > 0 ? INK : "none"}
              strokeWidth={1.5}
              className="animate-cell"
              style={{ "--i": c.col + c.row } as React.CSSProperties}
              onMouseEnter={() => setHover({ date: c.date, value: c.value })}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="tabular hand text-[13.5px] font-bold">
          {hover ? `${hover.date} — ${hover.value} XP` : `Laatste ${weeks} weken`}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="hand text-[13px] font-bold">minder</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="inline-block h-3 w-3 rounded-[4px] border border-outline"
              style={{ background: `var(--color-ramp-${i})` }}
            />
          ))}
          <span className="hand text-[13px] font-bold">meer</span>
        </div>
      </div>
    </ChartCard>
  );
}
