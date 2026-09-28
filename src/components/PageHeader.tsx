"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { toneFor } from "@/lib/secties";
import { FitTitle } from "./FitTitle";
import { PosterCube } from "./PosterCube";
import { Checker } from "./ui";

/**
 * De kop van elke hoofdpagina: een geplakte affiche in de kleur van de
 * sectie, met de titel van rand tot rand. De inleiding staat eronder op het
 * papier, waar lopende tekst rustig leest.
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
  const tone = toneFor(usePathname());
  return (
    <header className="mb-10">
      <div className={`tone-${tone} block-tone animate-paste relative border-[3px] border-crna px-5 pb-5 pt-5 sm:px-7 sm:pb-6`}>
        <div className="mb-6 flex items-start justify-between gap-4 sm:mb-10">
          <Checker cols={6} cell={7} tone="var(--on-tone)" />
          <PosterCube size={44} className="-mr-1 -mt-1" />
        </div>
        <FitTitle text={title} className="animate-type" />
      </div>
      {intro ? (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">{intro}</p>
      ) : null}
      {children}
    </header>
  );
}
