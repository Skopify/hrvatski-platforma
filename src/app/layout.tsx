import type { Metadata, Viewport } from "next";

import { CommandMenu, type CommandItem } from "@/components/CommandMenu";
import { RoughFilter } from "@/components/doodles";
import { Island } from "@/components/Island";
import { Nav } from "@/components/Nav";
import { SECTIONS } from "@/components/sections";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { loadLessons, loadStories } from "@/lib/content";
import { loadModules } from "@/lib/modules";
import { getProfile } from "@/lib/stats";
import { reviewableCount } from "@/lib/planner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrvatski — leerplatform",
  description: "Kroatisch leren met grammatica in context, spaced repetition en echte productie.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#17161d" },
  ],
};

// De navigatie toont de reeks, de XP en het aantal openstaande herhalingen; die
// moeten per verzoek vers zijn, dus mag de layout niet vooraf gerenderd worden.
export const dynamic = "force-dynamic";

/** Alles waar het zoekvenster (⌘K) naartoe kan springen. */
function searchIndex(): CommandItem[] {
  const pages: CommandItem[] = SECTIONS.map((s) => ({
    group: "Ga naar",
    label: s.label,
    href: s.href,
    section: s.key,
  }));
  const lessons: CommandItem[] = loadLessons().map((l) => ({
    group: "Lessen",
    label: `Les ${l.number} · ${l.title_hr}`,
    sub: l.title_nl,
    href: `/lessen/${l.number}`,
    section: "lessen",
  }));
  const stories: CommandItem[] = loadStories().map((s) => ({
    group: "Verhalen",
    label: s.title_hr,
    sub: s.title_nl,
    href: `/verhalen/${s.slug}`,
    section: "verhalen",
  }));
  const grammar: CommandItem[] = loadModules().map((m) => ({
    group: "Grammatica",
    label: m.title_nl,
    href: `/grammatica/${m.code}`,
    section: "grammatica",
  }));
  return [...pages, ...lessons, ...stories, ...grammar];
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();
  const due = reviewableCount();

  return (
    // Het thema-script zet data-theme vóór React er is; dat verschil is bedoeld.
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <RoughFilter />
        <Island />
        <CommandMenu items={searchIndex()} />
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav streak={profile.streakCurrent} xp={profile.xp} due={due} />
          {/*
            Ruimte onder de inhoud voor de zwevende tabbalk op de telefoon:
            64px balk + 10px marge + de veilige zone, plus lucht, zodat een
            knop aan het eind van een pagina er nooit onder verdwijnt.
            overflow-x: clip voorkomt dat een sticker of krabbel de pagina breder maakt.
          */}
          <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
