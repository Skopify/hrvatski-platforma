import type { Metadata, Viewport } from "next";

import { CommandMenu } from "@/components/CommandMenu";
import { RoughFilter } from "@/components/doodles";
import { Island } from "@/components/Island";
import { Levensteken } from "@/components/Levensteken";
import { Nav } from "@/components/Nav";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { dailyStats, getProfile } from "@/lib/stats";
import { instelling } from "@/lib/levenscyclus";
import { reviewableCount } from "@/lib/planner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrvatski — leerplatform",
  description: "Kroatisch leren met grammatica in context, spaced repetition en echte productie.",
  // Als app op het beginscherm van een iPhone of iPad: eigen naam en icoon, geen Safari-balk.
  appleWebApp: { capable: true, title: "Hrvatski", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // Het toetsenbord verkleint de pagina in plaats van eroverheen te schuiven, zodat een
  // invoerbalk onderaan (Gesprek) zichtbaar blijft terwijl je typt.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#17161d" },
  ],
};

// De navigatie toont de reeks, de XP en het aantal openstaande herhalingen; die
// moeten per verzoek vers zijn, dus mag de layout niet vooraf gerenderd worden.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();
  const due = reviewableCount();
  const beheerd = instelling().beheerd;
  const todayXp = dailyStats(1).at(-1)?.xp ?? 0;

  return (
    // Het thema-script zet data-theme vóór React er is; dat verschil is bedoeld.
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <RoughFilter />
        <Island />
        <Levensteken beheerd={beheerd} />
        <CommandMenu />
        <div className="flex min-h-dvh flex-col md:flex-row">
          <Nav streak={profile.streakCurrent} xp={profile.xp} due={due} todayXp={todayXp} goalXp={profile.dailyGoalXp} beheerd={beheerd} />
          {/*
            Ruimte onder de inhoud voor de zwevende tabbalk op de telefoon:
            64px balk + 10px marge + de veilige zone, plus lucht, zodat een
            knop aan het eind van een pagina er nooit onder verdwijnt.
            overflow-x: clip voorkomt dat een sticker of krabbel de pagina breder maakt.
          */}
          <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(100px+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
