"use client";

import { useLayoutEffect, useState } from "react";

/*
  Het dagdoel als šahovnica: twaalf tegels, één per twaalfde van het doel.
  Wat je verdient, kantelt om naar rood — en alleen wat er sinds je vorige
  bezoek bij kwam, kantelt waar je bij bent. De rest staat er al. Zo betekent
  de beweging iets: dit heb je net gedaan.
*/
const CELLS = 12;

export function DayTiles({ xp, goal, day }: { xp: number; goal: number; day: string }) {
  const earned = goal > 0 ? Math.min(CELLS, Math.floor((xp / goal) * CELLS)) : 0;
  const [shown, setShown] = useState(earned);
  const [instant, setInstant] = useState(false);
  const [from, setFrom] = useState(0);

  useLayoutEffect(() => {
    const key = `hr-dagtegels-${day}`;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(key) ?? 0) || 0;
    } catch {}
    try {
      localStorage.setItem(key, String(earned));
    } catch {}
    if (seen >= earned) return;
    setInstant(true);
    setFrom(seen);
    setShown(seen);
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setInstant(false);
        setShown(earned);
      }),
    );
    return () => cancelAnimationFrame(r);
  }, [day, earned]);

  return (
    <div
      className="grid w-full max-w-[300px] grid-cols-6 gap-[5px]"
      role="img"
      aria-label={`Dagdoel: ${xp} van ${goal} XP`}
    >
      {Array.from({ length: CELLS }, (_, i) => {
        const r = Math.floor(i / 6);
        const c = i % 6;
        const solid = (r + c) % 2 === 0;
        const on = i < shown;
        return (
          <span
            key={i}
            className={`tile3d aspect-square rounded-[7px] ${on ? "is-on" : ""}`}
            style={
              {
                "--i": Math.max(0, i - from),
                transitionDuration: instant ? "0ms" : undefined,
              } as React.CSSProperties
            }
          >
            <span className="face border border-line bg-sunken" />
            <span
              className={`face back ${solid ? "bg-flag" : "border-2 border-flag bg-surface"}`}
            />
          </span>
        );
      })}
    </div>
  );
}
