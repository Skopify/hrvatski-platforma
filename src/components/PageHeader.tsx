"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * De kop van elke hoofdpagina, zoals een grote titel in iOS. Scrol je hem uit
 * beeld, dan verschijnt dezelfde titel klein in een glazen balk bovenaan —
 * hij "krimpt" naar boven, zodat je altijd weet waar je bent.
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
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = heading.current;
    if (!el) return;
    // Compact zodra de onderkant van de grote titel onder de balk verdwijnt.
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-52px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header className="mb-8">
      <div
        aria-hidden
        className={`glass fixed inset-x-0 top-0 z-30 flex h-[52px] items-center justify-center border-b border-[var(--material-edge)] px-16 transition-opacity duration-200 md:left-[88px] lg:left-[256px] ${
          compact ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <span
          className="truncate text-[15px] font-semibold transition-transform duration-300 [transition-timing-function:var(--ease-ios)]"
          style={{ transform: compact ? "translateY(0)" : "translateY(10px)" }}
        >
          {title}
        </span>
      </div>

      <h1 ref={heading} className="display text-[34px] text-ink sm:text-[40px]">
        {title}
      </h1>
      {intro ? (
        <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">{intro}</p>
      ) : null}
      {children}
    </header>
  );
}
