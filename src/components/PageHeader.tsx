"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AppIcon, sectionFor } from "./sections";

/**
 * De kop van elke hoofdpagina. Het app-icoon van de sectie, een grote titel
 * zoals in iOS, en daarachter een zachte gloed in de kleur van de sectie —
 * je voelt waar je bent zonder dat de pagina kleurt.
 *
 * Scrol je de titel uit beeld, dan verschijnt hij klein in een glazen balk
 * bovenaan: hij "krimpt" naar boven, zodat je altijd weet waar je bent.
 *
 * Eén component, zodat "overal hetzelfde" door de code wordt afgedwongen.
 */
export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** Extra elementen onder de inleiding, bijvoorbeeld knoppen. */
  children?: ReactNode;
}) {
  const section = sectionFor(usePathname());
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = heading.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header className="relative mb-9">
      <div aria-hidden className="section-glow" style={{ "--glow": section.hue[1] } as React.CSSProperties} />

      <div
        aria-hidden
        className={`glass fixed inset-x-0 top-0 z-30 flex h-[56px] items-center justify-center gap-2.5 border-b border-[var(--material-edge)] px-16 transition-opacity duration-200 md:left-[88px] lg:left-[264px] ${
          compact ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <span
          className="flex items-center gap-2.5 transition-transform duration-300 [transition-timing-function:var(--ease-ios)]"
          style={{ transform: compact ? "translateY(0)" : "translateY(12px)" }}
        >
          <AppIcon section={section} size={22} />
          <span className="truncate text-[15px] font-semibold">{title}</span>
        </span>
      </div>

      <div className="relative">
        <AppIcon section={section} size={44} className="mb-4" />
        <h1 ref={heading} className="display text-[36px] text-ink sm:text-[44px]">
          {title}
        </h1>
        {intro ? (
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-secondary">{intro}</p>
        ) : null}
        {children}
      </div>
    </header>
  );
}
