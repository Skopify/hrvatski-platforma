"use client";

import { useEffect, useRef, useState } from "react";

/*
  Een meter als dikke pill die als gel meegeeft: het vulstuk schuift met een
  kleine overshoot op zijn plek, de hele pill veert mee, en een sticker
  "+12" zweeft omhoog uit het uiteinde als er iets bijkomt.

  Bij het laden vult hij zich van nul tot waar je nu bent — zo zie je de
  voortgang geteld worden. Daarna reageert hij alleen nog op verandering.

  Alleen transform en opacity: het vulstuk is altijd even breed als de pill en
  schuift met translateX naar binnen. Het rechteruiteinde blijft daardoor een
  echt afgerond einde, dat meebeweegt.
*/
export function PillMeter({
  value,
  max,
  color = "var(--color-pop-yellow)",
  height = 34,
  unit = "XP",
  showBurst = true,
  bare = false,
  children,
  className = "",
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  unit?: string;
  /** De "+n"-sticker bij een toename. Niet bij meters die geen XP zijn. */
  showBurst?: boolean;
  /** Geen tekst in de pill (voor kleine meters, bv. in de zijbalk). */
  bare?: boolean;
  /** Tekst in de pill; standaard "value / max unit". */
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const [shown, setShown] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const before = useRef(value);
  const [bursts, setBursts] = useState<{ id: number; n: number }[]>([]);
  const seq = useRef(0);

  // Eerste verf op nul, dan één frame later naar de echte waarde: dat is de
  // beweging bij het laden.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(pct)));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  useEffect(() => {
    if (value > before.current) {
      const n = value - before.current;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        track.current?.animate(
          [
            { transform: "scale(1, 1)" },
            { transform: "scale(1.04, 0.86)", offset: 0.25 },
            { transform: "scale(0.985, 1.1)", offset: 0.5 },
            { transform: "scale(1, 1)" },
          ],
          { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        );
        if (showBurst) {
          const id = ++seq.current;
          setBursts((b) => [...b, { id, n }]);
          setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 950);
        }
      }
    }
    before.current = value;
  }, [value, showBurst]);

  const full = pct >= 1;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={track}
        className="pill-track"
        style={{ height }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={`pill-fill ${full ? "is-full" : ""}`}
          style={{ background: color, ["--from" as string]: `${(shown - 1) * 100}%` }}
        >
          <span className="pill-shine" />
        </div>
        {bare ? null : (
          <div className="relative flex h-full items-center justify-center px-3 text-[13px] font-bold text-on-pop mix-blend-normal">
            <span className="rounded-full bg-surface/80 px-2 py-px text-ink">
              {children ??
                (value === 0 ? (
                  <>begin met één ronde · 0 / {max} {unit}</>
                ) : (
                  <>
                    {value} / {max} {unit}
                  </>
                ))}
            </span>
          </div>
        )}
      </div>

      {/* "+n"-stickers: springen op vanaf het uiteinde van het vulstuk. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="animate-float-up pill absolute -top-2 bg-pop-yellow text-on-pop"
            style={{ left: `calc(${Math.max(pct, 0.08) * 100}% - 20px)` }}
          >
            +{b.n}
          </span>
        ))}
      </div>
    </div>
  );
}
