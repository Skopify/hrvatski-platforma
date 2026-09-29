"use client";

import { useEffect } from "react";

/*
  Het "hover-effect" van visionOS: een klikbare kaart licht zacht op waar de
  cursor staat, zodat je ziet wat je gaat raken nog vóór je klikt.

  Eén luisteraar voor de hele app (event delegation), zodat de pagina's
  servercomponenten blijven. Hij zet alleen de positie van het licht; de rest
  doet CSS (`.card-lift::after`). Alleen met een muis.
*/
export function HoverLight() {
  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let raf = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      if (!last) return;
      const el = (last.target as Element | null)?.closest?.<HTMLElement>(".card-lift");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(((last.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(((last.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    };
    const onMove = (e: PointerEvent) => {
      if (!fine.matches || e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
