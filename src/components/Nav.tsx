"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { ThemeToggle } from "./ThemeToggle";
import { Bolt, Logo } from "./ui";

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
    Eén selectie voor het hele menu, die met een veer naar het nieuwe item
    schuift — zoals de selectie in de zijbalk van iPadOS. Je ziet waar je
    vandaan komt en waar je heen gaat. De eerste keer zonder animatie: dan is
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

  return (
    /*
      Drie vormen van dezelfde navigatie:
        telefoon  — tabbalk van glas onderaan; iconen, en alleen het actieve
                    item draagt zijn naam (acht leesbare labels passen niet)
        tablet    — smalle zijbalk met icoon en klein label
        scherm    — volle zijbalk zoals iPadOS: icoon en naam naast elkaar
    */
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 flex h-[calc(56px+env(safe-area-inset-bottom))] shrink-0 flex-row items-stretch border-t border-[var(--material-edge)] px-1 pb-[env(safe-area-inset-bottom)] md:sticky md:inset-auto md:top-0 md:h-screen md:w-[88px] md:flex-col md:items-stretch md:border-r md:border-t-0 md:px-2 md:pb-4 md:pt-5 lg:w-[256px] lg:px-4"
      aria-label="Hoofdnavigatie"
    >
      <Link
        href="/"
        title="Hrvatski — leerplatform"
        className="mb-6 hidden items-center justify-center gap-3 rounded-xl px-2 py-1 md:flex lg:justify-start"
      >
        <Logo size={30} />
        <span className="hidden text-[17px] font-bold tracking-tight lg:inline">Hrvatski</span>
      </Link>

      <ul
        ref={list}
        className="relative flex w-full flex-1 flex-row items-center justify-between md:flex-col md:items-stretch md:justify-start md:gap-0.5"
      >
        {box ? (
          <li
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 hidden rounded-xl bg-accent-wash md:block lg:bg-accent-fill"
            style={{
              width: box.w,
              height: box.h,
              transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
              transition: animate ? "transform 460ms var(--ease-ios)" : "none",
            }}
          />
        ) : null}

        {LINKS.map((link, i) => {
          const active = i === activeIndex;
          const badge = link.href === "/oefenen" && due > 0 ? due : null;

          return (
            <li key={link.href} className="relative flex">
              <Link
                href={link.href}
                data-nav
                aria-current={active ? "page" : undefined}
                aria-label={link.label}
                className={`group relative flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-200 md:h-auto md:gap-1 md:py-2.5 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${
                  active
                    ? "min-w-[64px] px-1.5 text-accent lg:text-on-fill"
                    : "min-w-[38px] text-ink-muted hover:text-ink lg:text-ink lg:hover:bg-sunken"
                }`}
              >
                <span
                  key={active ? "aan" : "uit"}
                  className={`relative transition-transform duration-150 group-active:scale-90 ${active ? "animate-pop" : ""}`}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 2 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {ICONS[link.icon]}
                  </svg>
                  {badge ? (
                    <span className="num absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] leading-[18px] text-on-fill lg:hidden">
                      {badge > 99 ? "99" : badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`whitespace-nowrap text-[10.5px] font-semibold leading-none lg:text-[15px] lg:font-medium ${
                    active ? "" : "hidden md:inline"
                  }`}
                >
                  {link.label}
                </span>
                {badge ? (
                  <span
                    className={`num ml-auto hidden rounded-full px-2 text-[12px] leading-[20px] lg:inline ${
                      active ? "bg-on-fill/25 text-on-fill" : "bg-bad text-on-fill"
                    }`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Reeks, XP en het thema. */}
      <div className="hidden shrink-0 md:flex md:flex-col md:items-center md:gap-3 md:border-t md:border-line md:pt-4 lg:flex-row lg:justify-between lg:px-2">
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-4">
          <span
            title={`Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}`}
            className={`flex flex-col items-center gap-0.5 text-[12px] lg:flex-row lg:gap-1.5 lg:text-[14px] ${
              streak > 0 ? "text-warm" : "text-ink-muted"
            }`}
          >
            <svg width="14" height="17" viewBox="0 0 17 20" aria-hidden className={streak > 0 ? "animate-flicker" : ""}>
              <path
                d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z"
                fill={streak > 0 ? "var(--color-warm-bright)" : "var(--color-line-strong)"}
              />
            </svg>
            <span className="num">{streak}</span>
          </span>
          <span
            title={`${xp} XP totaal`}
            className="flex flex-col items-center gap-0.5 text-[12px] text-ink-muted lg:flex-row lg:gap-1.5 lg:text-[14px]"
          >
            <Bolt className="text-gold-bright" />
            <span className="num text-ink">{xp > 9999 ? `${Math.floor(xp / 1000)}k` : xp}</span>
          </span>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
