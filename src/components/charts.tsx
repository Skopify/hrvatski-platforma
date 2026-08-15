"use client";

import { useId, useMemo, useState } from "react";

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

/* ------------------------------------------------------------- stattegel --- */

const TONE_TEXT: Record<string, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  good: "text-good-ink",
  warm: "text-warm",
  gold: "text-gold",
  bad: "text-bad-ink",
};

const TONE_WASH: Record<string, string> = {
  neutral: "bg-sunken text-ink-secondary",
  accent: "bg-accent-wash text-accent",
  good: "bg-good-wash text-good-ink",
  warm: "bg-warm-wash text-warm",
  gold: "bg-gold-wash text-gold",
  bad: "bg-bad-wash text-bad-ink",
};

/**
 * Eén kerncijfer. Het getal staat in de displayletter en op 34px: dat is de reden
 * dat je hem in één oogopslag leest zonder het label te hoeven zoeken.
 */
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
    <div className="card card-lift relative flex h-full flex-col overflow-hidden px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
        {icon ? (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_WASH[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`display mt-2 text-[34px] leading-none ${TONE_TEXT[tone]}`}>{value}</p>
      {sub ? <p className="mt-2 text-[12.5px] leading-snug text-ink-secondary">{sub}</p> : null}
      {/* De balk zakt naar de voet van de tegel, zodat tegels met en zonder balk
          in dezelfde rij dezelfde hoogte houden. */}
      {meter !== undefined ? (
        <div className="mt-auto pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
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
        className="w-full overflow-hidden rounded-full bg-sunken"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700"
          style={{ width: `${Math.max(pct * 100, value > 0 ? 3 : 0)}%` }}
        />
      </div>
      {caption ? <p className="mt-2.5 text-[12.5px] text-ink-secondary">{caption}</p> : null}
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
      <path d={line} fill="none" stroke={tone} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
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

  const pad = { top: 16, right: 50, bottom: 26, left: 36 };
  const w = 640;
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
    <figure className="card p-5">
      <figcaption className="mb-1">
        <span className="display-soft text-[15px] text-ink">{title}</span>
      </figcaption>
      {hint ? <p className="mb-3 text-[12px] text-ink-muted">{hint}</p> : <div className="mb-3" />}
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text
                  x={-9}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10.5}
                  fill={MUTED}
                  className="tabular"
                >
                  {percent ? `${Math.round(t * 100)}%` : format(t)}
                </text>
              </g>
            ))}
            <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={BASE} strokeWidth={1} />

            {hasData ? (
              <>
                <path d={area} fill={ACCENT} fillOpacity={0.07} />
                <path
                  d={path}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={x(data.length - 1)} cy={y(last.value)} r={5} fill={ACCENT} />
                <circle
                  cx={x(data.length - 1)}
                  cy={y(last.value)}
                  r={5}
                  fill="none"
                  stroke={SURFACE}
                  strokeWidth={2.5}
                />
                <text
                  x={x(data.length - 1) + 11}
                  y={y(last.value)}
                  dominantBaseline="middle"
                  fontSize={12}
                  fill={INK}
                  fontWeight={700}
                  className="tabular"
                >
                  {percent ? `${Math.round(last.value * 100)}%` : format(last.value)}
                </text>
              </>
            ) : (
              <text x={innerW / 2} y={innerH / 2} textAnchor="middle" fontSize={12} fill={MUTED}>
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

            <text x={0} y={innerH + 17} fontSize={10.5} fill={MUTED}>
              {data[0]?.label}
            </text>
            <text x={innerW} y={innerH + 17} fontSize={10.5} fill={MUTED} textAnchor="end">
              {last?.label}
            </text>
          </g>
        </svg>

        {hover !== null && hasData ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-1.5 text-[12px] shadow-lg"
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
    </figure>
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
  const pad = { top: 16, right: 48, bottom: 26, left: 36 };
  const w = 640;
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
    <figure className="card p-5">
      <figcaption className="mb-1">
        <span className="display-soft text-[15px] text-ink">{title}</span>
      </figcaption>
      {hint ? <p className="mb-3 text-[12px] text-ink-muted">{hint}</p> : <div className="mb-3" />}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={-9}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10.5}
                fill={MUTED}
                className="tabular"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={BASE} strokeWidth={1} />
          <path d={area} fill={ACCENT} fillOpacity={0.07} />
          <path
            d={line}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={5} fill={ACCENT} />
          <circle
            cx={x(data.length - 1)}
            cy={y(last.value)}
            r={5}
            fill="none"
            stroke={SURFACE}
            strokeWidth={2.5}
          />
          <text
            x={x(data.length - 1) + 11}
            y={y(last.value)}
            dominantBaseline="middle"
            fontSize={12}
            fill={INK}
            fontWeight={700}
            className="tabular"
          >
            {Math.round(last.value)}
          </text>
          <text x={0} y={innerH + 17} fontSize={10.5} fill={MUTED}>
            {data[0]?.label}
          </text>
          <text x={innerW} y={innerH + 17} fontSize={10.5} fill={MUTED} textAnchor="end">
            {last?.label}
          </text>
        </g>
      </svg>
    </figure>
  );
}

