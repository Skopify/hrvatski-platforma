"use client";

import { useEffect } from "react";

/*
  Kaarten die meekantelen met de cursor, als objecten in plaats van vlakken.

  Eén luisteraar voor de hele app (event delegation) in plaats van een
  client-component om elke kaart: zo blijven de pagina's servercomponenten en
  werkt het meteen op elke `.card-lift`. De transform wordt rechtstreeks op de
  kaart gezet, niet via een variabele op een ouder — dat zou de stijl van alle
  kinderen laten herberekenen. Alleen op apparaten met een muis, nooit bij
  "minder beweging".
*/
export function TiltLayer() {
  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let current: HTMLElement | null = null;
    let raf = 0;
    let last: PointerEvent | null = null;

    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.transform = "";
    };

    const apply = () => {
      raf = 0;
      const e = last;
      if (!e || !current) return;
      const r = current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      // Grote kaarten kantelen minder: dezelfde hoek oogt op 800px breed als een val.
      const scale = Math.min(1, 520 / Math.max(r.width, 1));
      const rx = (0.5 - y) * 7 * scale;
      const ry = (x - 0.5) * 9 * scale;
      current.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
      current.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      current.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    };

    const onMove = (e: PointerEvent) => {
      if (!fine.matches || reduced.matches || e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".card-lift") ?? null;
      if (el !== current) {
        reset(current);
        current = el;
      }
      if (!current) return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      reset(current);
      current = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
      reset(current);
    };
  }, []);

  return null;
}
