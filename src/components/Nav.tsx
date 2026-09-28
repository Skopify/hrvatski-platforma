"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { toneFor } from "@/lib/secties";
import { ThemeToggle } from "./ThemeToggle";
import { Bolt } from "./ui";

/* Lijniconen, 21px, één stroke-gewicht — geen icoonbibliotheek nodig. */
const ICONS: Record<string, React.ReactNode> = {
  overzicht: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  lessen: (
    <>
      <path d="M12 3 3 7.2l9 4.2 9-4.2L12 3Z" />
      <path d="M3 12.2 12 16.4l9-4.2" />
      <path d="M3 16.9 12 21l9-4.1" />
    </>
  ),
  grammatica: (
    <>
      <path d="M4 4.5h16" />
      <path d="M4 9.5h16" />
      <path d="M4 14.5h9" />
      <path d="M4 19.5h9" />
      <path d="M17.5 14.5v5" />
      <path d="M15 17h5" />
    </>
  ),
  verhalen: (
    <>
      <path d="M12 6.6C10.6 5.2 8.6 4.5 6 4.5c-1.1 0-2 .1-2.6.3v13c.6-.2 1.5-.3 2.6-.3 2.6 0 4.6.7 6 2.1" />
      <path d="M12 6.6c1.4-1.4 3.4-2.1 6-2.1 1.1 0 2 .1 2.6.3v13c-.6-.2-1.5-.3-2.6-.3-2.6 0-4.6.7-6 2.1" />
      <path d="M12 6.6V20" />
    </>
  ),
  schrijven: (
    <>
      <path d="M4 20.5h16" />
      <path d="M15.6 4.1a2 2 0 0 1 2.8 2.8L9 16.4l-3.6.9.9-3.6 9.3-9.6Z" />
    </>
  ),
  herhalen: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V9H15" />
    </>
  ),
  woorden: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </>
  ),
  voortgang: (
    <>
      <path d="M3.5 20.5V3.5" />
      <path d="M3.5 20.5h17" />
      <path d="M8 17v-4.5" />
      <path d="M13 17V8" />
      <path d="M18 17v-7" />
    </>
  ),
};

/*
  De volgorde is die van het leren, niet die van het bouwen.

  Bovenaan de vier secties waar je iets nieuws doet — grammatica, lezen,
  schrijven — en daaronder wat ondersteunt: de lessen uit het boek, het
  herhalen, de woordenlijst en de cijfers. De lessen stonden eerst tweede,
  omdat ze het eerst gebouwd zijn; dat is geen reden.
*/
const LINKS = [
  { href: "/", label: "Overzicht", icon: "overzicht" },
  { href: "/grammatica", label: "Grammatica", icon: "grammatica" },
  { href: "/verhalen", label: "Verhalen", icon: "verhalen" },
  { href: "/schrijven", label: "Schrijven", icon: "schrijven" },
  { href: "/lessen", label: "Lessen", icon: "lessen" },
  { href: "/oefenen", label: "Oefenen", icon: "herhalen" },
  { href: "/woorden", label: "Woorden", icon: "woorden" },
  { href: "/voortgang", label: "Voortgang", icon: "voortgang" },
];

/**
 * Het logo als kubus: zes kanten šahovnica, in 3D. Bij hover draait hij een
 * kwartslag — een object dat je kunt aanraken, geen plaatje.
 */
function LogoCube({ size = 30 }: { size?: number }) {
  const half = size / 2;
  const faces = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];
  return (
    <span className="block" style={{ width: size, height: size, perspective: 400 }} aria-hidden>
      <span className="cube cube-logo block h-full w-full">
        {faces.map((t) => (
          <i key={t} style={{ transform: t }} />
        ))}
      </span>
    </span>
  );
}

type Box = { x: number; y: number; w: number; h: number };