/* -------------------------------------------------------------- stavenlijst --- */

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
  emphasis?: boolean;
}

function barPath(w: number, h: number, r: number): string {
  const rr = Math.min(r, w, h / 2);
  if (w <= 0) return "";
  return `M0,0 H${w - rr} A${rr},${rr} 0 0 1 ${w},${rr} V${h - rr} A${rr},${rr} 0 0 1 ${w - rr},${h} H0 Z`;
}

export function BarList({
  data,
  title,
  hint,
  percent = true,
  emptyLabel = "Nog geen data",
}: {
  data: BarDatum[];
  title: string;
  hint?: string;
  percent?: boolean;
  emptyLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), percent ? 1 : 1);

  return (
    <figure className="card p-5">
      <figcaption className="mb-1">
        <span className="display-soft text-[15px] text-ink">{title}</span>
      </figcaption>
      {hint ? <p className="mb-4 text-[12px] text-ink-muted">{hint}</p> : <div className="mb-4" />}
      {data.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => {
            const pct = max > 0 ? d.value / max : 0;
            return (
              <li key={d.label} className="grid grid-cols-[128px_1fr_auto] items-center gap-3">
                <span className="truncate text-[12.5px] font-medium text-ink-secondary" title={d.label}>
                  {d.label}
                </span>
                <svg viewBox="0 0 300 14" preserveAspectRatio="none" className="h-3.5 w-full">
                  <rect x={0} y={0} width={300} height={14} fill="var(--color-ramp-0)" rx={0} />
                  <path
                    d={barPath(Math.max(pct * 300, d.value > 0 ? 4 : 0), 14, 4)}
                    fill={d.emphasis ? "var(--color-bad)" : ACCENT}
                  />
                </svg>
                <span className="tabular w-14 text-right text-[12.5px] font-bold text-ink">
                  {percent ? `${Math.round(d.value * 100)}%` : Math.round(d.value)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
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

  const size = 13;
  const gap = 3.5;

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
    <figure className="card p-5">
      <figcaption className="mb-1">
        <span className="display-soft text-[15px] text-ink">{title}</span>
      </figcaption>
      {hint ? <p className="mb-4 text-[12px] text-ink-muted">{hint}</p> : <div className="mb-4" />}
      <div className="thin-scroll relative overflow-x-auto">
        <svg
          width={weeks * (size + gap)}
          height={7 * (size + gap) + 16}
          role="img"
          aria-label={title}
          className="max-w-full"
        >
          {monthMarks.map((m) => (
            <text
              key={`${m.col}-${m.label}`}
              x={m.col * (size + gap)}
              y={10}
              fontSize={10}
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
              rx={3.5}
              fill={step(c.value)}
              onMouseEnter={() => setHover({ date: c.date, value: c.value })}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="tabular text-[12px] text-ink-muted">
          {hover ? `${hover.date} — ${hover.value} XP` : `Laatste ${weeks} weken`}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-muted">minder</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: `var(--color-ramp-${i})` }}
            />
          ))}
          <span className="text-[11px] text-ink-muted">meer</span>
        </div>
      </div>
    </figure>
  );
}
