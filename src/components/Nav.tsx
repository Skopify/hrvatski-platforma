"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { openSearch, SearchButton } from "./CommandMenu";
import { Doodle } from "./doodles";
import { SECTIONS, type SectionKey } from "./sections";
import { AfsluitKnop } from "./Levensteken";
import { PillMeter } from "./PillMeter";
import { TelefoonKnop } from "./TelefoonPaneel";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./ui";

/*
  De volgorde is die van het leren, niet die van het bouwen: bovenaan waar
  je iets nieuws doet — grammatica, lezen, schrijven — en daaronder wat
  ondersteunt: de lessen, het herhalen, de woordenlijst en de cijfers.

  Elk item heeft zijn eigen krabbel en zijn eigen stift. Het actieve item is
  een gekleurd blok met inktrand dat naar het nieuwe item schuift en onderweg
  van kleur wisselt: je ziet waar je vandaan komt en waar je heen gaat.
*/

/** De vier secties in de tabbalk op de telefoon; de rest zit achter "Meer". */
const TAB_KEYS: SectionKey[] = ["overzicht", "lessen", "oefenen", "verhalen"];
const TAB_SECTIONS = TAB_KEYS.map((k) => SECTIONS.find((s) => s.key === k)!);
const MEER_SECTIONS = SECTIONS.filter((s) => !TAB_KEYS.includes(s.key));

type Box = { x: number; y: number; w: number; h: number };