export function Nav({ streak, xp, due }: { streak: number; xp: number; due: number }) {
  const pathname = usePathname();
  const list = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  const activeIndex = LINKS.findIndex((link) =>
    link.href === "/" ? pathname === "/" : pathname.startsWith(link.href),
  );

  /*
    Eén markering voor het hele menu, die naar het actieve item schuift. Zo
    zie je waar je vandaan komt en waar je heen gaat, in plaats van dat de ene
    knop uit en de andere aan flitst. De eerste keer zonder animatie — dan is
    er geen "vandaan".
  */
  useLayoutEffect(() => {
    const measure = () => {
      const ul = list.current;
      const a = ul?.querySelectorAll<HTMLAnchorElement>("a[data-nav]")[activeIndex];
      if (!ul || !a) return setBox(null);
      const u = ul.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      setBox({ x: r.left - u.left, y: r.top - u.top, w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(t);
    };
  }, [activeIndex]);

  const tone = activeIndex > 0 ? toneFor(LINKS[activeIndex].href) : "crvena";

  return (
    /*
      Een zwarte strook, zoals de rand van een affichewand. Het actieve item is
      een blok in de kleur van zijn sectie; dat blok schuift naar het nieuwe
      item en neemt onderweg de nieuwe kleur aan.

      Op de telefoon een balk onderaan: iconen, en alleen het actieve item
      krijgt zijn naam erbij (acht leesbare labels passen niet naast elkaar).
    */
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(60px+env(safe-area-inset-bottom))] shrink-0 flex-row items-stretch border-t-[3px] border-zuta bg-[#121212] px-1 pb-[env(safe-area-inset-bottom)] text-[#fbfbf7] md:sticky md:inset-auto md:top-0 md:h-screen md:w-[96px] md:flex-col md:items-center md:border-r-[3px] md:border-t-0 md:px-0 md:pb-0 md:pt-5"
      aria-label="Hoofdnavigatie"
    >
      <Link
        href="/"
        title="Hrvatski — leerplatform"
        aria-label="Naar het overzicht"
        className="cube-wrap hidden shrink-0 items-center justify-center p-2 md:mb-6 md:flex"
      >
        <LogoCube size={32} />
      </Link>

      <ul
        ref={list}
        className="relative flex w-full flex-1 flex-row items-center justify-between px-0.5 md:w-full md:flex-col md:items-stretch md:justify-start md:gap-0 md:px-0"
      >
        {box ? (
          <li
            aria-hidden
            className={`tone-${tone} pointer-events-none absolute left-0 top-0`}
            style={{
              width: box.w,
              height: box.h,
              // Zwart op zwart zie je niet: de zwarte sectie krijgt een vel papier.
              background: tone === "crna" ? "#fbfbf7" : "var(--tone)",
              transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
              transition: animate
                ? "transform 380ms var(--ease-in-out-strong), width 380ms var(--ease-in-out-strong), height 380ms var(--ease-in-out-strong), background-color 380ms ease"
                : "none",
            }}
          />
        ) : null}

        {LINKS.map((link, i) => {
          const active = i === activeIndex;
          const badge = link.href === "/oefenen" && due > 0 ? due : null;
          const on = active ? toneFor(link.href) : null;

          return (
            <li key={link.href} className="relative flex md:w-full">
              <Link
                href={link.href}
                data-nav
                aria-current={active ? "page" : undefined}
                aria-label={link.label}
                className={`group relative flex h-12 w-full flex-col items-center justify-center gap-1 transition-colors duration-200 md:h-auto md:py-3 ${
                  active
                    ? `min-w-[66px] px-2 ${on === "zuta" || on === "crna" ? "text-[#121212]" : "text-[#fbfbf7]"}`
                    : "min-w-[38px] text-[#fbfbf7]/60 hover:text-[#fbfbf7]"
                }`}
              >
                <span className="relative transition-transform duration-150 group-active:scale-90">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    aria-hidden
                  >
                    {ICONS[link.icon]}
                  </svg>
                  {badge ? (
                    <span className="num absolute -right-3 -top-2 min-w-[20px] border-2 border-[#121212] bg-zuta px-1 text-center text-[11px] leading-[16px] text-[#121212]">
                      {badge > 99 ? "99" : badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`label-caps whitespace-nowrap !text-[10.5px] leading-none !tracking-[0.04em] ${
                    active ? "animate-rise" : "hidden md:inline"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden shrink-0 md:flex md:w-full md:flex-col md:items-center md:gap-3 md:border-t-[3px] md:border-[#fbfbf7]/15 md:py-4">
        <span
          title={`Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}`}
          className={`flex flex-col items-center gap-0.5 text-[12px] ${streak > 0 ? "text-[#ff6b5e]" : "text-[#fbfbf7]/50"}`}
        >
          <svg width="14" height="17" viewBox="0 0 17 20" aria-hidden className={streak > 0 ? "animate-flicker" : ""}>
            <path
              d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z"
              fill="currentColor"
            />
          </svg>
          <span className="num text-[15px]">{streak}</span>
        </span>

        <span title={`${xp} XP totaal`} className="flex flex-col items-center gap-0.5 text-[12px] text-zuta">
          <Bolt />
          <span className="num text-[13px] text-[#fbfbf7]">{xp > 9999 ? `${Math.floor(xp / 1000)}k` : xp}</span>
        </span>

        <ThemeToggle onDark />
      </div>
    </nav>
  );
}
