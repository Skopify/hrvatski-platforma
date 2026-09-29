"use client";

import { useEffect, useRef } from "react";

import { island } from "@/lib/island";

/*
  Het dagdoel gehaald: één keer per dag een korte confettiregen vanaf de
  ring, en een melding in het eiland. Zeldzaam, dus mag het feestelijk zijn.
  Nooit bij minder beweging (dan alleen de melding), en nooit twee keer
  op dezelfde dag.
*/
// De stiften van het platform, zodat de confetti bij de rest hoort.
const COLORS = ["#ffe45c", "#ffb3d1", "#a8ecc8", "#a9d8ff", "#cdbcff", "#ffc9a3", "#3b4cff"];

export function Celebrate({ when, day }: { when: boolean; day: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!when || !day) return;
    const key = `hr-gevierd-${day}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    island({ text: "Dagdoel gehaald", sub: "Alles wat je nu nog doet, is winst.", tone: "good" });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = innerWidth * dpr;
    el.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const origin = { x: innerWidth * 0.5, y: innerHeight * 0.32 };
    const bits = Array.from({ length: 140 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 7 + Math.random() * 9;
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.32;
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2200);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.c;
        ctx.strokeStyle = "#1b1a22";
        ctx.lineWidth = 1.4;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      if (t < 2200) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [when, day]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[65] h-full w-full" />;
}
