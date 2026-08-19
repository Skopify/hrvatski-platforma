"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const LINKS = [
  { href: "/", label: "Overzicht", icon: "overzicht" },
  { href: "/lessen", label: "Lessen", icon: "lessen" },
  { href: "/grammatica", label: "Grammatica", icon: "grammatica" },
  { href: "/verhalen", label: "Verhalen", icon: "verhalen" },
  { href: "/schrijven", label: "Schrijven", icon: "schrijven" },
  { href: "/oefenen", label: "Oefenen", icon: "herhalen" },
  { href: "/woorden", label: "Woorden", icon: "woorden" },
  { href: "/voortgang", label: "Voortgang", icon: "voortgang" },
];

export function Nav({ streak, xp, due }: { streak: number; xp: number; due: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-40 flex h-16 w-full shrink-0 flex-row items-center gap-1 border-b border-line bg-surface px-3 md:h-screen md:w-[88px] md:flex-col md:gap-1.5 md:border-b-0 md:border-r md:px-0 md:py-5"
      aria-label="Hoofdnavigatie"
    >
      <Link
        href="/"
        title="Hrvatski — leerplatform"
        className="mr-2 flex shrink-0 items-center justify-center transition-transform duration-300 hover:scale-105 md:mr-0 md:mb-4"
      >
        <Logo size={36} />
      </Link>

      <ul className="flex flex-1 flex-row items-center gap-1 md:w-full md:flex-col md:gap-1.5">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          const badge = link.href === "/oefenen" && due > 0 ? due : null;

          return (
            <li key={link.href} className="relative md:w-full md:px-3.5">
              {/* De actieve markering: een streep tegen de rand. Onmiskenbaar,
                  zonder dat er een gevulde knop in de rail hoeft. */}
              <span
                aria-hidden
                className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 ${
                  active
                    ? "bottom-0 h-[3px] w-8 md:bottom-auto md:left-0 md:top-1/2 md:h-8 md:w-[3px] md:-translate-x-0 md:-translate-y-1/2"
                    : "bottom-0 h-[3px] w-0 opacity-0 md:top-1/2 md:h-0 md:w-[3px]"
                }`}
              />
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl px-2.5 py-2 transition-colors duration-200 md:px-1 md:py-2.5 ${
                  active
                    ? "bg-accent-wash text-accent"
                    : "text-ink-muted hover:bg-sunken hover:text-ink-secondary"
                }`}
              >
                <span className="relative">
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {ICONS[link.icon]}
                  </svg>
                  {badge ? (
                    <span className="tabular absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-warm-bright px-1 text-center text-[10px] font-bold leading-[17px] text-white">
                      {badge > 99 ? "99" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-semibold leading-none tracking-tight">
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Reeks en XP staan altijd in beeld — als geheugensteun dat er iets loopt
          dat je vandaag kunt verliezen, niet als beloning. */}
      <div className="ml-auto flex shrink-0 flex-row items-center gap-2 md:ml-0 md:w-full md:flex-col md:gap-3 md:border-t md:border-line-soft md:pt-4">
        <span
          title={`Reeks: ${streak} ${streak === 1 ? "dag" : "dagen"}`}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold md:flex-col md:gap-0.5 md:rounded-none md:bg-transparent md:px-0 ${
            streak > 0 ? "bg-warm-wash text-warm" : "bg-sunken text-ink-muted"
          }`}
        >
          <svg
            width="14"
            height="17"
            viewBox="0 0 17 20"
            aria-hidden
            className={streak > 0 ? "animate-flicker" : ""}
          >
            <path
              d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z"
              fill={streak > 0 ? "var(--color-warm-bright)" : "var(--color-line-strong)"}
            />
          </svg>
          <span className="tabular">{streak}</span>
        </span>

        <span
          title={`${xp} XP totaal`}
          className="hidden items-center gap-1 text-[11px] font-bold text-ink-muted md:flex md:flex-col md:gap-0.5"
        >
          <Bolt className="text-gold-bright" />
          <span className="tabular">{xp > 9999 ? `${Math.floor(xp / 1000)}k` : xp}</span>
        </span>
      </div>
    </nav>
  );
}
