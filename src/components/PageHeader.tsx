"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Squiggle } from "./doodles";
import { SectionSticker, sectionFor } from "./sections";

/**
 * De kop van elke hoofdpagina: de sticker van de sectie, een grote titel met
 * een golf eronder in de stift van die sectie, en dan de inleiding op papier.
 * De golf tekent zichzelf bij het openen van de pagina — kort, want je ziet
 * hem bij elke pagina.
 *
 * Scrol je de titel uit beeld, dan verschijnt hij klein in een balk bovenaan:
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
  const section = sectionFor(usePathname());
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = heading.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-60px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header className="relative mb-10">
      <div
        aria-hidden
        className={`glass fixed inset-x-0 top-0 z-30 flex h-[58px] items-center justify-center gap-3 px-16 transition-opacity duration-150 md:left-[92px] lg:left-[268px] ${
          compact ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <SectionSticker section={section} size={30} tilt={-5} />
        <span className="display truncate text-[24px]">{title}</span>
      </div>

      <SectionSticker section={section} size={56} tilt={-5} className="mb-5" />
      <h1 ref={heading} className="display text-[42px] text-ink sm:text-[60px]">
        <span className="relative inline-block pb-3">
          {title}
          <Squiggle color={section.deep} className="absolute -bottom-0.5 left-0 h-[14px] w-full" />
        </span>
      </h1>
      {intro ? (
        <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-ink-secondary">{intro}</p>
      ) : null}
      {children}
    </header>
  );
}
