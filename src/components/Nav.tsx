"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { SearchButton } from "./CommandMenu";
import { AppIcon, ICONS, SECTIONS } from "./sections";
import { ThemeToggle } from "./ThemeToggle";
import { Bolt, Logo } from "./ui";

/*
  De volgorde is die van het leren, niet die van het bouwen: bovenaan waar
  je iets nieuws doet — grammatica, lezen, schrijven — en daaronder wat
  ondersteunt: de lessen, het herhalen, de woordenlijst en de cijfers.
*/

type Box = { x: number; y: number; w: number; h: number };

/** Meet de positie van het actieve item, zodat één markering ernaartoe kan schuiven. */
function useIndicator(activeIndex: number) {
  const list = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const ul = list.current;
      const a = ul?.querySelectorAll<HTMLAnchorElement>("a[data-nav]")[activeIndex];
      if (!ul || !a || !a.offsetParent) return setBox(null);
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

  return { list, box, animate };
}

export function Nav({ streak, xp, due }: { streak: number; xp: number; due: number }) {
  const pathname = usePathname();
  const activeIndex = SECTIONS.findIndex((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href),
  );
  const side = useIndicator(activeIndex);
  const tab = useIndicator(activeIndex);

  const slide = (animate: boolean) => (animate ? "transform 520ms var(--ease-ios)" : "none");

  return (
    <>
      {/* ═══ Zijbalk (tablet en groter): zoals Instellingen op een iPad ═══ */}
      <nav
        aria-label="Hoofdnavigatie"
        className="sticky top-0 z-40 hidden h-screen w-[88px] shrink-0 flex-col border-r border-[var(--material-edge)] bg-[color-mix(in_srgb,var(--color-surface)_55%,transparent)] px-2 pb-4 pt-5 backdrop-blur-xl md:flex lg:w-[264px] lg:px-4"
      >
        <Link href="/" className="mb-5 flex items-center justify-center gap-3 px-2 lg:justify-start" title="Hrvatski — leerplatform">
          <Logo size={34} />
          <span className="hidden leading-tight lg:block">
            <span className="block text-[17px] font-bold tracking-tight text-ink">Hrvatski</span>
            <span className="block text-[12px] text-ink-muted">Kroatisch leren</span>
          </span>
        </Link>

        <SearchButton compact className="mx-auto mb-4 h-10 w-10 justify-center bg-sunken lg:hidden" />
        <SearchButton className="mb-5 hidden h-10 bg-sunken px-3 lg:flex" />

        <ul ref={side.list} className="relative flex flex-1 flex-col gap-0.5">
          {side.box ? (
            <li
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-[12px] bg-[rgb(0_0_0/0.06)] dark:bg-white/10"
              style={{
                width: side.box.w,
                height: side.box.h,
                transform: `translate3d(${side.box.x}px, ${side.box.y}px, 0)`,
                transition: slide(side.animate),
              }}
            />
          ) : null}
          {SECTIONS.map((s, i) => {
            const active = i === activeIndex;
            const badge = s.key === "oefenen" && due > 0 ? due : null;
            return (
              <li key={s.href} className="relative">
                <Link
                  href={s.href}
                  data-nav
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 transition-colors lg:flex-row lg:gap-3 lg:px-2.5 lg:py-[7px]"
                >
                  <span className="relative transition-transform duration-200 group-active:scale-90">
                    <AppIcon section={s} size={30} />
                    {badge ? (
                      <span className="num absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] leading-[18px] text-white ring-2 ring-surface lg:hidden">
                        {badge > 99 ? "99" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-[10.5px] leading-none text-ink lg:text-[15px] ${active ? "font-semibold" : "font-medium text-ink-secondary lg:text-ink"}`}
                  >
                    {s.label}
                  </span>
                  {badge ? (
                    <span className="num ml-auto hidden rounded-full bg-bad px-2 text-[12px] leading-[20px] text-white lg:inline">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Reeks, XP en het thema — een klein kaartje onderin, zoals je profiel. */}
        <div className="flex flex-col items-center gap-3 border-t border-[var(--material-edge)] pt-4 lg:flex-row lg:justify-between lg:px-1">
          <div className="flex flex-col items-center gap-2.5 lg:flex-row lg:gap-4">
            <span
              title={`Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}`}
              className={`flex flex-col items-center gap-0.5 text-[12px] lg:flex-row lg:gap-1.5 lg:text-[14px] ${streak > 0 ? "text-warm" : "text-ink-muted"}`}
            >
              <svg width="14" height="17" viewBox="0 0 17 20" aria-hidden className={streak > 0 ? "animate-flicker" : ""}>
                <path
                  d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z"
                  fill={streak > 0 ? "var(--color-warm-bright)" : "var(--color-line-strong)"}
                />
              </svg>
              <span className="num">{streak}</span>
            </span>
            <span title={`${xp} XP totaal`} className="flex flex-col items-center gap-0.5 text-[12px] lg:flex-row lg:gap-1.5 lg:text-[14px]">
              <Bolt className="text-gold-bright" />
              <span className="num text-ink">{xp > 9999 ? `${Math.floor(xp / 1000)}k` : xp.toLocaleString("nl-NL")}</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* ═══ Tabbalk (telefoon): een zwevende capsule van Liquid Glass ═══
          Acht leesbare labels passen niet naast elkaar; daarom iconen, en het
          actieve item krijgt zijn naam en zijn eigen kleur. Een glazen lens
          schuift met een veer naar het item dat je kiest. */}
      <nav
        aria-label="Hoofdnavigatie"
        className="liquid fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 flex h-[62px] items-stretch rounded-[31px] px-1.5 md:hidden"
      >
        <ul ref={tab.list} className="relative flex w-full items-center justify-between">
          {tab.box ? (
            <li
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-[24px] bg-[rgb(0_0_0/0.06)] dark:bg-white/12"
              style={{
                width: tab.box.w,
                height: tab.box.h,
                transform: `translate3d(${tab.box.x}px, ${tab.box.y}px, 0)`,
                transition: slide(tab.animate),
              }}
            />
          ) : null}
          {SECTIONS.map((s, i) => {
            const active = i === activeIndex;
            const badge = s.key === "oefenen" && due > 0 ? due : null;
            return (
              <li key={s.href} className="relative flex">
                <Link
                  href={s.href}
                  data-nav
                  aria-current={active ? "page" : undefined}
                  aria-label={s.label}
                  className={`group flex h-[50px] flex-col items-center justify-center gap-0.5 rounded-[24px] ${active ? "min-w-[70px] px-2" : "min-w-[36px]"}`}
                >
                  {/* Het icoon neemt de kleur van de sectie; het label blijft inkt,
                      want gekleurde tekst van 10px haalt het contrast niet. */}
                  <span
                    key={active ? "aan" : "uit"}
                    style={active ? { color: s.hue[1] } : undefined}
                    className={`relative transition-transform duration-150 group-active:scale-90 ${active ? "animate-pop" : "text-ink-secondary"}`}
                  >
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {ICONS[s.icon]}
                    </svg>
                    {badge ? (
                      <span className="num absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-bad px-1 text-center text-[10.5px] leading-[17px] text-white">
                        {badge > 99 ? "99" : badge}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span className="animate-rise whitespace-nowrap text-[10.5px] font-semibold leading-none text-ink">{s.label}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
