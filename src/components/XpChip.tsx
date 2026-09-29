"use client";

import { useEffect, useRef } from "react";

import { Doodle } from "./doodles";

/*
  De XP-teller in de kop van een sessie: een gele sticker die een tikje
  opspringt als er XP bijkomt. Zo hoor je "het antwoord telde" zonder dat je
  ernaar hoeft te zoeken. WAAPI in plaats van een CSS-class, zodat een tweede
  antwoord direct na het eerste de sprong gewoon opnieuw start.
*/
export function XpChip({ xp }: { xp: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const before = useRef(xp);

  useEffect(() => {
    if (xp > before.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.current?.animate(
        [
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(1.22) rotate(-5deg)", offset: 0.4 },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 340, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    }
    before.current = xp;
  }, [xp]);

  return (
    <span ref={el} className="pill gap-1 bg-pop-yellow px-2.5 text-on-pop" aria-label={`${xp} XP deze sessie`}>
      <Doodle name="bolt" size={16} color="#ffffff" />
      <span className="num text-[15px] tabular-nums">{xp}</span>
    </span>
  );
}