/** Meet de positie van het actieve item, zodat één blok ernaartoe kan schuiven. */
function useIndicator(activeIndex: number) {
  const list = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const ul = list.current;
      const a = ul?.querySelectorAll<HTMLElement>("[data-nav]")[activeIndex];
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

export function Nav({
  streak,
  xp,
  due,
  todayXp,
  goalXp,
  beheerd,
}: {
  streak: number;
  xp: number;
  due: number;
  todayXp: number;
  goalXp: number;
  beheerd: boolean;
}) {
  const pathname = usePathname();
  const activeIndex = SECTIONS.findIndex((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href),
  );
  const active = SECTIONS[activeIndex];
  const side = useIndicator(activeIndex);
  // Op de telefoon staat het blok in de tabbalk: op de vier vaste plekken, of op "Meer".
  const [meer, setMeer] = useState(false);
  const tabIndex = TAB_KEYS.indexOf(active?.key as SectionKey);
  const inMeer = Boolean(active) && tabIndex < 0;
  const tab = useIndicator(tabIndex >= 0 ? tabIndex : 4);

  // Een nieuwe pagina sluit het paneel; Escape ook.
  useEffect(() => setMeer(false), [pathname]);
  useEffect(() => {
    if (!meer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMeer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [meer]);

  // Emils regel: wat over het scherm beweegt gebruikt ease-in-out, en blijft
  // onder de 300ms. De kleur van het blok wisselt mee, zonder eigen timing.
  const slide = (animate: boolean) =>
    animate
      ? "transform 280ms var(--ease-in-out-strong), background-color 200ms ease"
      : "none";

  const block = (box: Box, animate: boolean, radius: string) => (
    <li
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 border-2 border-outline"
      style={{
        width: box.w,
        height: box.h,
        borderRadius: radius,
        background: active?.pop ?? "transparent",
        boxShadow: "2px 2px 0 var(--color-outline)",
        transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
        transition: slide(animate),
      }}
    />
  );

  return (
    <>
      {/* ═══ Zijbalk (tablet en groter) ═══ */}
      <nav
        aria-label="Hoofdnavigatie"
        className="sticky top-0 z-40 hidden h-dvh w-[92px] shrink-0 flex-col border-r-2 border-outline bg-surface px-2.5 pb-4 pt-5 md:flex lg:w-[268px] lg:px-4"
      >
        <Link href="/" className="mb-5 flex items-center justify-center gap-3 px-1 lg:justify-start" title="Hrvatski — leerplatform">
          <Logo size={38} />
          <span className="hidden leading-none lg:block">
            <span className="display block text-[24px]">Hrvatski</span>
            <span className="hand mt-1 block text-[13px] text-ink-muted">Kroatisch leren</span>
          </span>
        </Link>

        <SearchButton compact className="mx-auto mb-4 h-10 w-10 justify-center rounded-lg border-2 border-outline bg-plane lg:hidden" />
        <SearchButton className="mb-5 hidden h-11 rounded-xl border-2 border-outline bg-plane px-3 lg:flex" />

        <ul ref={side.list} className="relative flex flex-1 flex-col gap-1.5">
          {side.box ? block(side.box, side.animate, "16px 19px 17px 20px / 19px 16px 20px 17px") : null}
          {SECTIONS.map((s, i) => {
            const on = i === activeIndex;
            const badge = s.key === "oefenen" && due > 0 ? due : null;
            return (
              <li key={s.href} className="relative">
                <Link
                  href={s.href}
                  data-nav
                  aria-current={on ? "page" : undefined}
                  className="group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 lg:flex-row lg:gap-3 lg:px-3 lg:py-2"
                >
                  <span className="relative transition-transform duration-150 ease-out group-active:scale-90">
                    <Doodle name={s.doodle} size={30} color={on ? "#ffffff" : s.pop} />
                    {badge ? (
                      <span className="num absolute -right-2 -top-1.5 min-w-[19px] rounded-full border-2 border-outline bg-surface px-1 text-center text-[12px] text-ink leading-[15px] text-on-pop lg:hidden">
                        {badge > 99 ? "99" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-[12px] leading-none lg:text-[16px] ${on ? "font-extrabold text-on-pop" : "font-semibold text-ink"}`}
                  >
                    {s.label}
                  </span>
                  {badge ? (
                    <span className="num ml-auto hidden rounded-full border-2 border-outline bg-surface px-2 text-[13px] leading-[17px] text-ink lg:inline">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Het dagdoel blijft op elke pagina in beeld: de reden om nog één ronde te doen. */}
        <div className="mb-3 hidden px-1 md:block" title={`Dagdoel: ${todayXp} van ${goalXp} XP`}>
          <p className="hand mb-1.5 hidden items-baseline justify-between text-[13px] font-bold lg:flex">
            <span>Dagdoel</span>
            <span className="num">{Math.min(todayXp, goalXp)} / {goalXp}</span>
          </p>
          <PillMeter value={todayXp} max={goalXp} color="var(--color-pop-yellow)" height={16} showBurst={false} bare />
        </div>

        {/* Reeks en XP als twee stickers, en het thema. */}
        <div className="flex flex-col items-center gap-3 border-t-2 border-dashed border-line-strong pt-4 lg:flex-row lg:justify-between">
          <div className="flex flex-col items-center gap-2 lg:flex-row">
            <span
              title={`Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}`}
              className="pill gap-1 bg-surface px-2 text-ink"
            >
              <Doodle name="flame" size={16} color={streak > 0 ? "var(--color-warm-bright)" : "var(--color-line-strong)"} />
              <span className="num text-[14px]">{streak}</span>
            </span>
            <span title={`${xp} XP totaal`} className="pill gap-1 bg-pop-yellow px-2 text-on-pop">
              <Doodle name="bolt" size={16} color="#ffffff" />
              <span className="num text-[14px]">{xp > 9999 ? `${Math.floor(xp / 1000)}k` : xp.toLocaleString("nl-NL")}</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
        {beheerd ? (
          <>
            <div className="mt-3 hidden flex-wrap justify-center gap-2 lg:flex">
              <TelefoonKnop beheerd={beheerd} />
              <AfsluitKnop beheerd={beheerd} />
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 lg:hidden">
              <TelefoonKnop beheerd={beheerd} compact />
              <AfsluitKnop beheerd={beheerd} compact />
            </div>
          </>
        ) : null}
      </nav>

      {/* ═══ Tabbalk (telefoon) ═══
          Vijf plekken, zoals bij Apple: de vier die je dagelijks gebruikt en "Meer"
          voor de rest. Negen iconen naast elkaar waren elk 32 punten breed, en een
          vinger heeft er 44 nodig. */}
      <nav
        aria-label="Hoofdnavigatie"
        className="fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 flex h-[68px] items-stretch border-2 border-outline bg-surface px-1.5 shadow-[4px_4px_0_var(--color-outline)] md:hidden"
        style={{ borderRadius: "28px 32px 29px 34px / 32px 28px 34px 29px" }}
      >
        <ul ref={tab.list} className="relative grid w-full grid-cols-5 items-center">
          {tab.box ? block(tab.box, tab.animate, "20px 24px 21px 25px / 24px 20px 25px 21px") : null}
          {TAB_SECTIONS.map((s) => {
            const on = s.key === active?.key;
            const badge = s.key === "oefenen" && due > 0 ? due : null;
            return (
              <li key={s.href} className="relative flex justify-center">
                <Link
                  href={s.href}
                  data-nav
                  aria-current={on ? "page" : undefined}
                  className="tab-item group flex h-[56px] w-full flex-col items-center justify-center gap-0.5"
                >
                  <span className="relative transition-transform duration-150 ease-out group-active:scale-90">
                    <Doodle name={s.doodle} size={26} color={on ? "#ffffff" : s.pop} />
                    {badge ? (
                      <span className="num absolute -right-3 -top-2 min-w-[18px] rounded-full border-2 border-outline bg-surface px-1 text-center text-[12px] leading-[14px] text-ink">
                        {badge > 99 ? "99" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span className={`text-[12px] leading-none ${on ? "font-extrabold text-on-pop" : "font-semibold text-ink"}`}>
                    {s.label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="relative flex justify-center">
            <button
              type="button"
              data-nav
              onClick={() => setMeer(true)}
              aria-haspopup="dialog"
              aria-expanded={meer}
              aria-current={inMeer ? "page" : undefined}
              className="tab-item group flex h-[56px] w-full flex-col items-center justify-center gap-0.5"
            >
              <span className="relative transition-transform duration-150 ease-out group-active:scale-90">
                {inMeer && active ? (
                  <Doodle name={active.doodle} size={26} color="#ffffff" />
                ) : (
                  <Doodle name="punten" size={26} color="var(--color-pop-lilac)" />
                )}
              </span>
              <span className={`max-w-full whitespace-nowrap text-[12px] leading-none tracking-tight ${inMeer ? "text-[11px] font-extrabold text-on-pop" : "font-semibold text-ink"}`}>
                {inMeer && active ? active.label : "Meer"}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ═══ "Meer": de overige secties, zoeken en thema, als paneel van onderen ═══ */}
      <div className={`fixed inset-0 z-[60] md:hidden ${meer ? "" : "pointer-events-none"}`} inert={!meer} aria-hidden={!meer}>
        <div
          className="absolute inset-0 bg-black/40 transition-opacity duration-200"
          style={{ opacity: meer ? 1 : 0 }}
          onClick={() => setMeer(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Meer"
          data-open={meer}
          className="sheet absolute inset-x-0 bottom-0 rounded-t-[32px] border-2 border-b-0 border-outline bg-surface px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_0_var(--color-outline)]"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-strong" aria-hidden />
          <ul className="grid grid-cols-2 gap-3">
            {MEER_SECTIONS.map((s) => {
              const on = s.key === active?.key;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className={`flex min-h-[64px] items-center gap-3 rounded-[20px] border-2 border-outline px-3 py-2 text-[16px] font-bold shadow-[3px_3px_0_var(--color-outline)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_var(--color-outline)] ${on ? "text-on-pop" : "bg-surface text-ink"}`}
                    style={on ? { background: s.pop } : undefined}
                  >
                    <Doodle name={s.doodle} size={30} color={on ? "#ffffff" : s.pop} />
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center gap-3 border-t-2 border-dashed border-line-strong pt-4">
            <button
              type="button"
              onClick={() => {
                setMeer(false);
                setTimeout(openSearch, 50);
              }}
              className="pill h-11 flex-1 justify-start gap-2 bg-plane px-4 text-[15px] text-ink"
            >
              <Doodle name="search" size={22} color="var(--color-pop-sky)" />
              Zoeken
            </button>
            <ThemeToggle />
            {beheerd ? <AfsluitKnop beheerd={beheerd} compact /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
