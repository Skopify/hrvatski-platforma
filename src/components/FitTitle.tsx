"use client";

import { useLayoutEffect, useRef } from "react";

/*
  De affichekop: rekt zich op tot hij precies de breedte van zijn blok vult,
  zoals letters op een affiche die van rand tot rand lopen. Lange titels die
  zelfs op de kleinste maat niet passen, mogen over meer regels.

  De eerste verf gebruikt een schatting in CSS (clamp op viewportbreedte);
  daarna meet dit component en zet de precieze maat, vóór de volgende verf.
*/
export function FitTitle({
  text,
  max = 220,
  min = 36,
  className = "",
  as: Tag = "h1",
}: {
  text: string;
  max?: number;
  min?: number;
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const box = useRef<HTMLDivElement>(null);
  const span = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const s = span.current;
      if (!b || !s) return;
      s.style.whiteSpace = "nowrap";
      s.style.fontSize = "100px";
      const natural = s.scrollWidth;
      const target = b.clientWidth;
      if (!natural || !target) return;
      const size = (100 * target) / natural;
      if (size < min) {
        s.style.fontSize = `${min}px`;
        s.style.whiteSpace = "normal";
      } else {
        s.style.fontSize = `${Math.min(max, size * 0.995)}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [text, max, min]);

  return (
    <div ref={box} className={`min-w-0 ${className}`}>
      <Tag className="m-0">
        <span
          ref={span}
          className="poster-title hr-text inline-block whitespace-nowrap pb-[0.06em]"
          style={{ fontSize: `clamp(${min}px, ${Math.round(160 / Math.max(text.length, 4))}vw, ${max}px)` }}
        >
          {text}
        </span>
      </Tag>
    </div>
  );
}
